// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ClientProfile.sol";

contract ClientFactory {
    mapping(address => address) public clientProfiles;

    event ClientProfileCreated(address indexed client, address profile);

    function createClientProfile(
        string memory _name,
        string memory _bio,
        string memory _company,
        string memory _profileImage
    ) external {
        require(clientProfiles[msg.sender] == address(0), "Profile already exists");

        ClientProfile profile = new ClientProfile(
            msg.sender,
            _name,
            _bio,
            _company,
            _profileImage
        );

        clientProfiles[msg.sender] = address(profile);

        emit ClientProfileCreated(msg.sender, address(profile));
    }

    function getProfile(address client) external view returns (address) {
        return clientProfiles[client];
    }
}
