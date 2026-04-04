// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {GenieRouter} from "../src/GenieRouter.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract GenieRouterTest is Test {
    GenieRouter public router;
    MockUSDC public usdc;
    address public relayer;
    address public user;
    address public handler;

    function setUp() public {
        relayer = address(this);
        user = makeAddr("user");
        handler = makeAddr("handler");

        usdc = new MockUSDC();
        router = new GenieRouter(address(usdc));
    }

    function test_ConstructorSetsUsdcAndOwner() public {
        assertEq(router.usdc(), address(usdc));
        assertEq(router.owner(), address(this));
    }

    function test_RouteTransfersUsdcFromSenderToHandler() public {
        uint256 amount = 10 * 1e6; // 10 USDC

        // Mint USDC to user and approve router
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(router), amount);

        // Relayer (owner) calls route
        router.route(user, amount, handler);

        assertEq(usdc.balanceOf(user), 0);
        assertEq(usdc.balanceOf(handler), amount);
    }

    function test_RouteRevertsForNonOwner() public {
        uint256 amount = 10 * 1e6;
        address attacker = makeAddr("attacker");

        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(router), amount);

        vm.prank(attacker);
        vm.expectRevert("only relayer");
        router.route(user, amount, handler);
    }

    function test_RouteRevertsWhenInsufficientAllowance() public {
        uint256 amount = 10 * 1e6;
        usdc.mint(user, amount);
        // No approval given

        vm.expectRevert();
        router.route(user, amount, handler);
    }
}
