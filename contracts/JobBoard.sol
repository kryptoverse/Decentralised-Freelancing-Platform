// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title JobBoard v3 — On-chain Job Board with Applications + Proposals
 */

interface IUSDCMinimal {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IFreelancerFactory {
    function freelancerProfile(address freelancer) external view returns (address);
}

contract JobBoard {

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error NotOwner();
    error NotClient();
    error NotAllowedFactory();
    error ZeroAddress();
    error NotOpen();
    error InvalidStatus();
    error JobNotFound();
    error AlreadyHiredOrClosed();
    error TooManyTags();
    error NotReopenable();
    error NotExpired();
    error KYCGated();
    error WrongBond();
    error USDCNotSet();
    error Reentrancy();

    // NEW APPLICATION ERRORS
    error AlreadyApplied();
    error ApplicationNotFound();
    error NotFreelancer();

    // NEW DIRECT OFFER ERRORS
    error OfferNotFound();
    error OfferExpired();
    error OfferAlreadyProcessed();
    error NotOfferRecipient();
    error InsufficientAllowance();
    error InsufficientBalance();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event FactoryAllowed(address indexed factory, bool allowed);
    event PausedSet(bool paused);
    event GasSponsorshipSet(bool enabled);
    event AntiSpamModeSet(uint8 mode, uint256 postingBondUSDC);
    event USDCSet(address indexed usdc);
    event KYCSet(address indexed user, bool isVerified);

    event JobPosted(
        uint256 indexed jobId,
        address indexed client,
        string title,
        string descriptionURI,
        uint256 budgetUSDC,
        bytes32[] tags,
        uint64 expiresAt
    );
    event JobUpdated(
        uint256 indexed jobId,
        string title,
        string descriptionURI,
        uint256 budgetUSDC,
        bytes32[] tags,
        uint64 expiresAt
    );
    event JobCancelled(uint256 indexed jobId, address indexed client);
    event JobHired(
        uint256 indexed jobId,
        address indexed client,
        address indexed freelancer,
        address escrow
    );
    event JobCompleted(
        uint256 indexed jobId,
        address indexed client,
        address indexed freelancer,
        address escrow
    );
    event JobExpiredClosed(uint256 indexed jobId, uint64 expiresAt);
    event JobReopened(uint256 indexed jobId, uint64 newExpiresAt);

    // NEW EVENTS
    event FreelancerFactorySet(address indexed factory);
    event RequireApplicationToHireSet(bool required);
    event JobApplied(uint256 indexed jobId, address indexed freelancer, uint64 appliedAt);
    event JobApplicationWithdrawn(uint256 indexed jobId, address indexed freelancer);

    // NEW DIRECT OFFER EVENTS
    event DirectOfferCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed freelancer,
        string title,
        uint256 budgetUSDT,
        uint64 expiresAt
    );

    event DirectOfferAccepted(
        uint256 indexed jobId,
        address indexed freelancer,
        address escrow
    );

    event DirectOfferRejected(
        uint256 indexed jobId,
        address indexed freelancer
    );

    event DirectOfferCancelled(
        uint256 indexed jobId,
        address indexed client
    );

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/
    address public owner;
    bool public paused;
    mapping(address => bool) public allowedFactory;

    enum AntiSpamMode { None, BondRequired, OnlyKYC }
    AntiSpamMode public antiSpamMode;

    IUSDCMinimal public usdc;
    uint256 public postingBondUSDC;
    mapping(address => bool) public isKYC;
    bool public gasSponsorshipEnabled;

    enum JobStatus { Unknown, Open, Hired, Cancelled, Completed, Expired }

    struct Job {
        address client;
        string title;
        string descriptionURI;
        uint256 budgetUSDC;
        JobStatus status;
        address hiredFreelancer;
        address escrow;
        uint64 createdAt;
        uint64 updatedAt;
        uint64 expiresAt;
        bytes32[] tags;
        uint256 postingBond;
    }

    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;
    mapping(address => uint256[]) public jobsOf;

