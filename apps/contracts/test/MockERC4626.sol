// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @notice Minimal ERC-4626 vault over a USDC asset, used to simulate the RE7 yield vault in tests.
/// Yield can be simulated by minting extra underlying to the vault via `simulateYield`.
contract MockERC4626 is ERC4626 {
    constructor(IERC20 asset_) ERC20("Mock Yield USDC", "myUSDC") ERC4626(asset_) {}

    /// @dev Donate underlying assets to the vault to inflate share price (simulate accrued yield).
    function simulateYield(uint256 amount) external {
        // Caller must have approved this contract; pulls assets in without minting shares.
        IERC20(asset()).transferFrom(msg.sender, address(this), amount);
    }
}
