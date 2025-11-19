// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ClientProfile {
    address public owner;

    // Profile data
    string public name;
    string public bio;
    string public company;
    string public profileImage;

    // Job tracking
    uint256 public totalJobsPosted;
    uint256 public totalJobsCompleted;

    uint256[] private postedJobs;
    uint256[] private completedJobs;

    constructor(
        address _owner,
        string memory _name,
        string memory _bio,
        string memory _company,
        string memory _profileImage
    ) {
        owner = _owner;
        name = _name;
        bio = _bio;
        company = _company;
        profileImage = _profileImage;

        totalJobsPosted = 0;
        totalJobsCompleted = 0;
    }

    // --- Profile Updates ---
    function updateProfile(
        string memory _name,
        string memory _bio,
        string memory _company,
        string memory _profileImage
    ) external {
        require(msg.sender == owner, "Not owner");
        name = _name;
        bio = _bio;
        company = _company;
        profileImage = _profileImage;
    }

    // --- Job Tracking ---
    function addPostedJob(uint256 jobId) external {
        require(msg.sender == owner, "Not owner");
        postedJobs.push(jobId);
        totalJobsPosted++;
    }

    function addCompletedJob(uint256 jobId) external {
        require(msg.sender == owner, "Not owner");
        completedJobs.push(jobId);
        totalJobsCompleted++;
    }

    // --- View Functions ---
    function getPostedJobs() external view returns (uint256[] memory) {
        return postedJobs;
    }

    function getCompletedJobs() external view returns (uint256[] memory) {
        return completedJobs;
    }
}
