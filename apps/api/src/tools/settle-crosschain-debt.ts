import { tool } from 'ai';
import { z } from 'zod';
import { requireVerified } from './require-verified';
import { db, debts, transactions, eq, and } from '@genie/db';
import { getWalletClient, relayerAccount, GENIE_ROUTER_ADDRESS, USDC_ADDRESS } from '../chain/clients';
import { GenieRouterAbi } from '../contracts/abis';
import { parseUnits, encodeAbiParameters, parseAbiParameters, erc20Abi, pad } from 'viem';
import type { UserContext } from '../agent/context';

// Circle CCTP Testnet (Sepolia) Mappings
const TOKEN_MESSENGER_WORLD_CHAIN = '0x1682bd6a475003921322496e952627702f7823f9';

const DOMAIN_IDS: Record<string, number> = {
  ethereum: 0,
  avalanche: 1,
  optimism: 2,
  arbitrum: 3,
  solana: 5,
  base: 6,
  arc: 30, // Arc L1 Sepolia Domain ID (Estimated for Hackathon)
  noble: 4, // Noble Testnet Domain ID
};

const TokenMessengerAbi = [
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
 * settle_crosschain_debt tool factory — implements the "Escrow-to-Anywhere" flow.
 * 
 * Flow:
 * 1. Pull funds from debtor's allowance to the Genie Relayer via GenieRouter.route.
 * 2. Initiate CCTP bridge to move funds to the creditor's wallet on the destination chain.
 * 3. Update local DB records.
 */
export function createSettleCrosschainDebtTool(userId: string, userContext: UserContext) {
  return tool({
    description:
      'Settle an existing debt by sending USDC to a friend on a different blockchain (like Base, Noble, or Arc). This uses the Genie Escrow system and Circle CCTP to bridge funds.',
    inputSchema: z.object({
      debtId: z.string().describe('The unique ID of the debt to settle'),
      destinationChain: z
        .enum(['base', 'noble', 'arc', 'ethereum', 'optimism', 'arbitrum', 'solana'])
        .describe('The blockchain where the recipient wants to receive their funds'),
      destinationWallet: z.string().describe('The recipient wallet address on the destination chain'),
    }),
    execute: async ({ debtId, destinationChain, destinationWallet }) => {
      // Gate: require World ID verification
      const gateError = requireVerified(userContext);
      if (gateError) return gateError;

      try {
        // 1. Fetch the debt record
        const [debt] = await db
          .select()
          .from(debts)
          .where(and(eq(debts.id, debtId), eq(debts.ownerUserId, userId)))
          .limit(1);

        if (!debt) {
          return { error: 'DEBT_NOT_FOUND', message: 'Could not find the specified debt record.' };
        }

        if (debt.settled) {
          return { error: 'ALREADY_SETTLED', message: 'This debt has already been settled.' };
        }

        const amountUnits = parseUnits(debt.amountUsd, 6); // USDC 6 decimals
        const walletClient = getWalletClient();
        const relayer = relayerAccount();

        // 2. Step 1: Pull funds from User to Relayer (Escrow) on World Chain
        // GenieRouter.route(sender, amount, handler)
        const routeTxHash = await walletClient.writeContract({
          account: relayer,
          address: GENIE_ROUTER_ADDRESS,
          abi: GenieRouterAbi,
          functionName: 'route',
          args: [userContext.walletAddress as `0x${string}`, amountUnits, relayer.address],
        });

        console.log(`[tool:settle_crosschain_debt] Pull TX: ${routeTxHash}`);

        // 3. Step 2: Approve TokenMessenger to spend relayer's USDC
        const approveMessengerHash = await walletClient.writeContract({
          account: relayer,
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [TOKEN_MESSENGER_WORLD_CHAIN, amountUnits],
        });

        console.log(`[tool:settle_crosschain_debt] Approve Messenger TX: ${approveMessengerHash}`);

        // 4. Step 3: Trigger CCTP Bridge (depositForBurn)
        const destinationDomain = DOMAIN_IDS[destinationChain];
        const mintRecipient = pad(destinationWallet as `0x${string}`, { size: 32 });

        const bridgeTxHash = await walletClient.writeContract({
          account: relayer,
          address: TOKEN_MESSENGER_WORLD_CHAIN,
          abi: TokenMessengerAbi,
          functionName: 'depositForBurn',
          args: [amountUnits, destinationDomain, mintRecipient, USDC_ADDRESS],
        });

        console.log(`[tool:settle_crosschain_debt] Bridge TX: ${bridgeTxHash}`);
        
        // 5. Record the settlement transaction
        await db.insert(transactions).values({
          senderUserId: userId,
          recipientWallet: destinationWallet,
          amountUsd: debt.amountUsd,
          txHash: bridgeTxHash, // Use bridge hash for tracking
          status: 'confirmed',
          source: 'genie_bridge',
          category: 'transfers',
        });

        // 6. Mark debt as settled
        await db
          .update(debts)
          .set({ settled: true })
          .where(eq(debts.id, debtId));

        return {
          type: 'settlement_initiated',
          debtId,
          amount: debt.amountUsd,
          destinationChain,
          destinationWallet,
          routeTxHash,
          bridgeTxHash,
          status: 'bridging',
          message: `I've successfully initiated the cross-chain settlement. I've pulled ${debt.amountUsd} USDC and burned it for minting on ${destinationChain}. Bob will receive it in ~15 mins!`,
        };
      } catch (err) {
        console.error('[tool:settle_crosschain_debt] error:', err);
        return {
          error: 'SETTLEMENT_FAILED',
          message: `Cross-chain settlement failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}
