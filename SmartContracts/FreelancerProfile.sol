// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FreelancerProfile
/// @notice Per-freelancer profile. KYC is controlled ONLY by the Factory.
///         Adds secure escrow registration and a multi-job state machine with points/levels.
contract FreelancerProfile {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error NotOwner();
    error NotFactory();
    error NotVerified();
    error MaxServicesReached();
    error ServiceNotFound();
    error EscrowNotAuthorized();
    error EscrowAlreadyRegistered();
    error ZeroAddress();

    error JobExists();
    error JobUnknown();
    error JobWrongEscrow();
    error JobAlreadyFinalized();
    error JobNotApproved();
    error InvalidStatusTransition();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event ProfileUpdated(string name, string bio, string profileURI);
    event KYCStatusChanged(address indexed setter, bool indexed status);
    event ServiceAdded(uint256 indexed id, string title);

    event EscrowRegistered(address indexed escrow);
    event EscrowUnregistered(address indexed escrow);

    // Job lifecycle & reputation
    event JobRegistered(bytes32 indexed jobKey, address indexed escrow);
    event JobStatusChanged(bytes32 indexed jobKey, address indexed escrow, JobStatus oldStatus, JobStatus newStatus);
    event JobCompleted(bytes32 indexed jobKey, address indexed escrow, uint8 rating, uint256 totalPoints, uint256 completedJobs, uint8 newLevel);
    event PointsUpdated(uint256 oldPoints, uint256 newPoints);
    event LevelUpdated(uint8 oldLevel, uint8 newLevel);

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/
    address public immutable owner;    // freelancer wallet (owner)
    address public immutable factory;  // factory that deployed this profile

    string public name;
    string public bio;
    string public profileURI;

    bool public isKYCVerified;

    // Reputation totals (points = sum of per-job star ratings; jobs = completed count)
    uint256 public totalPoints;
    uint256 public completedJobs;
    uint8   public level; // starts at 0

    // Escrow registry
    mapping(address => bool) public activeEscrows; // escrow contract => registered (allowed to manage jobs)

    // Job state & replay protection
    enum JobStatus { None, Created, InProgress, Delivered, Approved, Disputed, Cancelled, Completed }

    struct Job {
        address escrow;
        JobStatus status;
        uint8  rating;       // 1..5 (capped)
        bool   finalized;    // true after completion accounted in totals
        uint64 createdAt;
        uint64 updatedAt;
    }

    mapping(bytes32 => Job) private jobs;          // jobKey => Job
    mapping(bytes32 => bool) public jobProcessed;  // kept for simple external checks (mirrors .finalized)

    // Services (unchanged)
    struct Service {
        string title;
        string description;
        string imageURI;
        string videoURI;
        uint256 priceUSDC;
        bool active;
    }
    mapping(uint256 => Service) public services;
    uint256 public serviceCount;

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    modifier onlyVerified() {
        if (!isKYCVerified) revert NotVerified();
        _;
    }

    modifier onlyEscrow() {
        if (!activeEscrows[msg.sender]) revert EscrowNotAuthorized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(
        address _owner,
        address _factory,
        string memory _name,
        string memory _bio,
        string memory _profileURI
    ) {
        if (_owner == address(0) || _factory == address(0)) revert ZeroAddress();
        owner = _owner;
        factory = _factory;

        name = _name;
        bio = _bio;
        profileURI = _profileURI;

        // initial reputation
        totalPoints = 0;
        completedJobs = 0;
        level = 0; // ✅ as requested: start at level 0

        emit ProfileUpdated(_name, _bio, _profileURI);
    }

    /*//////////////////////////////////////////////////////////////
                                PROFILE
    //////////////////////////////////////////////////////////////*/
    function updateProfile(
        string calldata _name,
        string calldata _bio,
        string calldata _profileURI
    ) external onlyOwner {
        name = _name;
        bio = _bio;
        profileURI = _profileURI;
        emit ProfileUpdated(_name, _bio, _profileURI);
    }

    /*//////////////////////////////////////////////////////////////
                                KYC (only factory)
    //////////////////////////////////////////////////////////////*/
    function setKYCVerified(bool _status) external onlyFactory {
        if (isKYCVerified == _status) {
            emit KYCStatusChanged(msg.sender, _status);
            return;
        }
        isKYCVerified = _status;
        emit KYCStatusChanged(msg.sender, _status);
    }

    /*//////////////////////////////////////////////////////////////
                                ESCROWS (Factory only)
    //////////////////////////////////////////////////////////////*/
    function registerEscrow(address escrowAddr) external onlyFactory {
        if (escrowAddr == address(0)) revert ZeroAddress();
        if (activeEscrows[escrowAddr]) revert EscrowAlreadyRegistered();
        activeEscrows[escrowAddr] = true;
        emit EscrowRegistered(escrowAddr);
    }

    function unregisterEscrow(address escrowAddr) external onlyFactory {
        if (escrowAddr == address(0)) revert ZeroAddress();
        if (!activeEscrows[escrowAddr]) revert EscrowNotAuthorized();
        activeEscrows[escrowAddr] = false;
        emit EscrowUnregistered(escrowAddr);
    }

    /*//////////////////////////////////////////////////////////////
                                SERVICES (KYC gated)
    //////////////////////////////////////////////////////////////*/
    function addService(
        string calldata _title,
        string calldata _description,
        string calldata _imageURI,
        string calldata _videoURI,
        uint256 _priceUSDC
    ) external onlyOwner onlyVerified {
        if (serviceCount >= 100) revert MaxServicesReached();
        services[serviceCount] = Service({
            title: _title,
            description: _description,
            imageURI: _imageURI,
            videoURI: _videoURI,
            priceUSDC: _priceUSDC,
            active: true
        });
        emit ServiceAdded(serviceCount, _title);
        unchecked { serviceCount += 1; }
    }

    /*//////////////////////////////////////////////////////////////
                        JOB LIFECYCLE (multi-job support)
    //////////////////////////////////////////////////////////////*/
    /// @notice Register a new job for this profile. Called by a registered escrow.
    /// @param jobKey A unique identifier for the job (e.g., keccak256(abi.encodePacked(escrow, jobId))).
    function registerJob(bytes32 jobKey) external onlyEscrow {
        if (jobKey == bytes32(0)) revert JobUnknown();
        Job storage j = jobs[jobKey];
        if (j.status != JobStatus.None) revert JobExists();

        jobs[jobKey] = Job({
            escrow: msg.sender,
            status: JobStatus.Created,
            rating: 0,
            finalized: false,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        emit JobRegistered(jobKey, msg.sender);
        emit JobStatusChanged(jobKey, msg.sender, JobStatus.None, JobStatus.Created);
    }

    /// @notice Update job status along allowed transitions (Created→InProgress→Delivered→Approved/Disputed→Completed or Cancelled).
    function updateJobStatus(bytes32 jobKey, JobStatus newStatus) external onlyEscrow {
        Job storage j = _mustGetJob(jobKey);
        if (j.escrow != msg.sender) revert JobWrongEscrow();
        if (j.finalized) revert JobAlreadyFinalized();

        JobStatus old = j.status;
        if (!_allowedTransition(old, newStatus)) revert InvalidStatusTransition();

        j.status = newStatus;
        j.updatedAt = uint64(block.timestamp);
        emit JobStatusChanged(jobKey, msg.sender, old, newStatus);
    }

    /// @notice Finalize an APPROVED job: caps rating to 1..5, prevents double-counting, updates totals & level.
    /// @dev Only the escrow that owns the job can finalize it. Requires status == Approved.
    function markJobCompleted(uint8 ratingStars, bytes32 jobKey) external onlyEscrow {
        Job storage j = _mustGetJob(jobKey);
        if (j.escrow != msg.sender) revert JobWrongEscrow();
        if (j.finalized) revert JobAlreadyFinalized();
        if (j.status != JobStatus.Approved) revert JobNotApproved();

        // cap rating to 1..5 (if you want to allow 0, change the min below)
        if (ratingStars < 1) ratingStars = 1;
        if (ratingStars > 5) ratingStars = 5;

        // finalize
        j.rating = ratingStars;
        j.status = JobStatus.Completed;
        j.finalized = true;
        j.updatedAt = uint64(block.timestamp);
        jobProcessed[jobKey] = true; // mirror finalized for external quick checks

        // update totals
        uint256 oldPoints = totalPoints;
        totalPoints += ratingStars;  // each job contributes up to 5 points
        completedJobs += 1;
        emit PointsUpdated(oldPoints, totalPoints);

        // compute new level using dual thresholds (jobs & points)
        uint8 oldLevel = level;
        level = _computeLevel(completedJobs, totalPoints);
        if (level != oldLevel) emit LevelUpdated(oldLevel, level);

        emit JobCompleted(jobKey, msg.sender, ratingStars, totalPoints, completedJobs, level);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL: HELPERS & LEVEL LOGIC
    //////////////////////////////////////////////////////////////*/
    function _mustGetJob(bytes32 jobKey) internal view returns (Job storage j) {
        j = jobs[jobKey];
        if (j.status == JobStatus.None) revert JobUnknown();
    }

    function _allowedTransition(JobStatus from, JobStatus to) internal pure returns (bool) {
        if (from == JobStatus.Created && (to == JobStatus.InProgress || to == JobStatus.Cancelled)) return true;
        if (from == JobStatus.InProgress && (to == JobStatus.Delivered || to == JobStatus.Cancelled || to == JobStatus.Disputed)) return true;
        if (from == JobStatus.Delivered && (to == JobStatus.Approved || to == JobStatus.Disputed || to == JobStatus.Cancelled)) return true;
        if (from == JobStatus.Approved && (to == JobStatus.Completed)) return true; // completion happens via markJobCompleted
        if (from == JobStatus.Disputed && (to == JobStatus.Approved || to == JobStatus.Cancelled)) return true;
        // Completed/Cancelled are terminal in this model
        return false;
    }

    /// @dev Dual-threshold (jobs & points) level computation — starts at 0 and maxes at 5.
    function _computeLevel(uint256 _jobs, uint256 points) internal pure returns (uint8) {
        // totals required for each level (inclusive)
        // L1: 5 jobs & 20 pts
        // L2: 10 jobs & 45 pts
        // L3: 15 jobs & 70 pts
        // L4: 20 jobs & 95 pts
        // L5: 25 jobs & 120 pts
        if (_jobs >= 25 && points >= 120) return 5;
        if (_jobs >= 20 && points >= 95)  return 4;
        if (_jobs >= 15 && points >= 70)  return 3;
        if (_jobs >= 10 && points >= 45)  return 2;
        if (_jobs >= 5  && points >= 20)  return 1;
        return 0;
    }

    /*//////////////////////////////////////////////////////////////
                                VIEWS
    //////////////////////////////////////////////////////////////*/
    /// @notice Helper to check whether an escrow is active for this profile
    function isEscrowActive(address escrowAddr) external view returns (bool) {
        return activeEscrows[escrowAddr];
    }

    /// @notice Helper to check if a jobKey has already been processed (finalized) for this profile
    /// @dev This is a simple read-only convenience for UI/indexers to know if a job was finalized (counted).
    function isJobProcessed(bytes32 jobKey) external view returns (bool) {
        return jobProcessed[jobKey];
    }

    /// @notice Returns job info for dashboards (escrow, status, rating, finalized, timestamps)
    function jobInfo(bytes32 jobKey)
        external
        view
        returns (
            address escrow,
            JobStatus status,
            uint8 rating,
            bool finalized,
            uint64 createdAt,
            uint64 updatedAt
        )
    {
        Job storage j = jobs[jobKey];
        return (j.escrow, j.status, j.rating, j.finalized, j.createdAt, j.updatedAt);
    }
}
