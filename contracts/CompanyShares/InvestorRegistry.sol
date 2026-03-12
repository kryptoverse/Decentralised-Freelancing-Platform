// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract InvestorRegistry is Ownable {
    struct Profile {
        string metadataURI; // IPFS hash for name, bio, image
        bool exists;
    }

    struct InvestmentStats {
        uint256 totalInvested;
        uint256 totalPayouts;
    }

    mapping(address => Profile) public profiles;

    // ==========================================
    // COMPANY SHARES TRACKING
    // ==========================================
    // Investor Address => List of Company IDs they invested in
    mapping(address => uint256[]) private companyPortfolio;
    
    // Investor Address => Company ID => Already Added?
    mapping(address => mapping(uint256 => bool)) private hasInvestedInCompany;

    // Investor Address => Company ID => Stats
    mapping(address => mapping(uint256 => InvestmentStats)) public companyInvestmentStats;

    // ==========================================
    // JOB FUNDRAISE TRACKING
    // ==========================================
    // Investor Address => List of JobFundraise Addresses they invested in
    mapping(address => address[]) private jobPortfolio;

    // Investor Address => Job Fundraise Address => Already Added?
    mapping(address => mapping(address => bool)) private hasInvestedInJob;

    // Investor Address => Job Fundraise Address => Stats
    mapping(address => mapping(address => InvestmentStats)) public jobInvestmentStats;

    // ==========================================
    // AUTHORIZATION SYSTEM
    // ==========================================
    address public companyRegistry;
    address public fundraiseFactory;

    // Mapping of authorized contracts:
    // Company Shares: ShareSale or DividendDistributor
    // Job Fundraise: JobFundraise instances deployed by Factory
    mapping(address => bool) public isAuthorizedContract;

    event ProfileUpdated(address indexed investor, string metadataURI);
    
    // Company Events
    event CompanyInvestmentRecorded(address indexed investor, uint256 indexed companyId, uint256 amount);
    event CompanyPayoutRecorded(address indexed investor, uint256 indexed companyId, uint256 amount);
    
    // Job Events
    event JobInvestmentRecorded(address indexed investor, address indexed fundraiseContract, uint256 amount);
    event JobPayoutRecorded(address indexed investor, address indexed fundraiseContract, uint256 amount);
    
    event ContractAuthorized(address indexed contractAddress);

    constructor(address initialOwner, address _companyRegistry, address _fundraiseFactory) Ownable(initialOwner) {
        companyRegistry = _companyRegistry;
        fundraiseFactory = _fundraiseFactory;
    }

    /**
     * @dev Set the CompanyRegistry & FundraiseFactory addresses. Only owner can set these.
     */
    function setRegistries(address _companyRegistry, address _fundraiseFactory) external onlyOwner {
        companyRegistry = _companyRegistry;
        fundraiseFactory = _fundraiseFactory;
    }

    /**
     * @dev Called by CompanyRegistry or FundraiseFactory to authorize their child contracts.
     */
    function addAuthorizedContract(address _contract) external {
        require(
            msg.sender == companyRegistry || msg.sender == fundraiseFactory,
            "Only registries can authorize"
        );
        isAuthorizedContract[_contract] = true;
        emit ContractAuthorized(_contract);
    }

    /**
     * @dev Called by authorized ShareSale contracts to record a company investment.
     */
    function recordInvestment(address investor, uint256 companyId, uint256 amount) external {
        require(isAuthorizedContract[msg.sender], "Caller is not authorized");

        if (!hasInvestedInCompany[investor][companyId]) {
            companyPortfolio[investor].push(companyId);
            hasInvestedInCompany[investor][companyId] = true;
        }

        companyInvestmentStats[investor][companyId].totalInvested += amount;
        emit CompanyInvestmentRecorded(investor, companyId, amount);
    }

    /**
     * @dev Called by authorized DividendDistributor contracts to record a company payout.
     */
    function recordPayout(address investor, uint256 companyId, uint256 amount) external {
        require(isAuthorizedContract[msg.sender], "Caller is not authorized");

        companyInvestmentStats[investor][companyId].totalPayouts += amount;
        emit CompanyPayoutRecorded(investor, companyId, amount);
    }

    /**
     * @dev Called by authorized JobFundraise contracts to record a job investment.
     */
    function recordJobInvestment(address investor, address fundraiseContract, uint256 amount) external {
        require(isAuthorizedContract[msg.sender], "Caller is not authorized");

        if (!hasInvestedInJob[investor][fundraiseContract]) {
            jobPortfolio[investor].push(fundraiseContract);
            hasInvestedInJob[investor][fundraiseContract] = true;
        }

        jobInvestmentStats[investor][fundraiseContract].totalInvested += amount;
        emit JobInvestmentRecorded(investor, fundraiseContract, amount);
    }

    /**
     * @dev Called by authorized JobFundraise contracts to record a job payout/refund.
     */
    function recordJobPayout(address investor, address fundraiseContract, uint256 amount) external {
        require(isAuthorizedContract[msg.sender], "Caller is not authorized");

        jobInvestmentStats[investor][fundraiseContract].totalPayouts += amount;
        emit JobPayoutRecorded(investor, fundraiseContract, amount);
    }

    /**
     * @dev Users can update their own profile.
     */
    function registerProfile(string memory _metadataURI) external {
        profiles[msg.sender] = Profile(_metadataURI, true);
        emit ProfileUpdated(msg.sender, _metadataURI);
    }

    // ==========================================
    // VIEW FUNCTIONS
    // ==========================================

    function getPortfolio(address investor) external view returns (uint256[] memory) {
        return companyPortfolio[investor];
    }

    function getInvestmentStats(address investor, uint256 companyId) external view returns (uint256, uint256) {
        InvestmentStats memory stats = companyInvestmentStats[investor][companyId];
        return (stats.totalInvested, stats.totalPayouts);
    }

    function getJobPortfolio(address investor) external view returns (address[] memory) {
        return jobPortfolio[investor];
    }

    function getJobInvestmentStats(address investor, address fundraiseContract) external view returns (uint256, uint256) {
        InvestmentStats memory stats = jobInvestmentStats[investor][fundraiseContract];
        return (stats.totalInvested, stats.totalPayouts);
    }
}
