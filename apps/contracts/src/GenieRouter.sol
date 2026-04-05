// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAllowanceTransfer {
    function transferFrom(address from, address to, uint160 amount, address token) external;
}

contract GenieRouter {
    address public immutable usdc;
    address public immutable permit2;
    address public owner;

    constructor(address _usdc, address _permit2) {
        usdc = _usdc;
        permit2 = _permit2;
        owner = msg.sender;
    }

    /// @notice Route USDC from sender to a handler contract via Permit2
    /// @param sender The user whose Permit2 allowance is being spent
    /// @param amount Amount in USDC smallest units (6 decimals)
    /// @param handler The handler contract to receive the funds
    function route(address sender, uint256 amount, address handler) external {
        require(msg.sender == owner, "only relayer");
        IAllowanceTransfer(permit2).transferFrom(sender, handler, uint160(amount), usdc);
    }
}