    uint256[] private openJobIds;
    mapping(uint256 => uint256) private openIndex;
    uint256 private locked = 1;

    /*//////////////////////////////////////////////////////////////
                        APPLICATION SYSTEM STORAGE
    //////////////////////////////////////////////////////////////*/
    IFreelancerFactory public freelancerFactory;
    bool public requireApplicationToHire;

    struct Applicant {
        address freelancer;
        uint64 appliedAt;
        string proposalURI;
        uint256 bidAmount;
        uint64 deliveryDays;
    }

    // jobId => list of applicants
    mapping(uint256 => Applicant[]) private applicantsOf;
    // jobId => freelancer => index+1
    mapping(uint256 => mapping(address => uint256)) private applicantIndex;
    // freelancer => applied jobIds
    mapping(address => uint256[]) private jobsAppliedBy;

    /*//////////////////////////////////////////////////////////////
                    DIRECT OFFER SYSTEM STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Represents a direct offer from client to specific freelancer
    struct DirectOffer {
        uint256 jobId;              // Associated job ID
        address client;             // Client who sent the offer
        address freelancer;         // Target freelancer
        string title;               // Job title
        string descriptionURI;      // IPFS URI with job details
        uint256 budgetUSDT;         // Offered budget in USDT
        uint64 deliveryDays;        // Expected delivery timeline
        uint64 createdAt;           // Offer creation timestamp
        uint64 expiresAt;           // Offer expiration (0 = no expiry)
        bool accepted;              // Whether freelancer accepted
        bool rejected;              // Whether freelancer rejected
        bool cancelled;             // Whether client cancelled
    }

    // Mapping: jobId => DirectOffer
    mapping(uint256 => DirectOffer) public directOffers;

    // Mapping: freelancer => array of jobIds with offers
    mapping(address => uint256[]) private offersToFreelancer;

    // Mapping: client => array of jobIds they offered
    mapping(address => uint256[]) private offersFromClient;

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOwnerOrFactory() {
        if (msg.sender != owner && !allowedFactory[msg.sender]) revert NotAllowedFactory();
        _;
    }

    modifier onlyAllowedFactory() {
        if (!allowedFactory[msg.sender]) revert NotAllowedFactory();
        _;
    }

    modifier onlyClient(uint256 jobId) {
        Job storage j = jobs[jobId];
        if (j.client == address(0)) revert JobNotFound();
        if (msg.sender != j.client) revert NotClient();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert InvalidStatus();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
        nextJobId = 1;
        emit OwnerChanged(address(0), _owner);
    }

    /*//////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////*/
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = _newOwner;
        emit OwnerChanged(prev, _newOwner);
    }

    function setAllowedFactory(address factory, bool allowed) external onlyOwner {
        if (factory == address(0)) revert ZeroAddress();
        allowedFactory[factory] = allowed;
        emit FactoryAllowed(factory, allowed);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setGasSponsorship(bool enabled) external onlyOwner {
        gasSponsorshipEnabled = enabled;
        emit GasSponsorshipSet(enabled);
    }

    function setUSDC(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        usdc = IUSDCMinimal(token);
        emit USDCSet(token);
    }

    function setAntiSpamMode(uint8 mode, uint256 bondAmount) external onlyOwner {
        if (mode > uint8(AntiSpamMode.OnlyKYC)) revert InvalidStatus();
        antiSpamMode = AntiSpamMode(mode);
        postingBondUSDC = bondAmount;
        emit AntiSpamModeSet(mode, bondAmount);
    }

    function setKYC(address user, bool verified) external onlyOwnerOrFactory {
        if (user == address(0)) revert ZeroAddress();
        isKYC[user] = verified;
        emit KYCSet(user, verified);
    }

    function setFreelancerFactory(address factory_) external onlyOwner {
        freelancerFactory = IFreelancerFactory(factory_);
        emit FreelancerFactorySet(factory_);
    }

    function setRequireApplicationToHire(bool required) external onlyOwner {
        requireApplicationToHire = required;
        emit RequireApplicationToHireSet(required);
    }

    /*//////////////////////////////////////////////////////////////
                            CLIENT ACTIONS
    //////////////////////////////////////////////////////////////*/
    function postJob(
        string calldata title,
        string calldata descriptionURI,
        uint256 budgetUSDC,
        bytes32[] calldata tags,
        uint64 expiresAt
    ) external whenNotPaused nonReentrant returns (uint256 jobId) {

        if (antiSpamMode == AntiSpamMode.OnlyKYC && !isKYC[msg.sender]) revert KYCGated();

        uint256 bond = 0;
        if (antiSpamMode == AntiSpamMode.BondRequired) {
            if (address(usdc) == address(0)) revert USDCNotSet();
            if (postingBondUSDC == 0) revert WrongBond();
            bond = postingBondUSDC;
            bool ok = usdc.transferFrom(msg.sender, address(this), bond);
            if (!ok) revert WrongBond();
        }

        if (tags.length > 5) revert TooManyTags();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidStatus();

        jobId = nextJobId++;
        Job storage j = jobs[jobId];
        j.client = msg.sender;
        j.title = title;
        j.descriptionURI = descriptionURI;
        j.budgetUSDC = budgetUSDC;
        j.status = JobStatus.Open;
        j.createdAt = uint64(block.timestamp);
        j.updatedAt = uint64(block.timestamp);
        j.expiresAt = expiresAt;
        j.postingBond = bond;

        if (tags.length > 0) {
            j.tags = new bytes32[](tags.length);
            for (uint256 i = 0; i < tags.length; i++) {
                j.tags[i] = tags[i];
            }
        }

        jobsOf[msg.sender].push(jobId);
        _openAdd(jobId);

        emit JobPosted(jobId, msg.sender, title, descriptionURI, budgetUSDC, j.tags, expiresAt);
    }

    function updateJob(
        uint256 jobId,
        string calldata title,
        string calldata descriptionURI,
        uint256 budgetUSDC,
        bytes32[] calldata tags,
        uint64 expiresAt
    ) external whenNotPaused onlyClient(jobId) {
        Job storage j = jobs[jobId];
        if (j.status != JobStatus.Open) revert NotOpen();
        if (tags.length > 5) revert TooManyTags();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidStatus();

        j.title = title;
        j.descriptionURI = descriptionURI;
        j.budgetUSDC = budgetUSDC;
        j.updatedAt = uint64(block.timestamp);
        j.expiresAt = expiresAt;

        delete j.tags;
        if (tags.length > 0) {
            j.tags = new bytes32[](tags.length);
            for (uint256 i = 0; i < tags.length; i++) {
                j.tags[i] = tags[i];
            }
        }

        emit JobUpdated(jobId, title, descriptionURI, budgetUSDC, j.tags, expiresAt);
    }

    function cancelJob(uint256 jobId) 
        external 
        whenNotPaused 
        onlyClient(jobId) 
        nonReentrant 
    {
        Job storage j = jobs[jobId];
        if (j.status != JobStatus.Open) revert NotOpen();

        j.status = JobStatus.Cancelled;
        j.updatedAt = uint64(block.timestamp);

        _openRemove(jobId);
        _refundBondIfAny(j);

        emit JobCancelled(jobId, j.client);
    }

    function reopen(uint256 jobId, uint64 newExpiresAt) 
        external 
        whenNotPaused 
        onlyClient(jobId) 
    {
        Job storage j = jobs[jobId];

        if (j.status != JobStatus.Cancelled && j.status != JobStatus.Expired) revert NotReopenable();
        if (newExpiresAt != 0 && newExpiresAt <= block.timestamp) revert InvalidStatus();

        j.status = JobStatus.Open;
        j.updatedAt = uint64(block.timestamp);
        j.expiresAt = newExpiresAt;

        _openAdd(jobId);

        emit JobReopened(jobId, newExpiresAt);
    }

    /*//////////////////////////////////////////////////////////////
                        FREELANCER APPLICATIONS
    //////////////////////////////////////////////////////////////*/
    function applyToJob(uint256 jobId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        _applyToJob(jobId, "", 0, 0);
    }

    function applyToJob(
        uint256 jobId,
        string calldata proposalURI,
        uint256 bidAmount,
        uint64 deliveryDays
    ) external whenNotPaused nonReentrant {
        _applyToJob(jobId, proposalURI, bidAmount, deliveryDays);
    }

    function _applyToJob(
        uint256 jobId,
        string memory proposalURI,
        uint256 bidAmount,
        uint64 deliveryDays
    ) internal {
        Job storage j = jobs[jobId];

        if (j.client == address(0)) revert JobNotFound();
        if (j.status != JobStatus.Open) revert NotOpen();
        if (j.expiresAt != 0 && j.expiresAt <= block.timestamp) revert NotExpired();

        if (address(freelancerFactory) != address(0)) {
            address profile = freelancerFactory.freelancerProfile(msg.sender);
            if (profile == address(0)) revert NotFreelancer();
        }

        if (applicantIndex[jobId][msg.sender] != 0) revert AlreadyApplied();

        uint64 nowTs = uint64(block.timestamp);

        uint256 idx = applicantsOf[jobId].length;
        applicantsOf[jobId].push(
            Applicant({
                freelancer: msg.sender,
                appliedAt: nowTs,
                proposalURI: proposalURI,
                bidAmount: bidAmount,
                deliveryDays: deliveryDays
            })
        );
        applicantIndex[jobId][msg.sender] = idx + 1;
        jobsAppliedBy[msg.sender].push(jobId);

        emit JobApplied(jobId, msg.sender, nowTs);
    }

    function withdrawApplication(uint256 jobId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        uint256 idxPlusOne = applicantIndex[jobId][msg.sender];
        if (idxPlusOne == 0) revert ApplicationNotFound();

        uint256 idx = idxPlusOne - 1;

        Applicant storage a = applicantsOf[jobId][idx];
        a.freelancer = address(0);
        a.appliedAt = 0;
        a.proposalURI = "";
        a.bidAmount = 0;
        a.deliveryDays = 0;

        applicantIndex[jobId][msg.sender] = 0;

        emit JobApplicationWithdrawn(jobId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                    DIRECT OFFER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Client creates a direct offer to a specific freelancer
    /// @dev Does NOT lock funds yet - only checks allowance
    /// @param freelancer Target freelancer address
    /// @param title Job title
    /// @param descriptionURI IPFS URI with full job description
    /// @param budgetUSDT Offered budget in USDT (6 decimals)
    /// @param deliveryDays Expected delivery timeline in days
    /// @param expiresAt Offer expiration timestamp (0 = no expiry)
    /// @return jobId The created job ID
    function createDirectOffer(
        address freelancer,
        string calldata title,
        string calldata descriptionURI,
        uint256 budgetUSDT,
        uint64 deliveryDays,
        uint64 expiresAt
    ) external whenNotPaused nonReentrant returns (uint256 jobId) {
        if (freelancer == address(0)) revert ZeroAddress();
        if (budgetUSDT == 0) revert AmountZero();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidStatus();
        
        // Verify freelancer has a profile
        if (address(freelancerFactory) != address(0)) {
            address profile = freelancerFactory.freelancerProfile(freelancer);
            if (profile == address(0)) revert NotFreelancer();
        }
        
        // Check client has sufficient USDT allowance
        // (We don't pull funds yet - that happens on acceptance)
        if (address(usdc) != address(0)) {
            uint256 allowance = usdc.allowance(msg.sender, address(this));
            if (allowance < budgetUSDT) revert InsufficientAllowance();
        }
        
        // Create job with special "Unknown" status for direct offers
        jobId = nextJobId++;
        
        Job storage j = jobs[jobId];
        j.client = msg.sender;
        j.title = title;
        j.descriptionURI = descriptionURI;
        j.budgetUSDC = budgetUSDT;
        j.status = JobStatus.Unknown; // Special status for pending direct offers
        j.createdAt = uint64(block.timestamp);
        j.updatedAt = uint64(block.timestamp);
        j.expiresAt = expiresAt;
        
        // Store direct offer details
        DirectOffer storage offer = directOffers[jobId];
        offer.jobId = jobId;
        offer.client = msg.sender;
        offer.freelancer = freelancer;
        offer.title = title;
        offer.descriptionURI = descriptionURI;
        offer.budgetUSDT = budgetUSDT;
        offer.deliveryDays = deliveryDays;
        offer.createdAt = uint64(block.timestamp);
        offer.expiresAt = expiresAt;
        
        // Track offers
        jobsOf[msg.sender].push(jobId);
        offersToFreelancer[freelancer].push(jobId);
        offersFromClient[msg.sender].push(jobId);
        
        emit DirectOfferCreated(jobId, msg.sender, freelancer, title, budgetUSDT, expiresAt);
    }

    /// @notice Freelancer accepts a direct offer - marks it as accepted
    /// @dev Frontend must then call EscrowFactory.createAndFundEscrowForJob()
    /// @param jobId The job ID of the offer to accept
    function acceptDirectOffer(uint256 jobId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        DirectOffer storage offer = directOffers[jobId];
        
        // Validations
        if (offer.client == address(0)) revert OfferNotFound();
        if (msg.sender != offer.freelancer) revert NotOfferRecipient();
        if (offer.accepted || offer.rejected || offer.cancelled) revert OfferAlreadyProcessed();
        if (offer.expiresAt != 0 && block.timestamp > offer.expiresAt) revert OfferExpired();
        
        // Check client still has sufficient balance and allowance
        if (address(usdc) != address(0)) {
            uint256 balance = usdc.balanceOf(offer.client);
            uint256 allowance = usdc.allowance(offer.client, address(this));
            
            if (balance < offer.budgetUSDT) revert InsufficientBalance();
            if (allowance < offer.budgetUSDT) revert InsufficientAllowance();
        }
        
        // Mark as accepted
        offer.accepted = true;
        
        // Update job status to Open (will be marked Hired by EscrowFactory)
        Job storage j = jobs[jobId];
        j.status = JobStatus.Open;
        j.updatedAt = uint64(block.timestamp);
        
        emit DirectOfferAccepted(jobId, msg.sender, address(0));
    }

    /// @notice Freelancer rejects a direct offer
    /// @param jobId The job ID of the offer to reject
    function rejectDirectOffer(uint256 jobId) external whenNotPaused {
        DirectOffer storage offer = directOffers[jobId];
        
        if (offer.client == address(0)) revert OfferNotFound();
        if (msg.sender != offer.freelancer) revert NotOfferRecipient();
        if (offer.accepted || offer.rejected || offer.cancelled) revert OfferAlreadyProcessed();
        
        offer.rejected = true;
        
        Job storage j = jobs[jobId];
        j.status = JobStatus.Cancelled;
        j.updatedAt = uint64(block.timestamp);
        
        emit DirectOfferRejected(jobId, msg.sender);
    }

    /// @notice Client cancels a pending direct offer
    /// @param jobId The job ID of the offer to cancel
    function cancelDirectOffer(uint256 jobId) external whenNotPaused {
        DirectOffer storage offer = directOffers[jobId];
        
        if (offer.client == address(0)) revert OfferNotFound();
        if (msg.sender != offer.client) revert NotClient();
        if (offer.accepted || offer.rejected || offer.cancelled) revert OfferAlreadyProcessed();
        
        offer.cancelled = true;
        
        Job storage j = jobs[jobId];
        j.status = JobStatus.Cancelled;
        j.updatedAt = uint64(block.timestamp);
        
        emit DirectOfferCancelled(jobId, msg.sender);
    }

    /// @notice Get all offers sent to a freelancer
    /// @param freelancer Freelancer address
    /// @return Array of job IDs
    function getOffersToFreelancer(address freelancer) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return offersToFreelancer[freelancer];
    }

    /// @notice Get all offers sent by a client
    /// @param client Client address
    /// @return Array of job IDs
    function getOffersFromClient(address client) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return offersFromClient[client];
    }

    /// @notice Get direct offer details
    /// @param jobId Job ID
    /// @return Full DirectOffer struct
    function getDirectOffer(uint256 jobId) 
        external 
        view 
        returns (DirectOffer memory) 
    {
        DirectOffer storage offer = directOffers[jobId];
        if (offer.client == address(0)) revert OfferNotFound();
        return offer;
    }

    /*//////////////////////////////////////////////////////////////
                            FACTORY HOOKS
    //////////////////////////////////////////////////////////////*/
    function markAsHired(
        uint256 jobId,
        address freelancer,
        address escrow
    ) external whenNotPaused onlyAllowedFactory nonReentrant {
        if (freelancer == address(0) || escrow == address(0)) revert ZeroAddress();
        
        Job storage j = jobs[jobId];
        if (j.client == address(0)) revert JobNotFound();
        
        // Allow hiring for both Open jobs and accepted DirectOffers
        if (j.status != JobStatus.Open) revert AlreadyHiredOrClosed();
        
        // Check if this is a direct offer
        DirectOffer storage offer = directOffers[jobId];
        if (offer.client != address(0)) {
            // This is a direct offer - verify freelancer matches and offer is accepted
            if (freelancer != offer.freelancer) revert NotFreelancer();
            if (!offer.accepted) revert OfferNotFound();
        } else {
            // Regular job - check application if required
            if (requireApplicationToHire) {
                if (applicantIndex[jobId][freelancer] == 0) revert ApplicationNotFound();
            }
        }
        
        j.hiredFreelancer = freelancer;
        j.escrow = escrow;
        j.status = JobStatus.Hired;
        j.updatedAt = uint64(block.timestamp);
        
        _openRemove(jobId);
        _refundBondIfAny(j);
        
        emit JobHired(jobId, j.client, freelancer, escrow);
    }

    function markAsCompleted(uint256 jobId) 
        external 
        whenNotPaused 
        onlyAllowedFactory 
    {
        Job storage j = jobs[jobId];

        if (j.client == address(0)) revert JobNotFound();
        if (j.status != JobStatus.Hired) revert InvalidStatus();

        j.status = JobStatus.Completed;
        j.updatedAt = uint64(block.timestamp);

        emit JobCompleted(jobId, j.client, j.hiredFreelancer, j.escrow);
    }

    function closeExpired(uint256 jobId) external {
        Job storage j = jobs[jobId];

        if (j.client == address(0)) revert JobNotFound();
        if (j.status != JobStatus.Open) revert NotOpen();
        if (j.expiresAt == 0 || block.timestamp < j.expiresAt) revert NotExpired();

        j.status = JobStatus.Expired;
        j.updatedAt = uint64(block.timestamp);

        _openRemove(jobId);

        emit JobExpiredClosed(jobId, j.expiresAt);
    }

    /*//////////////////////////////////////////////////////////////
                                VIEWS
    //////////////////////////////////////////////////////////////*/
    function getApplicants(
        uint256 jobId,
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory freelancers, uint64[] memory appliedAt) {
        Applicant[] storage list = applicantsOf[jobId];
        uint256 len = list.length;

        if (offset >= len) {
            return (new address[](0), new uint64[](0));
        }

        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256 n = end - offset;

        freelancers = new address[](n);
        appliedAt = new uint64[](n);

        for (uint256 i = 0; i < n; i++) {
            Applicant storage a = list[offset + i];
            freelancers[i] = a.freelancer;
            appliedAt[i] = a.appliedAt;
        }
    }

    function getApplicantCount(uint256 jobId) external view returns (uint256) {
        return applicantsOf[jobId].length;
    }

    function getApplicantDetails(
        uint256 jobId,
        address freelancer
    )
        external
        view
        returns (
            address _freelancer,
            uint64 appliedAt,
            string memory proposalURI,
            uint256 bidAmount,
            uint64 deliveryDays
        )
    {
        uint256 idxPlusOne = applicantIndex[jobId][freelancer];
        if (idxPlusOne == 0) revert ApplicationNotFound();

        Applicant storage a = applicantsOf[jobId][idxPlusOne - 1];

        return (
            a.freelancer,
            a.appliedAt,
            a.proposalURI,
            a.bidAmount,
            a.deliveryDays
        );
    }

    function getJobsAppliedBy(address freelancer) external view returns (uint256[] memory) {
        return jobsAppliedBy[freelancer];
    }

    function getJob(uint256 jobId)
        external
        view
        returns (
            address client,
            string memory title,
            string memory descriptionURI,
            uint256 budgetUSDC,
            JobStatus status,
            address hiredFreelancer,
            address escrow,
            uint64 createdAt,
            uint64 updatedAt,
            uint64 expiresAt,
            bytes32[] memory tags,
            uint256 postingBond
        )
    {
        Job storage j = jobs[jobId];

        if (j.client == address(0)) revert JobNotFound();

        return (
            j.client,
            j.title,
            j.descriptionURI,
            j.budgetUSDC,
            j.status,
            j.hiredFreelancer,
            j.escrow,
            j.createdAt,
            j.updatedAt,
            j.expiresAt,
            j.tags,
            j.postingBond
        );
    }

    function jobsByClient(address clientAddr) external view returns (uint256[] memory) {
        return jobsOf[clientAddr];
    }

    function jobsByClientPaginated(
        address clientAddr,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory out) {
        uint256 len = jobsOf[clientAddr].length;

        if (offset >= len) return new uint256[](0);

        uint256 end = offset + limit;
        if (end > len) end = len;

        uint256 n = end - offset;
        out = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            out[i] = jobsOf[clientAddr][offset + i];
        }
    }

    function openJobs(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory out) {
        uint256 len = openJobIds.length;

        if (offset >= len) return new uint256[](0);

        uint256 end = offset + limit;
        if (end > len) end = len;

        uint256 n = end - offset;
        out = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            out[i] = openJobIds[offset + i];
        }
    }

    function totalOpenJobs() external view returns (uint256) {
        return openJobIds.length;
    }

    function totalJobsOf(address clientAddr) external view returns (uint256) {
        return jobsOf[clientAddr].length;
    }

    /*//////////////////////////////////////////////////////////////
                        OWNER: TREASURY SWEEPS
    //////////////////////////////////////////////////////////////*/
    function sweepERC20(address /*token*/, uint256 amount) external onlyOwner {
        usdc.transfer(owner, amount);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL: OPEN SET
    //////////////////////////////////////////////////////////////*/
    function _openAdd(uint256 jobId) internal {
        if (openIndex[jobId] != 0) return;
        openJobIds.push(jobId);
        openIndex[jobId] = openJobIds.length;
    }

    function _openRemove(uint256 jobId) internal {
        uint256 idxPlusOne = openIndex[jobId];
        if (idxPlusOne == 0) return;

        uint256 idx = idxPlusOne - 1;
        uint256 lastId = openJobIds[openJobIds.length - 1];

        if (idx != openJobIds.length - 1) {
            openJobIds[idx] = lastId;
            openIndex[lastId] = idx + 1;
        }

        openJobIds.pop();
        openIndex[jobId] = 0;
    }

    function _refundBondIfAny(Job storage j) internal {
        uint256 bond = j.postingBond;
        if (bond == 0) return;

        j.postingBond = 0;
        usdc.transfer(j.client, bond);
    }
}
