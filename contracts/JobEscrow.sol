// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./FreelancerProfile.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title JobEscrow
/// @notice Single-use USDT escrow for a client↔freelancer job, integrated with FreelancerProfile for status & reputation.
contract JobEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error ZeroAddress();
    error NotClient();
    error NotFreelancer();
    error NotResolver();
    error NotFactory();
    error AlreadyDelivered();
    error NotDelivered();
    error AlreadyTerminal();
    error CancelWindowOver();
    error CancelNotRequested();
    error InvalidCaller();
    error AmountZero();
    error NoDispute();
    error Disputed();
    error TooEarly();
    error BpsTooHigh();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event WorkDelivered(bytes32 indexed jobKey, string uri);
    event CancelRequested(bytes32 indexed jobKey, address indexed by);
    event CancelAccepted(bytes32 indexed jobKey);
    event DisputeRaised(bytes32 indexed jobKey, address indexed by, string reasonURI);
    event DisputeResolved(bytes32 indexed jobKey, Resolution outcome, uint16 payoutBps, uint8 rating, uint256 paidToFreelancer, uint256 refundedToClient);
    event Paid(bytes32 indexed jobKey, address indexed to, uint256 netAmount, uint256 feeAmount);
    event Refunded(bytes32 indexed jobKey, address indexed to, uint256 amount);
    event AutoApproved(bytes32 indexed jobKey, uint8 rating);

    /*//////////////////////////////////////////////////////////////
                                IMMUTABLES
    //////////////////////////////////////////////////////////////*/
    address public immutable client;
    address public immutable freelancer;
    IERC20  public immutable usdt;
    uint256 public immutable amount;           // funded once at creation
    uint16  public immutable platformFeeBps;   // <= 10000
    address public immutable platformWallet;
    address public immutable resolver;
    FreelancerProfile public immutable profile;
    address public immutable escrowFactory;

    // Timelines / policy
    uint64 public immutable cancelWindowEnd;   // now + cancelWindowSecs
    uint64 public immutable deliveryDue;       // 0 disables hard delivery deadline
    uint64 public immutable reviewWindowSecs;  // 0 disables auto-approve
    uint8  public immutable autoApproveDefaultRating;

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/
    bytes32 public jobKey;

    bool   public delivered;
    bool   public disputed;
    bool   public terminal;

    uint64 public reviewDue;              // set on delivery if reviewWindowSecs > 0
    address public cancelRequestedBy;     // tracks mutual cancel intent

    string  public lastDeliveryURI;
    string  public lastDisputeURI;

    // NEW: Track all deliveries for multiple submission support
    struct Delivery {
        string uri;                       // IPFS URI with delivery details
        uint64 timestamp;                 // when it was submitted
        uint256 version;                  // delivery version number (1, 2, 3...)
    }

    Delivery[] public deliveryHistory;    // all submissions in chronological order

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(
        address _client,
        address _freelancer,
        address _usdt,
        uint256 _amountUSDT,
        string memory /* _metadataURI */,
        uint16  _platformFeeBps,
        address _platformWallet,
        address _resolver,
        address _profile,
        uint64  _cancelWindowSecs,
        uint64  _deliveryDueTs,
        uint64  _reviewWindowSecs,
        uint8   _autoApproveDefaultRating,
        address _escrowFactory
    ) {
        if (_client == address(0) || _freelancer == address(0) || _usdt == address(0) || _platformWallet == address(0) || _resolver == address(0) || _profile == address(0) || _escrowFactory == address(0)) {
            revert ZeroAddress();
        }
        if (_amountUSDT == 0) revert AmountZero();
        if (_platformFeeBps > 10_000) revert BpsTooHigh();

        client = _client;
        freelancer = _freelancer;
        usdt = IERC20(_usdt);
        amount = _amountUSDT;

        platformFeeBps = _platformFeeBps;
        platformWallet = _platformWallet;
        resolver = _resolver;
        profile = FreelancerProfile(_profile);
        escrowFactory = _escrowFactory;

        cancelWindowEnd = uint64(block.timestamp) + _cancelWindowSecs;
        deliveryDue = _deliveryDueTs;
        reviewWindowSecs = _reviewWindowSecs;
        autoApproveDefaultRating = _autoApproveDefaultRating;

        // Unique job key bound to this escrow + parties
        jobKey = keccak256(abi.encode(address(this), _client, _freelancer));
    }

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyClient() {
        if (msg.sender != client) revert NotClient();
        _;
    }

    modifier onlyFreelancer() {
        if (msg.sender != freelancer) revert NotFreelancer();
        _;
    }

    modifier onlyResolver() {
        if (msg.sender != resolver) revert NotResolver();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != escrowFactory) revert NotFactory();
        _;
    }

    modifier notTerminal() {
        if (terminal) revert AlreadyTerminal();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                        BOOTSTRAP (factory after linking)
    //////////////////////////////////////////////////////////////*/
    /// @notice Factory calls this after linking the escrow in the profile to create a job and set it InProgress.
    function bootstrapRegisterJob() external onlyFactory {
        // Factory has already registered this escrow as active in the profile.
        profile.registerJob(jobKey); // sets status = Created
        profile.updateJobStatus(jobKey, FreelancerProfile.JobStatus.InProgress);
    }

    /*//////////////////////////////////////////////////////////////
                                CORE ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Freelancer marks the work delivered; starts client review timer if configured.
    /// @dev Can be called multiple times - each submission is tracked in history
    function deliverWork(string calldata deliveryURI) external onlyFreelancer notTerminal {
        // REMOVED: if (delivered) revert AlreadyDelivered();
        // Now allows multiple submissions

        // Mark as delivered (if first time)
        if (!delivered) {
            delivered = true;
        }

        // Store latest delivery
        lastDeliveryURI = deliveryURI;

        // Add to history
        deliveryHistory.push(Delivery({
            uri: deliveryURI,
            timestamp: uint64(block.timestamp),
            version: deliveryHistory.length + 1
        }));

        // Reset/set review due on each new submission
        if (reviewWindowSecs > 0) {
            reviewDue = uint64(block.timestamp) + reviewWindowSecs;
        }

        // Update profile status → Delivered (resets to Delivered even if already delivered)
        profile.updateJobStatus(jobKey, FreelancerProfile.JobStatus.Delivered);

        emit WorkDelivered(jobKey, deliveryURI);
    }

    /// @notice Client approves the work; pays freelancer and finalizes reputation.
    function approveWork(uint8 rating) external onlyClient notTerminal nonReentrant {
        if (!delivered) revert NotDelivered();
        if (disputed) revert Disputed();

        _payoutAndComplete(rating);
    }

    /// @notice Either party can request cancellation. Pre-delivery client cancels unilaterally within window.
    function requestCancel() external notTerminal {
        if (msg.sender != client && msg.sender != freelancer) revert InvalidCaller();

        if (!delivered) {
            if (msg.sender == client && block.timestamp <= cancelWindowEnd) {
                // Unilateral pre-delivery cancel → refund client
                _refundAndCancel();
                return;
            }
        }
        cancelRequestedBy = msg.sender;
        emit CancelRequested(jobKey, msg.sender);
    }

    /// @notice Counterparty accepts a pending cancel request. Refunds client and cancels job.
    function acceptCancel() external notTerminal nonReentrant {
        if (cancelRequestedBy == address(0)) revert CancelNotRequested();
        if (msg.sender == cancelRequestedBy) revert InvalidCaller(); // must be the other party

        _refundAndCancel();
        emit CancelAccepted(jobKey);
    }

    /// @notice Either party raises a dispute, sending the profile to Disputed.
    function raiseDispute(string calldata reasonURI) external notTerminal {
        if (msg.sender != client && msg.sender != freelancer) revert InvalidCaller();
        if (disputed) revert Disputed();

        disputed = true;
        lastDisputeURI = reasonURI;

        profile.updateJobStatus(jobKey, FreelancerProfile.JobStatus.Disputed);
        emit DisputeRaised(jobKey, msg.sender, reasonURI);
    }

    /*//////////////////////////////////////////////////////////////
                                RESOLUTION / TIMEOUTS
    //////////////////////////////////////////////////////////////*/

    enum Resolution { PAYOUT, REFUND }

    /// @notice Resolver settles disputes. Supports full/partial payout with rating, or full refund.
    /// @param payoutBps 0..10000 share to freelancer from current escrow balance
    /// @param rating    applied only if payout > 0; clamped to 1..5
    /// @param outcome   PAYOUT (partial/full) or REFUND
    function resolveDispute(
        uint16 payoutBps,
        uint8  rating,
        Resolution outcome
    ) external onlyResolver notTerminal nonReentrant {
        if (!disputed) revert NoDispute();
        if (payoutBps > 10_000) revert BpsTooHigh();

        uint256 escrowBal = usdt.balanceOf(address(this));

        if (outcome == Resolution.PAYOUT) {
            uint256 toFreelancer = (escrowBal * payoutBps) / 10_000;
            uint256 toClient = escrowBal - toFreelancer;

            uint256 feeAmt = 0;
            uint256 netPayout = toFreelancer;

            if (toFreelancer > 0) {
                // clamp rating 1..5
                if (rating < 1) rating = 1;
                if (rating > 5) rating = 5;

                if (platformFeeBps > 0) {
                    feeAmt = (toFreelancer * platformFeeBps) / 10_000;
                    netPayout = toFreelancer - feeAmt;
                    if (feeAmt > 0) usdt.safeTransfer(platformWallet, feeAmt);
                }
                if (netPayout > 0) {
                    usdt.safeTransfer(freelancer, netPayout);
                    emit Paid(jobKey, freelancer, netPayout, feeAmt);
                }

                // Profile: treat as acceptance (even partial) → Approved + Completed with rating
                profile.updateJobStatus(jobKey, FreelancerProfile.JobStatus.Approved);
                profile.markJobCompleted(rating, jobKey);
            } else {
                // No payout → pure refund path (toClient == escrowBal)
                profile.updateJobStatus(jobKey, FreelancerProfile.JobStatus.Cancelled);
            }

            if (toClient > 0) {
                usdt.safeTransfer(client, toClient);
                emit Refunded(jobKey, client, toClient);
            }

            terminal = true;
            emit DisputeResolved(jobKey, outcome, payoutBps, rating, toFreelancer, toClient);
            return;
        }

        // outcome == REFUND
        _refundAndCancel();
        emit DisputeResolved(jobKey, outcome, 0, 0, 0, escrowBal);
    }

    /// @notice Processes timeouts:
    /// - If delivered & reviewDue passed & not disputed → auto-approve & pay with default rating.
    /// - If not delivered & deliveryDue set & passed → refund & cancel.
    function processTimeouts() external notTerminal nonReentrant {
        // Auto-approve if client silent after delivery
        if (delivered && !disputed && reviewWindowSecs > 0 && reviewDue != 0 && block.timestamp > reviewDue) {
            uint8 rating = autoApproveDefaultRating;
            if (rating < 1) rating = 1;
            if (rating > 5) rating = 5;
            _payoutAndComplete(rating);
            emit AutoApproved(jobKey, rating);
            return;
        }

        // Missed delivery deadline → client-friendly refund
        if (!delivered && deliveryDue != 0 && block.timestamp > deliveryDue) {
            _refundAndCancel();
            return;
        }

        revert TooEarly();
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _payoutAndComplete(uint8 rating) internal {
        // clamp rating
        if (rating < 1) rating = 1;
        if (rating > 5) rating = 5;

        uint256 bal = usdt.balanceOf(address(this));
        uint256 feeAmt = 0;
        uint256 net = bal;

        if (platformFeeBps > 0) {
            feeAmt = (bal * platformFeeBps) / 10_000;
            if (feeAmt > 0) {
                net = bal - feeAmt;
                usdt.safeTransfer(platformWallet, feeAmt);
            }
        }
        if (net > 0) {
            usdt.safeTransfer(freelancer, net);
            emit Paid(jobKey, freelancer, net, feeAmt);
        }

        profile.updateJobStatus(jobKey, FreelancerProfile.JobStatus.Approved);
        profile.markJobCompleted(rating, jobKey);

        terminal = true;
    }

    function _refundAndCancel() internal {
        uint256 bal = usdt.balanceOf(address(this));
        if (bal > 0) {
            usdt.safeTransfer(client, bal);
            emit Refunded(jobKey, client, bal);
        }

        profile.updateJobStatus(jobKey, FreelancerProfile.JobStatus.Cancelled);
        terminal = true;
    }

    /*//////////////////////////////////////////////////////////////
                                VIEWS
    //////////////////////////////////////////////////////////////*/
    function currentDeadlines() external view returns (uint64 cancelEnd, uint64 _deliveryDue, uint64 _reviewDue) {
        return (cancelWindowEnd, deliveryDue, reviewDue);
    }

    /// @notice Get total number of deliveries submitted
    function getDeliveryCount() external view returns (uint256) {
        return deliveryHistory.length;
    }

    /// @notice Get a specific delivery by index
    /// @param index The delivery index (0-based)
    /// @return uri The IPFS URI
    /// @return timestamp When it was submitted
    /// @return version The version number
    function getDelivery(uint256 index) 
        external 
        view 
        returns (
            string memory uri,
            uint64 timestamp,
            uint256 version
        ) 
    {
        require(index < deliveryHistory.length, "Invalid index");
        Delivery storage d = deliveryHistory[index];
        return (d.uri, d.timestamp, d.version);
    }

    /// @notice Get all deliveries at once
    /// @return Array of all Delivery structs
    function getAllDeliveries() external view returns (Delivery[] memory) {
        return deliveryHistory;
    }
}
