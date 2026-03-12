// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ICompanyShareToken {
    function mint(address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
}

interface ICompanyVault {
    function depositRaisedFrom(address buyer, uint256 amount) external;
}

interface IInvestorRegistrySale {
    function recordInvestment(address investor, uint256 companyId, uint256 amount) external;
}

/// @title ShareSale
/// @notice Manages fundraising rounds and share purchases for a company
/// @dev Supports discrete funding rounds with full dilution model
contract ShareSale is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;
    ICompanyShareToken public immutable shareToken;
    ICompanyVault public immutable vault;
    address public immutable companyOwner;

    address public immutable feeRecipient;
    uint96 public immutable feeBps;

    // Portfolio Tracking
    IInvestorRegistrySale public immutable investorRegistry;
    uint256 public immutable companyId;

    // Round configuration
    uint256 public pricePerShare;
    uint256 public roundSharesRemaining;
    uint256 public roundId;
    bool public roundActive;

    // Safety limits
    uint256 public constant MAX_PRICE_PER_SHARE = 1e12; // Max price: 1M USDT per share
    uint256 public constant MAX_SHARES_PER_PURCHASE = 1e27; // 1 billion shares max per tx

    event RoundStarted(uint256 indexed roundId, uint256 pricePerShare, uint256 sharesMinted);
    event RoundEnded(uint256 indexed roundId, uint256 sharesRemaining);
    event SharesBought(uint256 indexed roundId, address indexed buyer, uint256 usdtPaid, uint256 sharesReceived);
    event EmergencyPaused(address indexed by);
    event EmergencyUnpaused(address indexed by);

    error OnlyCompanyOwner();
    error InvalidPrice();
    error InvalidAmount();
    error InsufficientRoundLiquidity();
    error RoundNotActive();
    error RoundAlreadyActive();
    error PriceOverflow();
    error PurchaseTooLarge();

    modifier onlyCompanyOwner() {
        if (msg.sender != companyOwner) revert OnlyCompanyOwner();
        _;
    }

    /// @notice Initialize the sale contract
    constructor(
        address _paymentToken,
        address _shareToken,
        address _vault,
        address _companyOwner,
        address _feeRecipient,
        uint96 _feeBps,
        address _investorRegistry,
        uint256 _companyId
    ) {
        if (_paymentToken == address(0) || _shareToken == address(0) || _vault == address(0)) 
            revert InvalidAmount();
        if (_companyOwner == address(0)) revert OnlyCompanyOwner();
        if (_feeRecipient == address(0)) revert InvalidAmount();
        if (_feeBps > 1000) revert InvalidPrice();

        paymentToken = IERC20(_paymentToken);
        shareToken = ICompanyShareToken(_shareToken);
        vault = ICompanyVault(_vault);
        companyOwner = _companyOwner;
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;

        investorRegistry = IInvestorRegistrySale(_investorRegistry);
        companyId = _companyId;
    }

    /// @notice Start a new fundraising round
    function startRound(uint256 _pricePerShare, uint256 sharesToMint) 
        external 
        onlyCompanyOwner 
        nonReentrant 
        whenNotPaused 
    {
        if (roundActive) revert RoundAlreadyActive();
        if (_pricePerShare == 0 || _pricePerShare > MAX_PRICE_PER_SHARE) revert InvalidPrice();
        if (sharesToMint == 0) revert InvalidAmount();

        shareToken.mint(address(this), sharesToMint);

        pricePerShare = _pricePerShare;
        roundSharesRemaining = sharesToMint;
        roundId++;
        roundActive = true;

        emit RoundStarted(roundId, _pricePerShare, sharesToMint);
    }

    /// @notice End the current fundraising round
    function endRound() external onlyCompanyOwner nonReentrant {
        if (!roundActive) revert RoundNotActive();
        
        uint256 remaining = roundSharesRemaining;
        roundActive = false;
        roundSharesRemaining = 0;
        pricePerShare = 0;

        emit RoundEnded(roundId, remaining);
    }

    /// @notice Buy exact number of shares
    function buyExactShares(uint256 sharesWei) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 usdtCost) 
    {
        if (!roundActive) revert RoundNotActive();
        if (sharesWei == 0 || sharesWei > MAX_SHARES_PER_PURCHASE) revert InvalidAmount();
        if (sharesWei > roundSharesRemaining) revert InsufficientRoundLiquidity();

        usdtCost = _calculateCost(sharesWei);
        if (usdtCost == 0) revert InvalidAmount();

        uint256 fee = (usdtCost * feeBps) / 10000;
        uint256 net = usdtCost - fee;

        roundSharesRemaining -= sharesWei;

        if (fee > 0) {
            paymentToken.safeTransferFrom(msg.sender, feeRecipient, fee);
        }

        vault.depositRaisedFrom(msg.sender, net);

        bool ok = shareToken.transfer(msg.sender, sharesWei);
        if (!ok) revert InvalidAmount();

        // Record investment in registry with AMOUNT
        if (address(investorRegistry) != address(0)) {
            investorRegistry.recordInvestment(msg.sender, companyId, usdtCost);
        }

        emit SharesBought(roundId, msg.sender, usdtCost, sharesWei);
    }

    /// @notice Buy shares with a USDT amount
    function buyWithUSDT(uint256 usdtAmount) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 sharesWei) 
    {
        if (!roundActive) revert RoundNotActive();
        if (usdtAmount == 0) revert InvalidAmount();

        sharesWei = _calculateShares(usdtAmount);
        if (sharesWei == 0) revert InvalidAmount();
        if (sharesWei > MAX_SHARES_PER_PURCHASE) revert PurchaseTooLarge();
        if (sharesWei > roundSharesRemaining) revert InsufficientRoundLiquidity();

        uint256 cost = _calculateCost(sharesWei);
        if (cost == 0) revert InvalidAmount();

        uint256 fee = (cost * feeBps) / 10000;
        uint256 net = cost - fee;

        roundSharesRemaining -= sharesWei;

        if (fee > 0) {
            paymentToken.safeTransferFrom(msg.sender, feeRecipient, fee);
        }

        vault.depositRaisedFrom(msg.sender, net);

        bool ok = shareToken.transfer(msg.sender, sharesWei);
        if (!ok) revert InvalidAmount();

        // Record investment in registry with AMOUNT
        if (address(investorRegistry) != address(0)) {
            investorRegistry.recordInvestment(msg.sender, companyId, cost);
        }

        emit SharesBought(roundId, msg.sender, cost, sharesWei);
    }

    function pause() external onlyCompanyOwner {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyCompanyOwner {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    function _calculateCost(uint256 sharesWei) private view returns (uint256) {
        if (sharesWei > type(uint256).max / pricePerShare) revert PriceOverflow();
        return (sharesWei * pricePerShare) / 1e18;
    }

    function _calculateShares(uint256 usdtAmount) private view returns (uint256) {
        if (usdtAmount > type(uint256).max / 1e18) revert PriceOverflow();
        return (usdtAmount * 1e18) / pricePerShare;
    }

    function getRoundInfo() external view returns (
        uint256 _roundId,
        uint256 _pricePerShare,
        uint256 _sharesRemaining,
        bool _active
    ) {
        return (roundId, pricePerShare, roundSharesRemaining, roundActive);
    }
}