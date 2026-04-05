export const GenieRouterAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_usdc', type: 'address' },
      { name: '_permit2', type: 'address' },
    ],
  },
  {
    type: 'function',
    name: 'route',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'handler', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

export const PayHandlerAbi = [
  {
    type: 'constructor',
    inputs: [{ name: '_usdc', type: 'address' }],
  },
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;
