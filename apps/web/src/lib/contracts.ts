export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`;

export const PERMIT2_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
  },
] as const;

export const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const DEFAULT_USDC_ADDRESS = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' as `0x${string}`;
export const DEFAULT_GENIE_ROUTER_ADDRESS = '0x24079Ecda5eEd48a052Bbf795A54b05233B17102' as `0x${string}`;

export const USDC_ADDRESS = DEFAULT_USDC_ADDRESS;
export const GENIE_ROUTER_ADDRESS = DEFAULT_GENIE_ROUTER_ADDRESS;
