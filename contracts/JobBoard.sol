// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title JobBoard v3 — On-chain Job Board with Applications
 *
 * NEW FEATURES:
 * ---------------
 * ✔ Freelancer Applications (applyToJob)
 * ✔ Applicant pagination (getApplicants)
 * ✔ Applicants tracking per job
 * ✔ Jobs applied by freelancer (getJobsAppliedBy)
 * ✔ withdrawApplication
 * ✔ Optional: requireApplicationToHire
 * ✔ Optional: freelancerFactory verification
 *
 * ZERO BREAKING CHANGES:
 * ---------------
 * - postJob() unchanged
 * - updateJob() unchanged
 * - cancelJob(), reopen() unchanged
 * - EscrowFactory integration unchanged
 * - markAsHired() still works the same UNLESS requireApplicationToHire = true
 *
 */

interface IERC20 {
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

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/
    address public owner;
    bool public paused;
    mapping(address => bool) public allowedFactory;

    enum AntiSpamMode {
        None,
        BondRequired,
        OnlyKYC
    }

    AntiSpamMode public antiSpamMode;
    IERC20 public usdc;
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
    }

    // jobId => list of applicants
    mapping(uint256 => Applicant[]) private applicantsOf;

    // jobId => freelancer => index+1 (0 = none)
    mapping(uint256 => mapping(address => uint256)) private applicantIndex;

    // freelancer => jobIds applied to
    mapping(address => uint256[]) private jobsAppliedBy;

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
        usdc = IERC20(token);
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

    /*//////////////////////////////////////////////////////////////
                        APPLICATION SYSTEM ADMIN
    //////////////////////////////////////////////////////////////*/

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
            for (uint256 i = 0; i < tags.length; i++) j.tags[i] = tags[i];
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
            for (uint256 i = 0; i < tags.length; i++) j.tags[i] = tags[i];
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
                    FREELANCER APPLICATION ACTIONS
    //////////////////////////////////////////////////////////////*/

    function applyToJob(uint256 jobId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
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
        applicantsOf[jobId].push(Applicant(msg.sender, nowTs));
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

        applicantIndex[jobId][msg.sender] = 0;

        emit JobApplicationWithdrawn(jobId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                            FACTORY HOOKS (UNCHANGED)
    //////////////////////////////////////////////////////////////*/

    function markAsHired(
        uint256 jobId,
        address freelancer,
        address escrow
    ) external whenNotPaused onlyAllowedFactory nonReentrant {

        if (freelancer == address(0) || escrow == address(0)) revert ZeroAddress();
        Job storage j = jobs[jobId];
        if (j.client == address(0)) revert JobNotFound();
        if (j.status != JobStatus.Open) revert AlreadyHiredOrClosed();

        if (requireApplicationToHire) {
            if (applicantIndex[jobId][freelancer] == 0) revert ApplicationNotFound();
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

    function openJobs(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory out)
    {
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

    function sweepERC20(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
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
