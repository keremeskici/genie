// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {GenieVault} from "../src/GenieVault.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {MockERC4626} from "./MockERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GenieVaultTest is Test {
    MockUSDC usdc;
    MockERC4626 yieldVault;
    GenieVault vault;

    address owner = address(this);
    address agent = address(0xA9);
    address user = address(0xBEEF);
    address recipient = address(0xCAFE);

    uint256 constant DEPOSIT = 100e6; // 100 USDC

    function setUp() public {
        usdc = new MockUSDC();
        yieldVault = new MockERC4626(IERC20(address(usdc)));
        vault = new GenieVault(address(usdc), address(yieldVault), agent);

        // Fund the user and have them deposit into the vault.
        usdc.mint(user, DEPOSIT);
        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT);
        vault.deposit(DEPOSIT);
        vm.stopPrank();
    }

    // ─────────────── construction ───────────────

    function test_ConstructorSetsState() public view {
        assertEq(address(vault.usdc()), address(usdc));
        assertEq(address(vault.yieldVault()), address(yieldVault));
        assertEq(vault.agent(), agent);
        assertEq(vault.owner(), owner);
    }

    function test_ConstructorRevertsOnZeroAddress() public {
        vm.expectRevert("zero addr");
        new GenieVault(address(0), address(yieldVault), agent);
    }

    // ─────────────── deposit ───────────────

    function test_DepositCreditsShares() public {
        assertGt(vault.shares(user), 0);
        assertApproxEqAbs(vault.balanceOfAssets(user), DEPOSIT, 1);
    }

    function test_DepositRevertsOnZero() public {
        vm.prank(user);
        vm.expectRevert("zero amount");
        vault.deposit(0);
    }

    function test_BalanceReflectsYield() public {
        // Simulate ~10% yield by donating underlying to the yield vault.
        uint256 yieldAmt = 10e6;
        usdc.mint(owner, yieldAmt);
        usdc.approve(address(yieldVault), yieldAmt);
        yieldVault.simulateYield(yieldAmt);

        assertApproxEqAbs(vault.balanceOfAssets(user), DEPOSIT + yieldAmt, 1e4);
    }

    // ─────────────── agentTransfer ───────────────

    function test_AgentTransferMovesFundsWithinLimit() public {
        vm.prank(agent);
        vault.setSpendingLimit(user, 50e6);

        vm.prank(agent);
        vault.agentTransfer(user, recipient, 30e6);

        assertEq(usdc.balanceOf(recipient), 30e6);
        assertApproxEqAbs(vault.balanceOfAssets(user), 70e6, 1e3);
    }

    function test_AgentTransferRevertsOverLimit() public {
        vm.prank(agent);
        vault.setSpendingLimit(user, 20e6);

        vm.prank(agent);
        vm.expectRevert("exceeds limit");
        vault.agentTransfer(user, recipient, 30e6);
    }

    function test_AgentTransferRevertsForNonAgent() public {
        vm.prank(agent);
        vault.setSpendingLimit(user, 50e6);

        vm.prank(user); // not the agent
        vm.expectRevert("only agent");
        vault.agentTransfer(user, recipient, 10e6);
    }

    function test_AgentTransferDefaultLimitIsZero() public {
        // No limit set ⇒ blocked.
        vm.prank(agent);
        vm.expectRevert("exceeds limit");
        vault.agentTransfer(user, recipient, 1e6);
    }

    // ─────────────── agentWithdraw ───────────────

    function test_AgentWithdrawReturnsFundsToUser() public {
        vm.prank(agent);
        vault.agentWithdraw(user, 40e6);

        assertEq(usdc.balanceOf(user), 40e6);
        assertApproxEqAbs(vault.balanceOfAssets(user), 60e6, 1e3);
    }

    function test_AgentWithdrawNotCappedBySpendingLimit() public {
        // spendingLimit is 0 by default, but agentWithdraw still works (funds go to owner).
        vm.prank(agent);
        vault.agentWithdraw(user, 100e6);
        assertApproxEqAbs(usdc.balanceOf(user), 100e6, 1e3);
    }

    // ─────────────── self-service ───────────────

    function test_UserSelfWithdraw() public {
        vm.prank(user);
        vault.withdraw(25e6);
        assertEq(usdc.balanceOf(user), 25e6);
    }

    function test_UserWithdrawAllEmptiesBalance() public {
        vm.prank(user);
        vault.withdrawAll();
        assertEq(vault.shares(user), 0);
        assertApproxEqAbs(usdc.balanceOf(user), DEPOSIT, 1);
    }

    // ─────────────── pause ───────────────

    function test_PauseBlocksAgentTransferButNotSelfWithdraw() public {
        vault.setPaused(true);

        vm.prank(agent);
        vault.setSpendingLimit(user, 50e6);
        vm.prank(agent);
        vm.expectRevert("paused");
        vault.agentTransfer(user, recipient, 10e6);

        // Self-withdraw still works as an escape hatch.
        vm.prank(user);
        vault.withdraw(10e6);
        assertEq(usdc.balanceOf(user), 10e6);
    }

    // ─────────────── admin guards ───────────────

    function test_SetSpendingLimitOnlyAgent() public {
        vm.prank(user);
        vm.expectRevert("only agent");
        vault.setSpendingLimit(user, 10e6);
    }

    function test_SetAgentOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        vault.setAgent(address(0x123));

        vault.setAgent(address(0x123));
        assertEq(vault.agent(), address(0x123));
    }

    function test_RescueCannotTouchShares() public {
        vm.expectRevert("cannot touch shares");
        vault.rescueToken(address(yieldVault), owner, 1);
    }
}
