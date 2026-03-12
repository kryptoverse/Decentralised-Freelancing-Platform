// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPlatformStats {
    function recordJobInvestment(uint256 amount) external;
    function recordJobReturn(uint256 amount) external;
}

interface IJobEscrow {
    function amount() external view returns (uint256);
}

interface IInvestorRegistryForJob {
    function recordJobInvestment(address investor, address fundraiseContract, uint256 amount) external;
    function recordJobPayout(address investor, address fundraiseContract, uint256 amount) external;
}

/// @title JobFundraise
/// @notice Manages syndicated fundraising for a single job
contract JobFundraise is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;
    address public immutable escrow;
    address public immutable freelancer;
    IPlatformStats public immutable stats;
    IInvestorRegistryForJob public immutable investorRegistry;

    uint256 public immutable targetAmount;           // The T value (expenses requested)
    uint96  public immutable investorProfitShareBps; // Max 10000 (e.g., 5000 = 50% of Net Profit)
    uint64  public immutable fundingDeadline;

    uint256 public totalRaised;
    bool public isResolved;
    bool public isAccepted; // If true, freelancer took the funds

    // Tracking
    mapping(address => uint256) public deposits;
    address[] public investors;

    // Payout state
    bool public payoutDistributed;
    uint256 public totalPayoutReceived; 
    uint256 public investorPoolTotal;   
    uint256 public freelancerPoolTotal; 
    mapping(address => uint256) public investorClaimed;
    bool public freelancerClaimed;
    bool public raisedFundsWithdrawn;

    event Invested(address indexed investor, uint256 amount);
    event FundraiseResolved(bool accepted, uint256 amountRaised);
    event RefundClaimed(address indexed investor, uint256 amount);
    event PayoutDistributedEvent(uint256 totalPayout, uint256 investorPool, uint256 freelancerPool);
    event InvestorClaimed(address indexed investor, uint256 amount);
    event FreelancerClaimed(uint256 amount);

    error ZeroAddress();
    error InvalidAmount();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error AlreadyResolved();
    error NotResolved();
    error NotAccepted();
    error Accepted();
    error OnlyFreelancer();
    error OnlyEscrow();
    error PayoutAlreadyDistributed();
    error NothingToClaim();
    error FundraiseFull();
    error BpsTooHigh();

    constructor(
        address _paymentToken,
        address _escrow,
        address _freelancer,
        address _stats,
        address _investorRegistry,
        uint256 _targetAmount,
        uint96 _investorProfitShareBps,
        uint64 _fundingDurationSecs
    ) {
        if (_paymentToken == address(0) || _escrow == address(0) || _freelancer == address(0)) revert ZeroAddress();
        if (_targetAmount == 0) revert InvalidAmount();
        if (_investorProfitShareBps > 10000) revert BpsTooHigh();

        paymentToken = IERC20(_paymentToken);
        escrow = _escrow;
        freelancer = _freelancer;
        if (_stats != address(0)) {
            stats = IPlatformStats(_stats);
        }
        if (_investorRegistry != address(0)) {
            investorRegistry = IInvestorRegistryForJob(_investorRegistry);
        }
        
        targetAmount = _targetAmount;
        investorProfitShareBps = _investorProfitShareBps;
        fundingDeadline = uint64(block.timestamp) + _fundingDurationSecs;
    }

    /// @notice Investors deposit USDT into the job
    function invest(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (block.timestamp > fundingDeadline) revert DeadlinePassed();
        if (isResolved) revert AlreadyResolved();
        
        uint256 remaining = targetAmount - totalRaised;
        if (remaining == 0) revert FundraiseFull();
        
        uint256 acceptedAmount = amount > remaining ? remaining : amount;
        
        // Track the unique investor for UI/off-chain needs
        if (deposits[msg.sender] == 0) {
            investors.push(msg.sender);
        }
        deposits[msg.sender] += acceptedAmount;
        totalRaised += acceptedAmount;

        paymentToken.safeTransferFrom(msg.sender, address(this), acceptedAmount);

        if (address(stats) != address(0)) {
            stats.recordJobInvestment(acceptedAmount);
        }
        if (address(investorRegistry) != address(0)) {
            investorRegistry.recordJobInvestment(msg.sender, address(this), acceptedAmount);
        }

        emit Invested(msg.sender, acceptedAmount);

        // Auto-resolve if fully funded
        if (totalRaised == targetAmount) {
            isResolved = true;
            isAccepted = true;
            emit FundraiseResolved(true, totalRaised);
        }
    }

    /// @notice Freelancer resolves early or if deadline passes without being completely full
    function resolveFundraise(bool acceptPartial) external {
        if (msg.sender != freelancer) revert OnlyFreelancer();
        if (isResolved) revert AlreadyResolved();
        if (block.timestamp <= fundingDeadline && totalRaised < targetAmount) revert DeadlineNotPassed();

        isResolved = true;
        isAccepted = acceptPartial && totalRaised > 0;

        emit FundraiseResolved(isAccepted, totalRaised);
    }

    /// @notice Freelancer withdraws the raised funds to use for job expenses
    function withdrawRaisedFunds() external nonReentrant {
        if (msg.sender != freelancer) revert OnlyFreelancer();
        if (!isResolved) revert NotResolved();
        if (!isAccepted) revert NotAccepted();
        if (raisedFundsWithdrawn) revert InvalidAmount();
        if (totalRaised == 0) revert InvalidAmount();

        raisedFundsWithdrawn = true;
        paymentToken.safeTransfer(freelancer, totalRaised);
    }

    function distribute(uint256 amountPaid) external nonReentrant {
        if (msg.sender != escrow) revert OnlyEscrow();
        if (amountPaid == 0) revert InvalidAmount();
        if (!isResolved || !isAccepted) revert NotAccepted();
        if (payoutDistributed) revert PayoutAlreadyDistributed();

        payoutDistributed = true;
        totalPayoutReceived = amountPaid;

        // Calculate true job profit based strictly on how much the job paid out vs how much was requested (totalRaised)
        uint256 jobProfit = amountPaid > totalRaised ? amountPaid - totalRaised : 0;
        uint256 investorProfit = (jobProfit * investorProfitShareBps) / 10000;
        
        // This is what investors ideally SHOULD get back based on the math
        uint256 idealInvestorPool = totalRaised + investorProfit;

        // Calculate how much actual money we have in this contract to distribute right now.
        // If freelancer forgot to withdraw upfront, their raised funds are still sitting here as part of the total.
        uint256 totalAvailableToDistribute = amountPaid;
        if (!raisedFundsWithdrawn) {
            totalAvailableToDistribute = amountPaid + totalRaised;
            raisedFundsWithdrawn = true; // Mark as logically withdrawn so they don't get double counted or pulled later
        }

        // Determine actual pools. 
        // We CAP the investorPool at whatever is actually available in the contract (totalAvailableToDistribute).
        // If the job severely underpaid, and the freelancer already withdrew their funds upfront, totalAvailableToDistribute 
        // stringently limits the investor pool to avoid creating insolvency / revert loops on claimInvestor().
        investorPoolTotal = idealInvestorPool > totalAvailableToDistribute ? totalAvailableToDistribute : idealInvestorPool;
        freelancerPoolTotal = totalAvailableToDistribute - investorPoolTotal;

        emit PayoutDistributedEvent(amountPaid, investorPoolTotal, freelancerPoolTotal);
    }


    /// @notice Investor claims their principal + profit from the resolved escrow payout
    function claimInvestor() external nonReentrant {
        if (!payoutDistributed) revert NotResolved();
        uint256 deposit = deposits[msg.sender];
        if (deposit == 0) revert NothingToClaim();
        if (investorClaimed[msg.sender] > 0) revert InvalidAmount();

        // Exact fair share of the investor pool
        uint256 share = (deposit * investorPoolTotal) / totalRaised;
        investorClaimed[msg.sender] = share;

        paymentToken.safeTransfer(msg.sender, share);

        if (address(stats) != address(0)) {
            stats.recordJobReturn(share);
        }
        if (address(investorRegistry) != address(0)) {
            investorRegistry.recordJobPayout(msg.sender, address(this), share);
        }

        emit InvestorClaimed(msg.sender, share);
    }

    /// @notice Freelancer claims their remainder of the reward
    function claimFreelancer() external nonReentrant {
        if (!payoutDistributed) revert NotResolved();
        uint256 amount = freelancerPoolTotal;
        if (amount == 0) revert NothingToClaim();
        if (freelancerClaimed) revert InvalidAmount();

        freelancerClaimed = true;
        paymentToken.safeTransfer(freelancer, amount);

        emit FreelancerClaimed(amount);
    }

    /// @notice Investor re-claims their exact deposit if the freelancer canceled the fundraise
    function claimRefund() external nonReentrant {
        if (!isResolved) revert NotResolved();
        if (isAccepted) revert Accepted();

        uint256 deposit = deposits[msg.sender];
        if (deposit == 0) revert NothingToClaim();
        
        deposits[msg.sender] = 0; // prevent double claim
        
        paymentToken.safeTransfer(msg.sender, deposit);
        emit RefundClaimed(msg.sender, deposit);
    }

    /// @notice Freelancer reimburses the fundraise if the job is cancelled so investors can claim refunds
    function reimburseInvestors(uint256 amount) external nonReentrant {
        if (msg.sender != freelancer) revert OnlyFreelancer();
        if (!isResolved || !isAccepted) revert NotAccepted();
        if (!raisedFundsWithdrawn) revert InvalidAmount();
        if (amount != totalRaised) revert InvalidAmount();

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Reverse the accepted state to allow refunds
        isAccepted = false;
        raisedFundsWithdrawn = false;
        
        emit FundraiseResolved(false, totalRaised); // emit state change for UI
    }

    /// @notice Returns list of all investors
    function getInvestors() external view returns (address[] memory) {
        return investors;
    }
}
