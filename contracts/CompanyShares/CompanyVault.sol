// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IDividendDistributor {
    function depositDividends(uint256 amount) external;
}

interface IFreelancerProfileForVault {
    function isEscrowActive(address escrow) external view returns (bool);
}

/// @title CompanyVault
/// @notice Central treasury for company fundraising and business revenue
/// @dev Manages separate accounting with "Smart Revenue" protection rules
contract CompanyVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;

    // --- Accounting Buckets ---
    uint256 public raisedTotal;
    uint256 public raisedWithdrawn;
    
    // Analytics Stats
    uint256 public totalRevenue;
    uint256 public totalExpenses;
    uint256 public totalDistributed;

    // Period Accounting
    uint256 public periodRevenue;
    uint256 public periodExpenses;
    uint256 public ownerWithdrawable; // Funds available for owner to withdraw

    // --- Smart Revenue Rules (Hardcoded for Protection) ---
    uint96 public constant MIN_REVENUE_SHARE_BPS = 1000; // 10% of Revenue (Floor)
    uint96 public constant EXPENSE_CAP_BPS = 7000;       // 70% of Revenue (Cap)
    uint96 public constant PROFIT_SHARE_BPS = 4000;      // 40% of Net Profit
    uint256 public constant SOLO_CLAIM_COOLDOWN = 30 days;

    // Withdrawal limits for Raised Funds
    uint96 public immutable raisedWithdrawBps;
    address public immutable registry;

    // Contract addresses (set once)
    address public sale;
    address public distributor;
    address public profile;
    uint256 public lastSoloClaimTimestamp;

    bool private saleLocked;
    bool private distributorLocked;

    // Revenue depositor whitelist
    mapping(address => bool) public isRevenueDepositor;

    event SaleSet(address indexed sale);
    event DistributorSet(address indexed distributor);
    event ProfileSet(address indexed profile);
    event RevenueDepositorSet(address indexed depositor, bool allowed);
    event RaisedDeposited(address indexed buyer, uint256 amount);
    event BusinessRevenueDeposited(address indexed from, uint256 amount);
    event WithdrawRaised(address indexed to, uint256 amount);
    event WithdrawBusiness(address indexed to, uint256 amount);
    event DividendsDeposited(uint256 amount);
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    
    // New Events
    event ExpenseSubmitted(uint256 claimed, uint256 accepted);
    event PeriodClosed(uint256 revenue, uint256 expenses, uint256 investorPayout, uint256 ownerPayout);
    event MonthlySoloClaimed(address indexed owner, uint256 amount);

    error OnlySale();
    error OnlyRevenueDepositor();
    error InvalidAddress();
    error InvalidAmount();
    error AlreadySet();
    error ExceedsWithdrawable();
    error InsufficientBalance();
    error DistributorNotSet();
    error TooEarly();
    error Unauthorized();

    /// @notice Initialize the vault
    /// @param _paymentToken Stablecoin address (e.g., USDT)
    /// @param companyOwner Company owner address
    /// @param _raisedWithdrawBps Percentage of raised funds withdrawable (typically 10000 = 100%)
    constructor(
        address _paymentToken,
        address companyOwner,
        uint96 _raisedWithdrawBps,
        address _registry
    ) Ownable(companyOwner) {
        if (_paymentToken == address(0)) revert InvalidAddress();
        if (companyOwner == address(0)) revert InvalidAddress();
        if (_raisedWithdrawBps > 10000) revert InvalidAmount();
        if (_registry == address(0)) revert InvalidAddress();

        paymentToken = IERC20(_paymentToken);
        raisedWithdrawBps = _raisedWithdrawBps;
        registry = _registry;
    }

    /// @notice Set the sale contract address (one-time only)
    function setSale(address _sale) external onlyOwner {
        if (_sale == address(0)) revert InvalidAddress();
        if (saleLocked) revert AlreadySet();
        
        sale = _sale;
        saleLocked = true;
        emit SaleSet(_sale);
    }

    /// @notice Set the distributor contract address (one-time only)
    function setDistributor(address _distributor) external onlyOwner {
        if (_distributor == address(0)) revert InvalidAddress();
        if (distributorLocked) revert AlreadySet();
        
        distributor = _distributor;
        distributorLocked = true;
        emit DistributorSet(_distributor);
    }

    /// @notice Set the freelancer profile address
    function setProfile(address _profile) external {
        if (msg.sender != owner() && msg.sender != registry) revert Unauthorized();
        if (_profile == address(0)) revert InvalidAddress();
        
        profile = _profile;
        emit ProfileSet(_profile);
    }

    /// @notice Add or remove revenue depositor (e.g., freelancing escrow)
    function setRevenueDepositor(address depositor, bool allowed) external onlyOwner {
        if (depositor == address(0)) revert InvalidAddress();
        isRevenueDepositor[depositor] = allowed;
        emit RevenueDepositorSet(depositor, allowed);
    }

    /// @notice Deposit raised funds from share sales
    function depositRaisedFrom(address buyer, uint256 amount) external {
        if (msg.sender != sale) revert OnlySale();
        if (amount == 0) revert InvalidAmount();

        paymentToken.safeTransferFrom(buyer, address(this), amount);
        raisedTotal += amount;
        emit RaisedDeposited(buyer, amount);
    }

    /// @notice Deposit business revenue (called by whitelisted depositors or active escrows)
    function depositRevenue(uint256 amount) external {
        if (!isRevenueDepositor[msg.sender]) {
            if (profile == address(0) || !IFreelancerProfileForVault(profile).isEscrowActive(msg.sender)) {
                revert OnlyRevenueDepositor();
            }
        }
        if (amount == 0) revert InvalidAmount();

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        
        totalRevenue += amount;
        periodRevenue += amount;
        
        emit BusinessRevenueDeposited(msg.sender, amount);
    }

    /// @notice Submit expenses for the current period
    /// @dev Capped at EXPENSE_CAP_BPS of current period revenue
    /// @param amount Amount of expenses to claim
    function submitExpenses(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidAmount();

        // Calculate max allowed expenses based on revenue
        uint256 maxAllowed = (periodRevenue * EXPENSE_CAP_BPS) / 10000;
        uint256 current = periodExpenses;
        
        uint256 accepted = amount;
        if (current + amount > maxAllowed) {
            // Cap it
            if (current >= maxAllowed) {
                accepted = 0;
            } else {
                accepted = maxAllowed - current;
            }
        }

        periodExpenses += accepted;
        totalExpenses += accepted;

        emit ExpenseSubmitted(amount, accepted);
    }

    /// @notice Close the current period and distribute funds
    /// @dev Calculates Investor Pool vs Owner Pool based on Smart Rules
    function closePeriod() external onlyOwner nonReentrant {
        if (distributor == address(0)) revert DistributorNotSet();

        uint256 revenue = periodRevenue;
        uint256 expenses = periodExpenses; // This is already capped by submitExpenses

        uint256 netProfit = 0;
        if (revenue > expenses) {
            netProfit = revenue - expenses;
        }

        // Rule A: Revenue Floor
        uint256 minPayout = (revenue * MIN_REVENUE_SHARE_BPS) / 10000;

        // Rule C: Profit Share
        uint256 profitPayout = (netProfit * PROFIT_SHARE_BPS) / 10000;

        // Investor Pool is Max(Floor, ProfitShare)
        uint256 investorPool = minPayout > profitPayout ? minPayout : profitPayout;

        // Ensure we don't distribute more than available (sanity check)
        uint256 vaultBalance = paymentToken.balanceOf(address(this));
        if (investorPool > vaultBalance) {
            investorPool = vaultBalance;
        }

        // Remaining goes to Owner (Expenses Reimbursement + Retained Earnings)
        // Mathematically: Remaining = Revenue - InvestorPool
        // But since funds are commingled, we rely on calculations.
        // Owner gets whatever is not InvestorPool from this period's revenue.
        // Wait, if InvestorPool > NetProfit (due to Floor), Owner eats into expenses?
        // Yes, Floor protection is strong.
        
        uint256 ownerShare = 0;
        if (revenue > investorPool) {
            ownerShare = revenue - investorPool;
        }

        // 1. Distribute to Investors
        if (investorPool > 0) {
            paymentToken.forceApprove(distributor, investorPool);
            IDividendDistributor(distributor).depositDividends(investorPool);
            totalDistributed += investorPool;

            emit DividendsDeposited(investorPool);
        }

        // 2. Add remaining to Owner Withdrawable
        ownerWithdrawable += ownerShare;

        // 3. Reset Period
        emit PeriodClosed(revenue, expenses, investorPool, ownerShare);
        
        periodRevenue = 0;
        periodExpenses = 0;
    }

    /// @notice Claim revenue from one job specifically for the owner (Monthly Benefit)
    /// @dev Excludes the amount from future period distribution
    /// @param amount Amount to claim (should correspond to the job payout)
    function claimMonthlySoloJob(uint256 amount) external onlyOwner nonReentrant {
        if (lastSoloClaimTimestamp > 0 && block.timestamp < lastSoloClaimTimestamp + SOLO_CLAIM_COOLDOWN) revert TooEarly();
        if (amount == 0) revert InvalidAmount();
        if (amount > periodRevenue) revert ExceedsWithdrawable();

        periodRevenue -= amount;
        lastSoloClaimTimestamp = block.timestamp;

        paymentToken.safeTransfer(owner(), amount);
        emit MonthlySoloClaimed(owner(), amount);
    }

    /// @notice Calculate withdrawable raised funds
    function raisedWithdrawable() public view returns (uint256) {
        uint256 allowed = (raisedTotal * raisedWithdrawBps) / 10000;
        if (allowed <= raisedWithdrawn) return 0;
        return allowed - raisedWithdrawn;
    }

    /// @notice Withdraw raised funds (company owner only)
    function withdrawRaised(uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        
        uint256 available = raisedWithdrawable();
        if (amount > available) revert ExceedsWithdrawable();

        raisedWithdrawn += amount;
        paymentToken.safeTransfer(to, amount);
        
        emit WithdrawRaised(to, amount);
    }

    /// @notice Withdraw business profit/reimbursement (company owner only)
    /// @dev Only funds that have cleared `closePeriod` are withdrawable
    function withdrawBusiness(uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        
        if (amount > ownerWithdrawable) revert ExceedsWithdrawable();

        ownerWithdrawable -= amount;
        paymentToken.safeTransfer(to, amount);
        
        emit WithdrawBusiness(to, amount);
    }

    /// @notice Emergency withdrawal
    function emergencyWithdraw(uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 balance = paymentToken.balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance();

        paymentToken.safeTransfer(to, amount);
        emit EmergencyWithdrawal(to, amount);
    }

    /// @notice Get vault balance
    function getBalance() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }

    /// @notice Get comprehensive vault status
    function getVaultStatus() external view returns (
        uint256 _raisedTotal,
        uint256 _raisedWithdrawn,
        uint256 _totalRevenue,
        uint256 _totalDistributed,
        uint256 _periodRevenue,
        uint256 _periodExpenses
    ) {
        return (
            raisedTotal,
            raisedWithdrawn,
            totalRevenue,
            totalDistributed,
            periodRevenue,
            periodExpenses
        );
    }
}