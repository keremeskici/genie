import { createPublicClient, createWalletClient, http } from 'viem';
import { worldchain } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  WORLD_CHAIN_RPC_URL,
  RELAYER_PRIVATE_KEY,
} from '../config/env';

// ─── Hardcoded mainnet addresses (World Chain 480) ───────────────
export const GENIE_ROUTER_ADDRESS = '0x24079Ecda5eEd48a052Bbf795A54b05233B17102' as `0x${string}`;
export const PAY_HANDLER_ADDRESS = '0x754F7fEaBf1950562c00f4e706cd8002f386F4e0' as `0x${string}`;
export const USDC_ADDRESS = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' as `0x${string}`;

export const chain = worldchain;

export const publicClient = createPublicClient({
  chain,
  transport: http(WORLD_CHAIN_RPC_URL),
});

// Lazy-init wallet client to avoid crash when RELAYER_PRIVATE_KEY not set (e.g., in tests importing this module indirectly)
let _walletClient: ReturnType<typeof createWalletClient> | null = null;
let _relayerAccount: ReturnType<typeof privateKeyToAccount> | null = null;

function getRelayerAccountInstance() {
  if (!_relayerAccount) {
    const key = RELAYER_PRIVATE_KEY;
    if (!key) throw new Error('RELAYER_PRIVATE_KEY env var is required for wallet operations');
    _relayerAccount = privateKeyToAccount(key as `0x${string}`);
  }
  return _relayerAccount;
}

export function getWalletClient() {
  if (!_walletClient) {
    _walletClient = createWalletClient({
      account: getRelayerAccountInstance(),
      chain,
      transport: http(WORLD_CHAIN_RPC_URL),
    });
  }
  return _walletClient;
}

export function relayerAccount() {
  return getRelayerAccountInstance();
}
