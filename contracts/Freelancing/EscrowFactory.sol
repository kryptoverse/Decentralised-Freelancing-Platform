// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./FreelancerFactory.sol";
import "./FreelancerProfile.sol";
import "./JobEscrow.sol";
import "./JobBoard.sol"; // ✅ NEW

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title EscrowFactory
/// @notice Deploys per-job escrows, funds them atomically with USDT, and links them to the freelancer's profile.
/// @dev Flow:
/// 1) Client approves USDT to this factory
/// 2) Client calls createAndFundEscrow(...)
/// 3) (NEW OPTION) Client can call createAndFundEscrowForJob(jobId, ...) so JobBoard is marked as Hired
contract EscrowFactory is Ownable {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error ZeroAddress();
    error ProfileMissing();
    error AmountZero();
    error BpsTooHigh();
    error NotOwner();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event EscrowCreated(
        bytes32 indexed jobKey,
        address indexed escrow,
        address indexed client,
        address freelancer,
        uint256 amount,
        uint64 cancelWindowEnd,
        uint64 deliveryDue,
        uint64 reviewDue
    );

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/
    IERC20 public immutable usdt;
    FreelancerFactory public immutable freelancerFactory;
    JobBoard public immutable jobBoard; // ✅ NEW

    // Dispute System Tracking
    struct DisputeRecord {
        uint256 jobId;
        address escrow;
        address client;
        address freelancer;
        string reasonURI; // IPFS PINATA link
        bool resolved;
    }

    DisputeRecord[] public allDisputes;
    mapping(address => uint256) public escrowToDisputeIndex;
    mapping(address => bool) public hasDispute;

    mapping(address => uint256) public escrowJobId;
    mapping(address => bool) public isEscrowValid;

    // Fee on payouts (not on refunds), in basis points (max 10000)
    uint16  public platformFeeBps;         // e.g., 200 = 2%
    address public platformWallet;

    // Dispute resolver (EOA/multisig/module)
    address public resolver;

    constructor(
        address _freelancerFactory,
        address _usdt,
        address _platformWallet,
        uint16  _platformFeeBps,
        address _resolver,
        address _jobBoard           // ✅ NEW PARAM
    ) Ownable(msg.sender) {
        _transferOwnership(msg.sender);

        if (
            _freelancerFactory == address(0) ||
            _usdt == address(0) ||
            _platformWallet == address(0) ||
            _resolver == address(0) ||
            _jobBoard == address(0)        // ✅ NEW CHECK
        ) revert ZeroAddress();
        if (_platformFeeBps > 10_000) revert BpsTooHigh();

        freelancerFactory = FreelancerFactory(_freelancerFactory);
        usdt = IERC20(_usdt);
        platformWallet = _platformWallet;
        platformFeeBps = _platformFeeBps;
        resolver = _resolver;
        jobBoard = JobBoard(_jobBoard);    // ✅ STORE JOBBOARD
    }


    /*//////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////*/
    function setPlatformFee(uint16 _bps, address _wallet) external onlyOwner {
        if (_wallet == address(0)) revert ZeroAddress();
        if (_bps > 10_000) revert BpsTooHigh();
        platformFeeBps = _bps;
        platformWallet = _wallet;
    }

    function setResolver(address _resolver) external onlyOwner {
        if (_resolver == address(0)) revert ZeroAddress();
        resolver = _resolver;
    }

    /*//////////////////////////////////////////////////////////////
                                CREATE + FUND
    //////////////////////////////////////////////////////////////*/
    /// @notice Deploy & fund a per-job escrow atomically.
    /// @param freelancer Freelancer wallet (profile owner).
    /// @param amountUSDT Amount to lock inside the escrow (client must approve this factory first).
    /// @param metadataURI Off-chain job metadata (optional; stored/emitted by escrow as needed).
    /// @param cancelWindowSecs Pre-delivery unilateral cancel window for client.
    /// @param deliveryDueTs Hard delivery deadline (0 to disable).
    /// @param reviewWindowSecs Client review window after delivery (0 disables auto-approve).
    /// @param autoApproveDefaultRating Rating used on auto-approve (clamped to 1..5 if >0).
    function createAndFundEscrow(
        address freelancer,
        uint256 amountUSDT,
        string calldata metadataURI,
        uint64  cancelWindowSecs,
        uint64  deliveryDueTs,
        uint64  reviewWindowSecs,
        uint8   autoApproveDefaultRating
    ) public returns (address escrowAddr) { // ✅ was external
        if (freelancer == address(0)) revert ZeroAddress();
        if (amountUSDT == 0) revert AmountZero();

        // Resolve freelancer profile
        address profileAddr = freelancerFactory.freelancerProfile(freelancer);
        if (profileAddr == address(0)) revert ProfileMissing();

        // Deploy JobEscrow
        JobEscrow escrow = new JobEscrow(
            msg.sender,                 // client (EOA / smart account)
            freelancer,                 // freelancer
            address(usdt),              // USDT token
            amountUSDT,
            metadataURI,
            platformFeeBps,
            platformWallet,
            resolver,
            profileAddr,
            cancelWindowSecs,
            deliveryDueTs,
            reviewWindowSecs,
            autoApproveDefaultRating,
            address(this)               // escrowFactory
        );
        escrowAddr = address(escrow);

        // Pull USDT from client → escrow
        usdt.safeTransferFrom(msg.sender, escrowAddr, amountUSDT);

        // Link escrow into freelancer profile (factory-level authorization)
        freelancerFactory.linkEscrowToProfile(freelancer, escrowAddr);

        // Mark escrow as validly spawned by this factory
        isEscrowValid[escrowAddr] = true;

        // Tell escrow to register the job in the profile and move to InProgress
        escrow.bootstrapRegisterJob();

        // Read deadlines for event
        (uint64 cancelEnd, uint64 deliveryDue, uint64 reviewDue) = escrow.currentDeadlines();

        emit EscrowCreated(
            escrow.jobKey(),
            escrowAddr,
            msg.sender,
            freelancer,
            amountUSDT,
            cancelEnd,
            deliveryDue,
            reviewDue
        );

        return escrowAddr;
    }

    /// @notice NEW helper: same as createAndFundEscrow, but also marks the JobBoard job as Hired.
    /// @dev This does NOT change the old function; it's an extra entrypoint for flows that know jobId.
    function createAndFundEscrowForJob(
        uint256 jobId,
        address freelancer,
        uint256 amountUSDT,
        string calldata metadataURI,
        uint64  cancelWindowSecs,
        uint64  deliveryDueTs,
        uint64  reviewWindowSecs,
        uint8   autoApproveDefaultRating
    ) external returns (address escrowAddr) {
        // ✅ INTERNAL CALL – preserves original msg.sender (the client smart wallet)
        escrowAddr = createAndFundEscrow(
            freelancer,
            amountUSDT,
            metadataURI,
            cancelWindowSecs,
            deliveryDueTs,
            reviewWindowSecs,
            autoApproveDefaultRating
        );

        // Link the specific jobId to this escrow
        escrowJobId[escrowAddr] = jobId;

        // ✅ After escrow deployed & funded, mark the job as hired on JobBoard
        jobBoard.markAsHired(jobId, freelancer, escrowAddr);

        return escrowAddr;
    }

    /*//////////////////////////////////////////////////////////////
                            DISPUTE TRACKING
    //////////////////////////////////////////////////////////////*/
    /// @notice Records a new dispute from a valid JobEscrow.
    function recordDispute(address client, address freelancer, string calldata reasonURI) external {
        if (!isEscrowValid[msg.sender]) revert ProfileMissing(); // Reusing error
        if (hasDispute[msg.sender]) return; // Avoid duplicate active disputes for the same escrow

        uint256 jobId = escrowJobId[msg.sender];

        allDisputes.push(DisputeRecord({
            jobId: jobId,
            escrow: msg.sender,
            client: client,
            freelancer: freelancer,
            reasonURI: reasonURI,
            resolved: false
        }));

        escrowToDisputeIndex[msg.sender] = allDisputes.length - 1;
        hasDispute[msg.sender] = true;
    }

    /// @notice Marks a dispute as resolved when the JobEscrow is settled.
    function resolveDisputeRecord(address escrowAddr) external {
        if (!isEscrowValid[msg.sender]) revert ProfileMissing();
        if (msg.sender != escrowAddr) revert NotOwner(); // Just basic check
        
        if (hasDispute[escrowAddr]) {
            uint256 index = escrowToDisputeIndex[escrowAddr];
            allDisputes[index].resolved = true;
        }
    }

    /// @notice Returns total number of disputes
    function getTotalDisputes() external view returns (uint256) {
        return allDisputes.length;
    }

    /// @notice Returns all disputes paginated
    function getDisputes(uint256 offset, uint256 limit) external view returns (DisputeRecord[] memory) {
        uint256 total = allDisputes.length;
        if (offset >= total) {
            return new DisputeRecord[](0);
        }

        uint256 size = limit;
        if (offset + limit > total) {
            size = total - offset;
        }

        DisputeRecord[] memory result = new DisputeRecord[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = allDisputes[offset + i];
        }

        return result;
    }

    /// @notice Returns only active (unresolved) disputes
    function getActiveDisputes() external view returns (DisputeRecord[] memory) {
        uint256 total = allDisputes.length;
        uint256 activeCount = 0;

        for (uint256 i = 0; i < total; i++) {
            if (!allDisputes[i].resolved) {
                activeCount++;
            }
        }

        DisputeRecord[] memory result = new DisputeRecord[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < total; i++) {
            if (!allDisputes[i].resolved) {
                result[index] = allDisputes[i];
                index++;
            }
        }

        return result;
    }
}
