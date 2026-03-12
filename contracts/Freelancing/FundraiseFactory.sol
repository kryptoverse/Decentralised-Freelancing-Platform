// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./JobFundraise.sol";

interface IJobEscrowInterface {
    function freelancer() external view returns (address);
    function usdt() external view returns (address);
    function setFundraiseContract(address _fundraise) external;
}

interface IInvestorRegistry {
    function addAuthorizedContract(address _contract) external;
}

/// @title FundraiseFactory
/// @notice Deploys and indexes all JobFundraise contracts
contract FundraiseFactory {

    address public immutable platformStats;
    address public immutable investorRegistry;
    
    // Array to store all deployed fundraises (for discovery)
    address[] public allFundraises;

    event FundraiseCreated(
        address indexed fundraise,
        address indexed escrow,
        address indexed freelancer,
        uint256 targetAmount,
        uint96 investorProfitShareBps,
        uint64 fundingDurationSecs
    );

    constructor(address _platformStats, address _investorRegistry) {
        platformStats = _platformStats;
        investorRegistry = _investorRegistry;
    }

    /// @notice Freelancer deploys a fundraise for their active Escrow
    function createFundraise(
        address escrow,
        uint256 targetAmount,
        uint96 investorProfitShareBps,
        uint64 fundingDurationSecs
    ) external returns (address) {
        require(escrow != address(0), "Invalid escrow address");
        
        address freelancer = IJobEscrowInterface(escrow).freelancer();
        require(msg.sender == freelancer, "Only the linked freelancer can deploy fundraise");

        address paymentToken = IJobEscrowInterface(escrow).usdt();

        JobFundraise fundraise = new JobFundraise(
            paymentToken,
            escrow,
            freelancer,
            platformStats,
            investorRegistry,
            targetAmount,
            investorProfitShareBps,
            fundingDurationSecs
        );

        address fundraiseAddress = address(fundraise);
        allFundraises.push(fundraiseAddress);

        // Auto-authorize in InvestorRegistry if one is provided
        if (investorRegistry != address(0)) {
            IInvestorRegistry(investorRegistry).addAuthorizedContract(fundraiseAddress);
        }

        // Note: Escrow auto-link removed. Freelancer must manually call escrow.setFundraiseContract()

        emit FundraiseCreated(
            fundraiseAddress,
            escrow,
            freelancer,
            targetAmount,
            investorProfitShareBps,
            fundingDurationSecs
        );

        return fundraiseAddress;
    }

    /// @notice Get total fundraises deployed
    function getTotalFundraises() external view returns (uint256) {
        return allFundraises.length;
    }

    /// @notice Fetch all active fundraises (paginated for UI)
    function getFundraises(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 total = allFundraises.length;
        if (offset >= total) {
            return new address[](0);
        }

        uint256 size = limit;
        if (offset + limit > total) {
            size = total - offset;
        }

        address[] memory result = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = allFundraises[offset + i];
        }

        return result;
    }
}
