// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract GenieRouter {
    using SafeERC20 for IERC20;

    address public immutable usdc;
    address public owner;

    constructor(address _usdc) {
        usdc = _usdc;
        owner = msg.sender;
    }

    /// @notice Route USDC from sender to a handler contract
    /// @param sender The user whose USDC allowance is being spent
    /// @param amount Amount in USDC smallest units (6 decimals)
    /// @param handler The handler contract to receive the funds
    function route(address sender, uint256 amount, address handler) external {
        require(msg.sender == owner, "only relayer");
        IERC20(usdc).safeTransferFrom(sender, handler, amount);
    }
}
