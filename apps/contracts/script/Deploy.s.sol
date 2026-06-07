// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {GenieVault} from "../src/GenieVault.sol";

/// @notice Deploys the custodial GenieVault.
/// Env:
///   RELAYER_PRIVATE_KEY — deployer (becomes owner); also typically the agent key.
///   USDC_ADDRESS        — USDC token on the target chain.
///   YIELD_VAULT_ADDRESS — RE7 USDC ERC-4626 vault.
///   AGENT_ADDRESS       — agent/relayer that moves user funds (defaults to deployer).
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("RELAYER_PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address yieldVault = vm.envAddress("YIELD_VAULT_ADDRESS");
        address agent = vm.envOr("AGENT_ADDRESS", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);
        GenieVault vault = new GenieVault(usdc, yieldVault, agent);
        vm.stopBroadcast();

        console.log("GenieVault:", address(vault));
        console.log("  usdc:      ", usdc);
        console.log("  yieldVault:", yieldVault);
        console.log("  agent:     ", agent);
    }
}
