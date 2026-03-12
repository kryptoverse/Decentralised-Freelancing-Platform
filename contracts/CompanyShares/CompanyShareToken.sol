// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IDividendDistributorHook {
    function handleTransfer(address from, address to, uint256 amount) external;
}

/// @title CompanyShareToken
/// @notice ERC20 token representing company ownership shares
/// @dev Integrates with DividendDistributor for automatic dividend accounting
contract CompanyShareToken is ERC20, Ownable2Step {
    IDividendDistributorHook public immutable distributor;
    address public saleContract;
    bool private saleContractLocked;

    event SaleContractSet(address indexed sale);

    error OnlySale();
    error SaleContractAlreadySet();
    error InvalidSaleAddress();
    error InvalidMintAddress();
    error InvalidMintAmount();

    /// @notice Initialize the share token
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    /// @param distributor_ Address of the dividend distributor
    /// @param initialOwner Initial owner (company owner)
    constructor(
        string memory name_,
        string memory symbol_,
        address distributor_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        if (distributor_ == address(0)) revert InvalidSaleAddress();
        distributor = IDividendDistributorHook(distributor_);
    }

    /// @notice Set the sale contract address (one-time only)
    /// @dev Can only be called once by owner to prevent minter manipulation
    /// @param _sale Address of the ShareSale contract
    function setSaleContract(address _sale) external onlyOwner {
        if (_sale == address(0)) revert InvalidSaleAddress();
        if (saleContractLocked) revert SaleContractAlreadySet();
        
        saleContract = _sale;
        saleContractLocked = true;
        
        emit SaleContractSet(_sale);
    }

    /// @notice Mint new shares (only callable by sale contract)
    /// @dev Used during fundraising rounds to create new shares
    /// @param to Recipient address
    /// @param amount Number of shares to mint (18 decimals)
    function mint(address to, uint256 amount) external {
        if (msg.sender != saleContract) revert OnlySale();
        if (to == address(0)) revert InvalidMintAddress();
        if (amount == 0) revert InvalidMintAmount();
        
        _mint(to, amount);
    }

    /// @notice Hook for dividend accounting on every transfer/mint/burn
    /// @dev Automatically called by ERC20 _update function
    /// @param from Sender address (address(0) for mints)
    /// @param to Recipient address (address(0) for burns)
    /// @param amount Amount transferred
    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);
        distributor.handleTransfer(from, to, amount);
    }
}