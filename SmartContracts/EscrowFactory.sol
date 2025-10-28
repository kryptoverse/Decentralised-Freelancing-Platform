// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FreelancerFactory.sol";
import "./FreelancerProfile.sol";
import "./JobEscrow.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title EscrowFactory
/// @notice Deploys per-job escrows, funds them atomically with USDT, and links them to the freelancer's profile.
/// @dev Flow:
/// 1) Client approves USDT to this factory
/// 2) Client calls createAndFundEscrow(...)
/// 3) Factory deploys JobEscrow, transfers USDT to it, links escrow via FreelancerFactory, then boots the job in profile
contract EscrowFactory is Ownable {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error ZeroAddress();
    error ProfileMissing();
    error AmountZero();
    error BpsTooHigh();

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
    address _resolver
) {
    _transferOwnership(msg.sender);

    if (
        _freelancerFactory == address(0) ||
        _usdt == address(0) ||
        _platformWallet == address(0) ||
        _resolver == address(0)
    ) revert ZeroAddress();
    if (_platformFeeBps > 10_000) revert BpsTooHigh();

    freelancerFactory = FreelancerFactory(_freelancerFactory);
    usdt = IERC20(_usdt);
    platformWallet = _platformWallet;
    platformFeeBps = _platformFeeBps;
    resolver = _resolver;
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
    ) external returns (address escrowAddr) {
        if (freelancer == address(0)) revert ZeroAddress();
        if (amountUSDT == 0) revert AmountZero();

        // Resolve freelancer profile
        address profileAddr = freelancerFactory.freelancerProfile(freelancer);
        if (profileAddr == address(0)) revert ProfileMissing();

        // Deploy JobEscrow
        JobEscrow escrow = new JobEscrow(
            msg.sender,                 // client
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
}
