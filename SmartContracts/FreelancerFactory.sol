// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FreelancerProfile.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title FreelancerFactory
/// @notice Deploys FreelancerProfile instances, manages KYC verification & escrow registration.
contract FreelancerFactory {
    using ECDSA for bytes32;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error NotOwner();
    error ProfileExists();
    error ZeroAddress();
    error NoProfile();
    error AttesterNotAuthorized();
    error SignatureExpired();
    error InvalidNonce();
    error NotEscrowDeployerOrOwner();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event ProfileDeployed(address indexed freelancer, address indexed profile);
    event KYCSetByOwner(address indexed freelancer, address indexed profile, bool status);
    event KYCSetByAttestation(address indexed freelancer, address indexed profile, bool status, address indexed attester);
    event AttesterSet(address indexed attester, bool enabled);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event EscrowDeployerSet(address indexed deployer, bool enabled);
    event EscrowLinked(address indexed freelancer, address indexed profile, address indexed escrow);

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/
    address public owner;

    // Maps freelancer wallet → deployed profile contract
    mapping(address => address) public freelancerProfile;

    // ✅ NEW: Array for UI discovery — keeps all freelancers that created profiles
    address[] private allFreelancers;

    // Attester management for signature-based KYC
    mapping(address => bool) public attesters;

    // Nonce per freelancer to prevent replay of signed attestations
    mapping(address => uint256) public nonces;

    // Addresses that can link escrows (e.g. EscrowFactory)
    mapping(address => bool) public escrowDeployers;

    constructor() {
        owner = msg.sender;
    }

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyEscrowDeployerOrOwner() {
        if (msg.sender != owner && !escrowDeployers[msg.sender]) revert NotEscrowDeployerOrOwner();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                OWNER / ADMIN
    //////////////////////////////////////////////////////////////*/
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        address previous = owner;
        owner = _newOwner;
        emit OwnerChanged(previous, _newOwner);
    }

    function setAttester(address _attester, bool _enabled) external onlyOwner {
        if (_attester == address(0)) revert ZeroAddress();
        attesters[_attester] = _enabled;
        emit AttesterSet(_attester, _enabled);
    }

    function setEscrowDeployer(address _deployer, bool _enabled) external onlyOwner {
        if (_deployer == address(0)) revert ZeroAddress();
        escrowDeployers[_deployer] = _enabled;
        emit EscrowDeployerSet(_deployer, _enabled);
    }

    /*//////////////////////////////////////////////////////////////
                                PROFILE DEPLOYMENT
    //////////////////////////////////////////////////////////////*/
    /// @notice Deploys a FreelancerProfile for the sender (one per wallet)
    function deployFreelancerProfile(
        string calldata _name,
        string calldata _bio,
        string calldata _profileURI
    ) external returns (address profileAddr) {
        address freelancer = msg.sender;
        if (freelancerProfile[freelancer] != address(0)) revert ProfileExists();

        FreelancerProfile profile = new FreelancerProfile(
            freelancer,
            address(this),
            _name,
            _bio,
            _profileURI
        );

        freelancerProfile[freelancer] = address(profile);

        // ✅ Track freelancer for frontend discovery
        allFreelancers.push(freelancer);

        emit ProfileDeployed(freelancer, address(profile));
        return address(profile);
    }

    /*//////////////////////////////////////////////////////////////
                                PUBLIC VIEWS (for UI)
    //////////////////////////////////////////////////////////////*/
    /// @notice Returns all freelancer wallet addresses that have created a profile
    function getAllFreelancers() external view returns (address[] memory) {
        return allFreelancers;
    }

    /// @notice Returns both freelancer wallets and profile contract addresses
    function getAllFreelancerProfiles()
        external
        view
        returns (address[] memory wallets, address[] memory profiles)
    {
        uint256 count = allFreelancers.length;
        wallets = new address[](count);
        profiles = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            address wallet = allFreelancers[i];
            wallets[i] = wallet;
            profiles[i] = freelancerProfile[wallet];
        }
    }

    /// @notice Returns total number of freelancers (for pagination)
    function totalFreelancers() external view returns (uint256) {
        return allFreelancers.length;
    }

    /*//////////////////////////////////////////////////////////////
                                ESCROW LINKING
    //////////////////////////////////////////////////////////////*/
    /// @notice Link a new escrow contract to a freelancer’s profile.
    function linkEscrowToProfile(address freelancer, address escrowAddr)
        external
        onlyEscrowDeployerOrOwner
    {
        if (freelancer == address(0) || escrowAddr == address(0)) revert ZeroAddress();
        address profileAddr = freelancerProfile[freelancer];
        if (profileAddr == address(0)) revert NoProfile();

        FreelancerProfile(profileAddr).registerEscrow(escrowAddr);
        emit EscrowLinked(freelancer, profileAddr, escrowAddr);
    }

    /*//////////////////////////////////////////////////////////////
                                KYC MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    /// @notice Set KYC manually (only owner)
    function setKYCFor(address freelancer, bool status) external onlyOwner {
        address profileAddr = freelancerProfile[freelancer];
        if (profileAddr == address(0)) revert NoProfile();

        FreelancerProfile(profileAddr).setKYCVerified(status);
        emit KYCSetByOwner(freelancer, profileAddr, status);
    }

    /// @notice Set KYC via signed attestation
    function setKYCByAttestation(
        address freelancer,
        bool status,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external {
        if (block.timestamp > expiry) revert SignatureExpired();
        if (nonce != nonces[freelancer]) revert InvalidNonce();

        bytes32 dataHash = keccak256(
            abi.encode(freelancer, status, nonce, expiry, address(this))
        );
        bytes32 ethSigned = ECDSA.toEthSignedMessageHash(dataHash);
        address signer = ECDSA.recover(ethSigned, signature);
        if (!attesters[signer]) revert AttesterNotAuthorized();

        nonces[freelancer] = nonce + 1;

        address profileAddr = freelancerProfile[freelancer];
        if (profileAddr == address(0)) revert NoProfile();

        FreelancerProfile(profileAddr).setKYCVerified(status);
        emit KYCSetByAttestation(freelancer, profileAddr, status, signer);
    }
}
