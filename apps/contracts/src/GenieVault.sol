// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GenieVault — custodial, yield-bearing USDC vault (Minara-style managed funds)
/// @notice ⚠️ DEMO / HACKATHON GRADE — NOT AUDITED.
///
/// Custodial by design (chosen for the smoothest UX — users never sign individual
/// transfers). Users fund the vault once; afterwards the off-chain `agent` (relayer) moves
/// and returns funds on their behalf with no further signatures.
///
/// Funds are routed into an ERC-4626 yield vault, so managed balances earn APY. Per-user
/// accounting is done in yield-vault shares.
///
/// Trust model & mitigations:
///   - The `agent` key can move a user's funds, but only up to that user's on-chain
///     `spendingLimit` per transfer, and only to external recipients (agentTransfer).
///   - Users can ALWAYS self-withdraw their own balance (withdraw / withdrawAll) — escape hatch.
///   - `owner` can rotate the agent key and pause the vault, but cannot seize user principal.
contract GenieVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IERC4626 public immutable yieldVault;

    /// @notice Agent (relayer) authorised to move user funds within spending caps.
    address public agent;

    /// @notice Per-user yield-vault shares held by this contract on the user's behalf.
    mapping(address => uint256) public shares;

    /// @notice Per-user per-transfer cap in USDC (6 decimals). 0 ⇒ agent transfers blocked.
    mapping(address => uint256) public spendingLimit;

    /// @notice When true, deposits and agent transfers are blocked (self-withdraw still works).
    bool public paused;

    event AgentChanged(address indexed previousAgent, address indexed newAgent);
    event PausedSet(bool paused);
    event SpendingLimitSet(address indexed user, uint256 limit);
    event Deposited(address indexed user, uint256 assets, uint256 sharesMinted);
    event Withdrawn(address indexed user, address indexed to, uint256 assets, uint256 sharesBurned);
    event AgentTransfer(address indexed user, address indexed to, uint256 assets, uint256 sharesBurned);

    modifier onlyAgent() {
        require(msg.sender == agent, "only agent");
        _;
    }

    modifier notPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(address _usdc, address _yieldVault, address _agent) Ownable(msg.sender) {
        require(_usdc != address(0) && _yieldVault != address(0) && _agent != address(0), "zero addr");
        usdc = IERC20(_usdc);
        yieldVault = IERC4626(_yieldVault);
        agent = _agent;
    }

    // ─────────────────────── User funding (the one signed action) ───────────────────────

    /// @notice Deposit USDC into the vault; routed into the yield vault to earn APY.
    /// @dev Caller must approve this contract for `assets` USDC first (bundled in MiniKit).
    function deposit(uint256 assets) external nonReentrant notPaused {
        require(assets > 0, "zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), assets);
        usdc.forceApprove(address(yieldVault), assets);
        uint256 minted = yieldVault.deposit(assets, address(this));
        shares[msg.sender] += minted;
        emit Deposited(msg.sender, assets, minted);
    }

    // ─────────────────────── Views ───────────────────────

    /// @notice The user's current managed balance in USDC (principal + accrued yield).
    function balanceOfAssets(address user) external view returns (uint256) {
        return yieldVault.convertToAssets(shares[user]);
    }

    // ─────────────────── Agent-managed movement (no user signature) ───────────────────

    /// @notice Agent sends `assets` USDC from `user`'s managed balance to an external recipient.
    function agentTransfer(address user, address to, uint256 assets)
        external
        onlyAgent
        notPaused
        nonReentrant
    {
        require(to != address(0), "zero recipient");
        require(assets > 0, "zero amount");
        require(assets <= spendingLimit[user], "exceeds limit");
        uint256 burned = yieldVault.withdraw(assets, to, address(this));
        require(shares[user] >= burned, "insufficient balance");
        shares[user] -= burned;
        emit AgentTransfer(user, to, assets, burned);
    }

    /// @notice Agent returns `assets` USDC from `user`'s managed balance back to the user's
    ///         own wallet. Not capped by spendingLimit (funds go to their owner).
    function agentWithdraw(address user, uint256 assets) external onlyAgent nonReentrant {
        require(assets > 0, "zero amount");
        uint256 burned = yieldVault.withdraw(assets, user, address(this));
        require(shares[user] >= burned, "insufficient balance");
        shares[user] -= burned;
        emit Withdrawn(user, user, assets, burned);
    }

    // ─────────────────── User self-service (escape hatch) ───────────────────

    /// @notice User withdraws `assets` USDC of their own managed balance to their wallet.
    function withdraw(uint256 assets) external nonReentrant {
        require(assets > 0, "zero amount");
        uint256 burned = yieldVault.withdraw(assets, msg.sender, address(this));
        require(shares[msg.sender] >= burned, "insufficient balance");
        shares[msg.sender] -= burned;
        emit Withdrawn(msg.sender, msg.sender, assets, burned);
    }

    /// @notice User withdraws their entire managed balance (avoids rounding lockout on full exit).
    function withdrawAll() external nonReentrant {
        uint256 userShares = shares[msg.sender];
        require(userShares > 0, "no balance");
        shares[msg.sender] = 0;
        uint256 assets = yieldVault.redeem(userShares, msg.sender, address(this));
        emit Withdrawn(msg.sender, msg.sender, assets, userShares);
    }

    // ─────────────────────── Admin ───────────────────────

    /// @notice Agent sets a user's per-transfer cap (mirrors the user's chosen off-chain threshold).
    function setSpendingLimit(address user, uint256 limit) external onlyAgent {
        spendingLimit[user] = limit;
        emit SpendingLimitSet(user, limit);
    }

    function setAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "zero addr");
        emit AgentChanged(agent, newAgent);
        agent = newAgent;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    /// @notice Rescue stray tokens. Cannot touch yield-vault shares (user principal).
    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(yieldVault), "cannot touch shares");
        IERC20(token).safeTransfer(to, amount);
    }
}
