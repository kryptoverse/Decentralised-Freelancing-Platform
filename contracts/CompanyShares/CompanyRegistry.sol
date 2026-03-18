// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./CompanyShareToken.sol";
import "./DividendDistributor.sol";
import "./CompanyVault.sol";
import "./ShareSale.sol";
import "./InvestorRegistry.sol";

interface IFreelancerFactory {
    function freelancerProfile(address freelancer) external view returns (address);
    function linkVaultToProfile(address freelancer, address vault) external;
}

/// @title CompanyRegistry
/// @notice Factory contract for deploying and managing tokenized companies
/// @dev Enforces one company per owner and handles deployment of all company modules
contract CompanyRegistry is Ownable2Step {
    IERC20 public immutable paymentToken;

    uint96 public platformFeeBps; // e.g. 100 = 1%
    address public platformFeeRecipient;

    // Global Investor Registry
    InvestorRegistry public investorRegistry;

    // Freelancer Factory
    IFreelancerFactory public freelancerFactory;

    uint256 public nextCompanyId = 1;
    uint256 public totalCompanies;

    struct Company {
        address owner;
        address token;
        address sale;
        address vault;
        address distributor;
        string metadataURI;
        string sector;
        bool exists;
    }

    mapping(uint256 => Company) public companies;
    mapping(address => uint256) public ownerToCompanyId;
    mapping(address => uint256) public tokenToCompanyId;

    event CompanyCreated(
        uint256 indexed companyId,
        address indexed owner,
        address token,
        address sale,
        address vault,
        address distributor,
        string metadataURI,
        string sector
    );

    event PlatformFeeUpdated(uint96 feeBps, address recipient);

    error InvalidPaymentToken();
    error InvalidFeeRecipient();
    error FeeTooHigh();
    error OwnerAlreadyHasCompany();
    error EmptyNameOrSymbol();
    error InvalidWithdrawBps();
    error MetadataURITooLong();
    error CompanyNotFound();
    error InvalidAddress();
    error NoFreelancerProfile();

    /// @notice Initialize the registry with payment token and platform fee configuration
    /// @param _paymentToken Address of the stablecoin (e.g., USDT)
    /// @param _platformFeeBps Platform fee in basis points (max 1000 = 10%)
    /// @param _platformFeeRecipient Address to receive platform fees
    /// @param _freelancerFactory Address of the freelancer factory
    constructor(
        address _paymentToken,
        uint96 _platformFeeBps,
        address _platformFeeRecipient,
        address _freelancerFactory
    ) Ownable(msg.sender) {
        if (_paymentToken == address(0)) revert InvalidPaymentToken();
        if (_platformFeeRecipient == address(0)) revert InvalidFeeRecipient();
        if (_freelancerFactory == address(0)) revert InvalidAddress();
        if (_platformFeeBps > 1000) revert FeeTooHigh();

        paymentToken = IERC20(_paymentToken);
        platformFeeBps = _platformFeeBps;
        platformFeeRecipient = _platformFeeRecipient;
        freelancerFactory = IFreelancerFactory(_freelancerFactory);
        
        // Deploy Investor Registry (owned by deployer, authorizing this registry)
        investorRegistry = new InvestorRegistry(msg.sender, address(this), address(0));
    }

    /// @notice Update platform fee configuration (only registry owner)
    /// @param _feeBps New fee in basis points (max 1000 = 10%)
    /// @param _recipient New fee recipient address
    function setPlatformFee(uint96 _feeBps, address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert InvalidFeeRecipient();
        if (_feeBps > 1000) revert FeeTooHigh();
        
        platformFeeBps = _feeBps;
        platformFeeRecipient = _recipient;
        
        emit PlatformFeeUpdated(_feeBps, _recipient);
    }

    /// @notice Create a new tokenized company with all required modules
    /// @dev Deploys ShareToken, DividendDistributor, Vault, and Sale contracts
    /// @param name Share token name
    /// @param symbol Share token symbol
    /// @param metadataURI IPFS/URL metadata for frontend display
    /// @param sector The sector or category of the company
    /// @param smartWalletAddress Optional Smart Wallet address to link the company vault to
    /// @return companyId The unique identifier for the created company
    function createCompany(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        string calldata sector,
        address smartWalletAddress
    ) external returns (uint256 companyId) {
        if (ownerToCompanyId[msg.sender] != 0) revert OwnerAlreadyHasCompany();
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyNameOrSymbol();
        if (bytes(metadataURI).length > 512) revert MetadataURITooLong();

        companyId = nextCompanyId++;
        totalCompanies++;

        // 1) Deploy DividendDistributor (temporary owner = registry)
        DividendDistributor distributor = new DividendDistributor(
            address(paymentToken),
            address(this),
            address(investorRegistry),
            companyId
        );

        // Authorize distributor to record payouts
        investorRegistry.addAuthorizedContract(address(distributor));

        // 2) Deploy ShareToken (temporary owner = registry)
        CompanyShareToken token = new CompanyShareToken(
            name,
            symbol,
            address(distributor),
            address(this)
        );

        // Wire distributor with share token
        distributor.setShareToken(address(token));

        // 3) Deploy Vault (initially owned by registry for setup)
        // With Smart Revenue Vault, businessWithdrawBps is removed (hardcoded rules apply)
        CompanyVault vault = new CompanyVault(
            address(paymentToken),
            address(this), // Registry owns initially
            10000, // raisedWithdrawBps = 100%
            address(this) // Registry address for setting profile later
        );

        // If user submitted their Smart Wallet address, look up its profile and link the vault
        address profileAddr = address(0);
        if (smartWalletAddress != address(0)) {
            profileAddr = freelancerFactory.freelancerProfile(smartWalletAddress);
            if (profileAddr != address(0)) {
                vault.setProfile(profileAddr);
            }
        }

        // Wire distributor with vault
        distributor.setVault(address(vault));

        // 4) Deploy Sale contract (company owner controls rounds)
        ShareSale sale = new ShareSale(
            address(paymentToken),
            address(token),
            address(vault),
            msg.sender,
            platformFeeRecipient,
            platformFeeBps,
            address(investorRegistry),
            companyId
        );

        // Authorize sale contract to record investments
        investorRegistry.addAuthorizedContract(address(sale));

        // CRITICAL FIX: Wire vault with sale contract
        vault.setSale(address(sale));
        
        // Wire vault with distributor
        vault.setDistributor(address(distributor));

        // Set sale contract as the minter
        token.setSaleContract(address(sale));

        // Transfer ownership of all ownable contracts to company owner
        token.transferOwnership(msg.sender);
        distributor.transferOwnership(msg.sender);
        vault.transferOwnership(msg.sender);

        // Store company data
        Company memory c = Company({
            owner: msg.sender,
            token: address(token),
            sale: address(sale),
            vault: address(vault),
            distributor: address(distributor),
            metadataURI: metadataURI,
            sector: sector,
            exists: true
        });

        companies[companyId] = c;
        ownerToCompanyId[msg.sender] = companyId;
        tokenToCompanyId[address(token)] = companyId;

        // Auto-link vault to freelancer profile IF the user passed a valid smart wallet
        if (smartWalletAddress != address(0) && freelancerFactory.freelancerProfile(smartWalletAddress) != address(0)) {
            freelancerFactory.linkVaultToProfile(smartWalletAddress, address(vault));
        }

        emit CompanyCreated(
            companyId,
            msg.sender,
            c.token,
            c.sale,
            c.vault,
            c.distributor,
            metadataURI,
            sector
        );
    }

    /// @notice Get company details by ID
    /// @param companyId The company identifier
    /// @return Company struct with all addresses and metadata
    function getCompany(uint256 companyId) external view returns (Company memory) {
        if (!companies[companyId].exists) revert CompanyNotFound();
        return companies[companyId];
    }

    /// @notice Get total number of companies created
    /// @return Total company count
    function getCompanyCount() external view returns (uint256) {
        return totalCompanies;
    }

    /// @notice Link an existing company vault to a freelancer profile AFTER creation
    /// @dev Used if the EOA created the company before the Smart Wallet registered a profile
    /// @param smartWalletAddress The Smart Wallet address that owns the freelancer profile
    function linkFreelancerProfile(address smartWalletAddress) external {
        uint256 companyId = ownerToCompanyId[msg.sender];
        if (companyId == 0) revert CompanyNotFound();

        address profileAddr = freelancerFactory.freelancerProfile(smartWalletAddress);
        if (profileAddr == address(0)) revert NoFreelancerProfile();

        address vault = companies[companyId].vault;
        
        // Link Vault to Profile in the Factory
        freelancerFactory.linkVaultToProfile(smartWalletAddress, vault);

        // Tell the Vault about the Profile
        CompanyVault(vault).setProfile(profileAddr);
    }
}