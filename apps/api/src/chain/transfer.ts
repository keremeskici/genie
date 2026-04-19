import { erc20Abi, formatUnits, parseUnits } from 'viem';
import {
  getWalletClient,
  relayerAccount,
  chain,
  GENIE_ROUTER_ADDRESS,
  PAY_HANDLER_ADDRESS,
  USDC_ADDRESS,
  publicClient,
} from './clients';
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

async function readUsdcBalance(wallet: `0x${string}`) {
  return publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [wallet],
  });
}

async function readRouterAllowance(owner: `0x${string}`) {
  return publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, GENIE_ROUTER_ADDRESS],
  });
}

function usdc(raw: bigint) {
  return formatUnits(raw, 6);
}

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
  const relayer = relayerAccount();
  const amount = parseUnits(amountUsd.toString(), 6); // USDC 6 decimals
  const transferId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const [senderBefore, recipientBefore, handlerBefore, allowanceBefore] = await Promise.all([
    readUsdcBalance(senderWallet),
    readUsdcBalance(recipientWallet),
    readUsdcBalance(PAY_HANDLER_ADDRESS),
    readRouterAllowance(senderWallet),
  ]);

  console.log(
    `[chain:transfer:${transferId}] start amount=${amountUsd} raw=${amount.toString()} sender=${senderWallet} recipient=${recipientWallet} relayer=${relayer.address} router=${GENIE_ROUTER_ADDRESS} handler=${PAY_HANDLER_ADDRESS} usdc=${USDC_ADDRESS}`,
  );
  console.log(
    `[chain:transfer:${transferId}] before sender=${usdc(senderBefore)} recipient=${usdc(recipientBefore)} handler=${usdc(handlerBefore)} routerAllowance=${usdc(allowanceBefore)}`,
  );

  // Step 1: GenieRouter.route(sender, amount, payHandlerAddress) — pulls from user's USDC allowance
  const routeTxHash = await walletClient.writeContract({
    account: relayer,
    chain,
    address: GENIE_ROUTER_ADDRESS,
    abi: GenieRouterAbi,
    functionName: 'route',
    args: [senderWallet, amount, PAY_HANDLER_ADDRESS],
  });
  console.log(`[chain:transfer:${transferId}] route submitted tx=${routeTxHash}`);

  const routeReceipt = await publicClient.waitForTransactionReceipt({ hash: routeTxHash });
  console.log(
    `[chain:transfer:${transferId}] route receipt status=${routeReceipt.status} block=${routeReceipt.blockNumber} gasUsed=${routeReceipt.gasUsed}`,
  );

  if (routeReceipt.status !== 'success') {
    throw new Error(`Route transaction failed: ${routeTxHash}`);
  }

  const [senderAfterRoute, handlerAfterRoute, allowanceAfterRoute] = await Promise.all([
    readUsdcBalance(senderWallet),
    readUsdcBalance(PAY_HANDLER_ADDRESS),
    readRouterAllowance(senderWallet),
  ]);
  console.log(
    `[chain:transfer:${transferId}] after route sender=${usdc(senderAfterRoute)} handler=${usdc(handlerAfterRoute)} routerAllowance=${usdc(allowanceAfterRoute)}`,
  );

  // Step 2: PayHandler.execute(recipient, amount) — sends to final recipient
  const executeTxHash = await walletClient.writeContract({
    account: relayer,
    chain,
    address: PAY_HANDLER_ADDRESS,
    abi: PayHandlerAbi,
    functionName: 'execute',
    args: [recipientWallet, amount],
  });
  console.log(`[chain:transfer:${transferId}] execute submitted tx=${executeTxHash}`);

  const executeReceipt = await publicClient.waitForTransactionReceipt({ hash: executeTxHash });
  console.log(
    `[chain:transfer:${transferId}] execute receipt status=${executeReceipt.status} block=${executeReceipt.blockNumber} gasUsed=${executeReceipt.gasUsed}`,
  );

  if (executeReceipt.status !== 'success') {
    throw new Error(`Execute transaction failed: ${executeTxHash}`);
  }

  const [senderAfter, recipientAfter, handlerAfter, allowanceAfter] = await Promise.all([
    readUsdcBalance(senderWallet),
    readUsdcBalance(recipientWallet),
    readUsdcBalance(PAY_HANDLER_ADDRESS),
    readRouterAllowance(senderWallet),
  ]);
  console.log(
    `[chain:transfer:${transferId}] after execute sender=${usdc(senderAfter)} recipient=${usdc(recipientAfter)} handler=${usdc(handlerAfter)} routerAllowance=${usdc(allowanceAfter)}`,
  );

  return { routeTxHash, executeTxHash };
}
