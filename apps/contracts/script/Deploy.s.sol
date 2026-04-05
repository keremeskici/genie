// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {GenieRouter} from "../src/GenieRouter.sol";
import {PayHandler} from "../src/PayHandler.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("RELAYER_PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerKey);
        GenieRouter router = new GenieRouter(usdc);
        PayHandler handler = new PayHandler(usdc);
        vm.stopBroadcast();

        console.log("GenieRouter:", address(router));
        console.log("PayHandler:", address(handler));
    }
}
