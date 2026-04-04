// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PayHandler {
    using SafeERC20 for IERC20;

    address public immutable usdc;
    address public owner;

    constructor(address _usdc) {
        usdc = _usdc;
        owner = msg.sender;
    }

    /// @notice Execute transfer of USDC to final recipient
    /// @param recipient The wallet address to receive USDC
    /// @param amount Amount in USDC smallest units (6 decimals)
    function execute(address recipient, uint256 amount) external {
        require(msg.sender == owner, "only relayer");
        IERC20(usdc).safeTransfer(recipient, amount);
    }
}
