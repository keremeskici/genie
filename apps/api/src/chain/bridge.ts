import { erc20Abi, parseUnits, pad } from 'viem';
import { getWalletClient, relayerAccount, chain, GENIE_ROUTER_ADDRESS, USDC_ADDRESS } from './clients';
import { GenieRouterAbi } from '../contracts/abis';

// ─── CCTP V2 — hardcoded mainnet addresses ──────────────────────
const TOKEN_MESSENGER_V2 = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64' as `0x${string}`;

const TokenMessengerV2Abi = [
  {
    type: 'function',
    name: 'depositForBurn',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * CCTP V2 domain IDs for supported destination chains (from Circle docs).
 * Source domain: World Chain = 14
 */
export const CCTP_DOMAIN_IDS: Record<string, number> = {
  ethereum: 0,
  optimism: 2,
  arbitrum: 3,
  base: 6,
};

/**
 * bridgeUsdc — CCTP V2 bridge utility.
 *
 * Executes 3 on-chain steps:
 * 1. GenieRouter.route(sender, amount, relayer) — pull USDC from user to relayer via Permit2
 * 2. USDC.approve(TokenMessengerV2, amount) — approve TokenMessenger to spend relayer's USDC
 * 3. TokenMessengerV2.depositForBurn(...) — initiate CCTP bridge to destination chain
 */
export async function bridgeUsdc(params: {
  senderWallet: `0x${string}`;
  amountUsd: number;
  destinationChain: string;
  recipientWallet: string;
}): Promise<{ routeTxHash: string; approveTxHash: string; bridgeTxHash: string }> {
  const { senderWallet, amountUsd, destinationChain, recipientWallet } = params;

  if (!(destinationChain in CCTP_DOMAIN_IDS)) {
    throw new Error(`Unknown destination chain: ${destinationChain}`);
  }

  const walletClient = getWalletClient();
  const relayer = relayerAccount();
  const amountUnits = parseUnits(amountUsd.toString(), 6);

  // Step 1: Pull funds from User to Relayer via GenieRouter (Permit2 under the hood)
  const routeTxHash = await walletClient.writeContract({
    account: relayer,
    chain,
    address: GENIE_ROUTER_ADDRESS,
    abi: GenieRouterAbi,
    functionName: 'route',
    args: [senderWallet, amountUnits, relayer.address],
  });

  console.log(`[bridge] Pull TX: ${routeTxHash}`);

  // Step 2: Approve TokenMessenger V2 to spend relayer's USDC (direct ERC20 approve — relayer is EOA)
  const approveTxHash = await walletClient.writeContract({
    account: relayer,
    chain,
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'approve',
    args: [TOKEN_MESSENGER_V2, amountUnits],
  });

  console.log(`[bridge] Approve Messenger TX: ${approveTxHash}`);

  // Step 3: Trigger CCTP V2 Bridge (depositForBurn)
  const destinationDomain = CCTP_DOMAIN_IDS[destinationChain];
  const mintRecipient = pad(recipientWallet as `0x${string}`, { size: 32 });

  const bridgeTxHash = await walletClient.writeContract({
    account: relayer,
    chain,
    address: TOKEN_MESSENGER_V2,
    abi: TokenMessengerV2Abi,
    functionName: 'depositForBurn',
    args: [amountUnits, destinationDomain, mintRecipient, USDC_ADDRESS],
  });

  console.log(`[bridge] Bridge TX: ${bridgeTxHash}`);

  return { routeTxHash, approveTxHash, bridgeTxHash };
}
