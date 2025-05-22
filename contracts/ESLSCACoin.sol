// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ESLSCACoin
 * @dev Implementation of ESLSCA Coin - A cryptocurrency for ESLSCA University
 */
contract ESLSCACoin is ERC20, Ownable {
    // Events
    event TokensMinted(address indexed to, uint256 amount, uint256 timestamp);
    event TransferExecuted(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    // Constructor
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        // Mint initial supply to the owner (initialSupply should already be in wei)
        _mint(initialOwner, initialSupply);
        emit TokensMinted(initialOwner, initialSupply, block.timestamp);
    }

    /**
     * @dev Mint new tokens - only owner can mint
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (in wei - same units as totalSupply)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");

        _mint(to, amount);
        emit TokensMinted(to, amount, block.timestamp);
    }

    /**
     * @dev Override transfer to add custom event
     */
    function transfer(
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address sender = _msgSender();
        bool success = super.transfer(to, amount);
        if (success) {
            emit TransferExecuted(sender, to, amount, block.timestamp);
        }
        return success;
    }

    /**
     * @dev Override transferFrom to add custom event
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        bool success = super.transferFrom(from, to, amount);
        if (success) {
            emit TransferExecuted(from, to, amount, block.timestamp);
        }
        return success;
    }

    /**
     * @dev Get contract information
     */
    function getContractInfo()
        public
        view
        returns (
            string memory tokenName,
            string memory tokenSymbol,
            uint256 totalTokenSupply,
            uint8 tokenDecimals,
            address contractOwner
        )
    {
        return (name(), symbol(), totalSupply(), decimals(), owner());
    }

    /**
     * @dev Get balance of an address
     */
    function getBalance(address account) public view returns (uint256) {
        return balanceOf(account);
    }
}