/**
 * GenieVault ABI (custodial, yield-bearing USDC vault).
 *
 * Pure data — safe to import from both client (funding bundle) and server (agent ops).
 * Mirrors apps/contracts/src/GenieVault.sol.
 */
export const GenieVaultAbi = [
  // ── User funding (the one signed action) ──
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [],
  },
  // ── Views ──
  {
    type: 'function',
    name: 'balanceOfAssets',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'shares',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'spendingLimit',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ── Agent-managed movement (no user signature) ──
  {
    type: 'function',
    name: 'agentTransfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'assets', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'agentWithdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'assets', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSpendingLimit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [],
  },
  // ── User self-service (escape hatch) ──
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawAll',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;
