import { createPublicClient, createWalletClient, http } from 'viem';
import { worldchain, worldchainSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const isTestnet = process.env.WORLD_CHAIN_TESTNET === 'true';
const chain = isTestnet ? worldchainSepolia : worldchain;
const rpcUrl = process.env.WORLD_CHAIN_RPC_URL;

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

// Lazy-init wallet client to avoid crash when RELAYER_PRIVATE_KEY not set (e.g., in tests importing this module indirectly)
let _walletClient: ReturnType<typeof createWalletClient> | null = null;
let _relayerAccount: ReturnType<typeof privateKeyToAccount> | null = null;

function getRelayerAccountInstance() {
  if (!_relayerAccount) {
    const key = process.env.RELAYER_PRIVATE_KEY;
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
      transport: http(rpcUrl),
    });
  }
  return _walletClient;
}

export function relayerAccount() {
  return getRelayerAccountInstance();
}

// USDC contract addresses (verified from WorldScan and docs.world.org)
export const USDC_ADDRESS: `0x${string}` = isTestnet
  ? '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88'
  : '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1';

// Contract addresses — set after deployment via env vars
export const GENIE_ROUTER_ADDRESS = (process.env.GENIE_ROUTER_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const PAY_HANDLER_ADDRESS = (process.env.PAY_HANDLER_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;
