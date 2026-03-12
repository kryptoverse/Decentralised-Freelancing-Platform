// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IShareTokenView {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

interface IInvestorRegistryDistributor {
    function recordPayout(address investor, uint256 companyId, uint256 amount) external;
}

/// @title DividendDistributor
/// @notice Gas-efficient dividend distribution using magnified dividend-per-share accumulator
/// @dev No iteration over holders; supports transfers, mints, and burns correctly
contract DividendDistributor is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;
    IInvestorRegistryDistributor public immutable investorRegistry;
    uint256 public immutable companyId;

    address public shareToken;
    address public vault;
    
    bool private shareTokenLocked;
    bool private vaultLocked;

    uint256 private constant MAGNITUDE = 2 ** 128;
    uint256 public magnifiedDividendPerShare;

    mapping(address => int256) public magnifiedCorrections;
    mapping(address => uint256) public withdrawnDividends;

    uint256 public totalDeposited;
    uint256 public totalClaimed;

    // Minimum deposit to prevent precision loss
    uint256 public constant MIN_DIVIDEND_DEPOSIT = 1000; // 0.001 USDT (6 decimals)

    event ShareTokenSet(address indexed shareToken);
    event VaultSet(address indexed vault);
    event DividendsDeposited(uint256 amount, uint256 newMagnifiedDividendPerShare);
    event DividendClaimed(address indexed holder, uint256 amount);

    error OnlyShareToken();
    error OnlyVault();
    error InvalidAddress();
    error AlreadySet();
    error InvalidAmount();
    error NoShares();
    error AmountTooSmall();
    error MagnitudeOverflow();

    /// @notice Initialize the dividend distributor
    /// @param _paymentToken Stablecoin address (e.g., USDT)
    /// @param initialOwner Initial owner (registry, then transferred to company owner)
    /// @param _investorRegistry Address of InvestorRegistry
    /// @param _companyId Company ID
    constructor(
        address _paymentToken, 
        address initialOwner,
        address _investorRegistry,
        uint256 _companyId
    ) Ownable(initialOwner) {
        if (_paymentToken == address(0)) revert InvalidAddress();
        
        paymentToken = IERC20(_paymentToken);
        investorRegistry = IInvestorRegistryDistributor(_investorRegistry);
        companyId = _companyId;
    }

    /// @notice Set the share token address (one-time only)
    /// @param _shareToken CompanyShareToken address
    function setShareToken(address _shareToken) external onlyOwner {
        if (_shareToken == address(0)) revert InvalidAddress();
        if (shareTokenLocked) revert AlreadySet();
        
        shareToken = _shareToken;
        shareTokenLocked = true;
        
        emit ShareTokenSet(_shareToken);
    }

    /// @notice Set the vault address (one-time only)
    /// @param _vault CompanyVault address
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert InvalidAddress();
        if (vaultLocked) revert AlreadySet();
        
        vault = _vault;
        vaultLocked = true;
        
        emit VaultSet(_vault);
    }

    /// @notice Handle transfer/mint/burn events from share token
    /// @dev Called automatically by share token on every _update
    /// @param from Sender address (address(0) for mints)
    /// @param to Recipient address (address(0) for burns)
    /// @param amount Amount transferred
    function handleTransfer(address from, address to, uint256 amount) external {
        if (msg.sender != shareToken) revert OnlyShareToken();
        if (amount == 0) return; // Skip zero-amount transfers

        // Calculate magnified correction with overflow protection
        uint256 magnifiedAmount;
        unchecked {
            magnifiedAmount = magnifiedDividendPerShare * amount;
        }
        
        // Safe casting check
        if (magnifiedAmount > uint256(type(int256).max)) revert MagnitudeOverflow();
        int256 magCorrection = int256(magnifiedAmount);

        // Update corrections based on transfer type
        if (from == address(0)) {
            // Mint: decrease recipient's correction
            magnifiedCorrections[to] -= magCorrection;
        } else if (to == address(0)) {
            // Burn: increase sender's correction
            magnifiedCorrections[from] += magCorrection;
        } else {
            // Transfer: adjust both parties
            magnifiedCorrections[from] += magCorrection;
            magnifiedCorrections[to] -= magCorrection;
        }
    }

    /// @notice Deposit dividends from vault (called by vault)
    /// @param amount Amount of USDT to distribute
    function depositDividends(uint256 amount) external nonReentrant {
        if (msg.sender != vault) revert OnlyVault();
        if (amount == 0) revert InvalidAmount();
        if (amount < MIN_DIVIDEND_DEPOSIT) revert AmountTooSmall();
        if (shareToken == address(0)) revert InvalidAddress();

        uint256 supply = IShareTokenView(shareToken).totalSupply();
        if (supply == 0) revert NoShares();

        // Pull USDT from vault
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update magnified dividend per share with overflow protection
        uint256 magnifiedIncrease;
        unchecked {
            magnifiedIncrease = (amount * MAGNITUDE) / supply;
        }
        
        magnifiedDividendPerShare += magnifiedIncrease;
        totalDeposited += amount;

        emit DividendsDeposited(amount, magnifiedDividendPerShare);
    }

    /// @notice Calculate withdrawable dividends for a holder
    /// @param holder Address to check
    /// @return Amount of dividends available to claim
    function withdrawableDividendOf(address holder) public view returns (uint256) {
        uint256 accum = accumulativeDividendOf(holder);
        uint256 already = withdrawnDividends[holder];
        if (accum <= already) return 0;
        return accum - already;
    }

    /// @notice Calculate total accumulated dividends for a holder
    /// @param holder Address to check
    /// @return Total dividends accumulated (including already withdrawn)
    function accumulativeDividendOf(address holder) public view returns (uint256) {
        if (shareToken == address(0)) return 0;
        
        uint256 bal = IShareTokenView(shareToken).balanceOf(holder);
        if (bal == 0) return 0;

        // Calculate with overflow protection
        uint256 magnifiedAmount;
        unchecked {
            magnifiedAmount = magnifiedDividendPerShare * bal;
        }

        // Apply correction
        int256 corrected = int256(magnifiedAmount) + magnifiedCorrections[holder];
        if (corrected <= 0) return 0;

        return uint256(corrected) / MAGNITUDE;
    }

    /// @notice Claim dividends for caller
    /// @return amount Amount of dividends claimed
    function claim() external nonReentrant returns (uint256 amount) {
        amount = _claim(msg.sender);
    }

    /// @notice Claim dividends on behalf of a holder (for emergency recovery)
    /// @param holder Address to claim for
    /// @return amount Amount of dividends claimed
    function claimFor(address holder) external nonReentrant returns (uint256 amount) {
        amount = _claim(holder);
    }

    function _claim(address holder) private returns (uint256 amount) {
        if (holder == address(0)) revert InvalidAddress();
        
        amount = withdrawableDividendOf(holder);
        if (amount == 0) return 0;

        withdrawnDividends[holder] += amount;
        totalClaimed += amount;

        paymentToken.safeTransfer(holder, amount);
        
        // Record payout in registry
        if (address(investorRegistry) != address(0)) {
            investorRegistry.recordPayout(holder, companyId, amount);
        }

        emit DividendClaimed(holder, amount);
    }

    /// @notice Get distributor status
    function getDistributorStatus() external view returns (
        uint256 _totalDeposited,
        uint256 _totalClaimed,
        uint256 _balance
    ) {
        return (
            totalDeposited,
            totalClaimed,
            paymentToken.balanceOf(address(this))
        );
    }
}