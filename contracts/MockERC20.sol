// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockERC20 — Token ERC-20 minteable para pruebas y Sepolia
contract MockERC20 is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {}

    /// @notice Mintea `amount` tokens a la dirección `to`. Solo el owner puede llamar esto.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
