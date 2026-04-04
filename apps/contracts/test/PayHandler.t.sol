// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {PayHandler} from "../src/PayHandler.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract PayHandlerTest is Test {
    PayHandler public handler;
    MockUSDC public usdc;
    address public relayer;
    address public recipient;

    function setUp() public {
        relayer = address(this);
        recipient = makeAddr("recipient");

        usdc = new MockUSDC();
        handler = new PayHandler(address(usdc));
    }

    function test_ConstructorSetsUsdcAndOwner() public {
        assertEq(handler.usdc(), address(usdc));
        assertEq(handler.owner(), address(this));
    }

    function test_ExecuteTransfersUsdcToRecipient() public {
        uint256 amount = 25 * 1e6; // 25 USDC

        // Fund the handler contract
        usdc.mint(address(handler), amount);

        // Relayer (owner) calls execute
        handler.execute(recipient, amount);

        assertEq(usdc.balanceOf(address(handler)), 0);
        assertEq(usdc.balanceOf(recipient), amount);
    }

    function test_ExecuteRevertsForNonOwner() public {
        uint256 amount = 25 * 1e6;
        address attacker = makeAddr("attacker");

        usdc.mint(address(handler), amount);

        vm.prank(attacker);
        vm.expectRevert("only relayer");
        handler.execute(recipient, amount);
    }

    function test_ExecuteRevertsWhenInsufficientBalance() public {
        uint256 amount = 25 * 1e6;
        // No USDC minted to handler

        vm.expectRevert();
        handler.execute(recipient, amount);
    }
}
