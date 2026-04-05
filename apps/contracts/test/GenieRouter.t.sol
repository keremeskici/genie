// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {GenieRouter} from "../src/GenieRouter.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// @dev Minimal mock that mimics Permit2 AllowanceTransfer.transferFrom
contract MockPermit2 {
    function transferFrom(address from, address to, uint160 amount, address token) external {
        // Simulate Permit2 by doing a direct ERC20 transferFrom (token must have allowance to this contract)
        (bool ok, ) = token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, uint256(amount)));
        require(ok, "MockPermit2: transferFrom failed");
    }
}

contract GenieRouterTest is Test {
    GenieRouter public router;
    MockUSDC public usdc;
    MockPermit2 public permit2;
    address public relayer;
    address public user;
    address public handler;

    function setUp() public {
        relayer = address(this);
        user = makeAddr("user");
        handler = makeAddr("handler");

        usdc = new MockUSDC();
        permit2 = new MockPermit2();
        router = new GenieRouter(address(usdc), address(permit2));
    }

    function test_ConstructorSetsUsdcPermit2AndOwner() public {
        assertEq(router.usdc(), address(usdc));
        assertEq(router.permit2(), address(permit2));
        assertEq(router.owner(), address(this));
    }

    function test_RouteTransfersUsdcFromSenderToHandler() public {
        uint256 amount = 10 * 1e6; // 10 USDC

        // Mint USDC to user and approve Permit2 (like World App does automatically)
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(permit2), amount);

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
        usdc.approve(address(permit2), amount);

        vm.prank(attacker);
        vm.expectRevert("only relayer");
        router.route(user, amount, handler);
    }

    function test_RouteRevertsWhenNoPermit2Allowance() public {
        uint256 amount = 10 * 1e6;
        usdc.mint(user, amount);
        // No Permit2 approval given

        vm.expectRevert();
        router.route(user, amount, handler);
    }
}
