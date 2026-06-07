import { parseUnits, formatUnits } from 'viem';
import { GenieVaultAbi } from '@/lib/genie-vault-abi';
import {
  publicClient,
  getWalletClient,
  agentAccount,
  chain,
  GENIE_VAULT_ADDRESS,
} from './clients';

/**
 * GenieVault agent-side helpers.
 *
 * The agent (relayer) moves and returns user funds with no per-tx user signature, within
 * each user's on-chain spending cap. USDC amounts are 6-decimal.
 *
 * ⚠️ Custodial / demo-grade — RELAYER_PRIVATE_KEY is the agent key that can move user funds.
 */

function assertVaultConfigured() {
  if (GENIE_VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
    throw new Error('GENIE_VAULT_ADDRESS is not configured — deploy GenieVault and set the env var');
  }
}

/**
 * Agent sends `amountUsd` from `userWallet`'s managed balance to `to`. No user signature.
 * Returns the on-chain transaction hash after the receipt confirms.
 */
export async function agentTransfer(
  userWallet: `0x${string}`,
  to: `0x${string}`,
  amountUsd: number,
): Promise<`0x${string}`> {
  assertVaultConfigured();
  const assets = parseUnits(amountUsd.toFixed(6), 6);
  const walletClient = getWalletClient();

  const txHash = await walletClient.writeContract({
    address: GENIE_VAULT_ADDRESS,
    abi: GenieVaultAbi,
    functionName: 'agentTransfer',
    args: [userWallet, to, assets],
    account: agentAccount(),
    chain,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * Agent returns `amountUsd` from `userWallet`'s managed balance back to the user's own wallet.
 */
export async function agentWithdraw(
  userWallet: `0x${string}`,
  amountUsd: number,
): Promise<`0x${string}`> {
  assertVaultConfigured();
  const assets = parseUnits(amountUsd.toFixed(6), 6);
  const walletClient = getWalletClient();

  const txHash = await walletClient.writeContract({
    address: GENIE_VAULT_ADDRESS,
    abi: GenieVaultAbi,
    functionName: 'agentWithdraw',
    args: [userWallet, assets],
    account: agentAccount(),
    chain,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * Read a user's managed vault balance (principal + accrued yield) as a 6-decimal USDC string.
 */
export async function readVaultBalance(userWallet: `0x${string}`): Promise<string> {
  assertVaultConfigured();
  const raw = (await publicClient.readContract({
    address: GENIE_VAULT_ADDRESS,
    abi: GenieVaultAbi,
    functionName: 'balanceOfAssets',
    args: [userWallet],
  })) as bigint;
  return formatUnits(raw, 6);
}

/**
 * Agent sets a user's on-chain per-transfer spending cap (mirrors their off-chain autoApproveUsd).
 * Returns the transaction hash. Best-effort: callers may swallow errors so a lagging tx doesn't
 * block the request.
 */
export async function setSpendingLimit(
  userWallet: `0x${string}`,
  limitUsd: number,
): Promise<`0x${string}`> {
  assertVaultConfigured();
  const limit = parseUnits(limitUsd.toFixed(6), 6);
  const walletClient = getWalletClient();

  const txHash = await walletClient.writeContract({
    address: GENIE_VAULT_ADDRESS,
    abi: GenieVaultAbi,
    functionName: 'setSpendingLimit',
    args: [userWallet, limit],
    account: agentAccount(),
    chain,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
