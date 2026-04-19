import { parseUnits } from 'viem';
import { getWalletClient, relayerAccount, chain, GENIE_ROUTER_ADDRESS, PAY_HANDLER_ADDRESS } from './clients';
import { GenieRouterAbi, PayHandlerAbi } from '../contracts/abis';
import { MOCK_CHAIN_TRANSFERS } from '../config/env';

/**
 * executeOnChainTransfer — Two-step on-chain transfer orchestration (D-03).
 *
 * Step 1: GenieRouter.route(sender, amount, payHandlerAddress)
 *   Pulls USDC from sender's allowance via the router contract.
 *
 * Step 2: PayHandler.execute(recipient, amount)
 *   Sends USDC to the final recipient address.
 *
 * Amount is converted from USD float to USDC 6-decimal units via parseUnits.
 */
export async function executeOnChainTransfer(
  senderWallet: `0x${string}`,
  recipientWallet: `0x${string}`,
  amountUsd: number,
): Promise<{ routeTxHash: string; executeTxHash: string }> {
  if (MOCK_CHAIN_TRANSFERS) {
    console.warn('[chain] MOCK_CHAIN_TRANSFERS=true — returning mock tx hashes');
    const seed = `${senderWallet}-${recipientWallet}-${amountUsd}-${Date.now()}`;
    const encoded = Buffer.from(seed).toString('hex').padEnd(64, '0').slice(0, 64);
    return {
      routeTxHash: `0x${encoded}`,
      executeTxHash: `0x${encoded.split('').reverse().join('')}`,
    };
  }

  const walletClient = getWalletClient();
  const amount = parseUnits(amountUsd.toString(), 6); // USDC 6 decimals

  // Step 1: GenieRouter.route(sender, amount, payHandlerAddress) — pulls from user's USDC allowance
  const routeTxHash = await walletClient.writeContract({
    account: relayerAccount(),
    chain,
    address: GENIE_ROUTER_ADDRESS,
    abi: GenieRouterAbi,
    functionName: 'route',
    args: [senderWallet, amount, PAY_HANDLER_ADDRESS],
  });

  // Step 2: PayHandler.execute(recipient, amount) — sends to final recipient
  const executeTxHash = await walletClient.writeContract({
    account: relayerAccount(),
    chain,
    address: PAY_HANDLER_ADDRESS,
    abi: PayHandlerAbi,
    functionName: 'execute',
    args: [recipientWallet, amount],
  });

  return { routeTxHash, executeTxHash };
}
