import { parseUnits } from 'viem';
import { getWalletClient, relayerAccount, chain, GENIE_ROUTER_ADDRESS, PAY_HANDLER_ADDRESS } from './clients';
import { GenieRouterAbi, PayHandlerAbi } from '../contracts/abis';

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
