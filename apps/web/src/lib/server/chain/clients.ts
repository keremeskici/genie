import { createPublicClient, createWalletClient, http } from 'viem';
import { worldchain, worldchainSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  WORLD_CHAIN_RPC_URL,
  WORLD_CHAIN_TESTNET,
  RELAYER_PRIVATE_KEY,
  GENIE_VAULT_ADDRESS,
  YIELD_VAULT_ADDRESS,
  USDC_ADDRESS_TESTNET,
  USDC_ADDRESS_MAINNET,
} from '../config/env';

export { GENIE_VAULT_ADDRESS, YIELD_VAULT_ADDRESS };

export const chain = WORLD_CHAIN_TESTNET ? worldchainSepolia : worldchain;

export const publicClient = createPublicClient({
  chain,
  transport: http(WORLD_CHAIN_RPC_URL),
});

// Lazy-init the agent (relayer) wallet client to avoid crashing when RELAYER_PRIVATE_KEY
// is not set (e.g. during build or read-only operations).
let _walletClient: ReturnType<typeof createWalletClient> | null = null;
let _agentAccount: ReturnType<typeof privateKeyToAccount> | null = null;

function getAgentAccountInstance() {
  if (!_agentAccount) {
    const key = RELAYER_PRIVATE_KEY;
    if (!key) throw new Error('RELAYER_PRIVATE_KEY (agent key) is required for vault operations');
    _agentAccount = privateKeyToAccount(key as `0x${string}`);
  }
  return _agentAccount;
}

export function getWalletClient() {
  if (!_walletClient) {
    _walletClient = createWalletClient({
      account: getAgentAccountInstance(),
      chain,
      transport: http(WORLD_CHAIN_RPC_URL),
    });
  }
  return _walletClient;
}

/** The agent (relayer) account that signs vault transactions on users' behalf. */
export function agentAccount() {
  return getAgentAccountInstance();
}

// USDC contract addresses (verified from WorldScan and docs.world.org)
export const USDC_ADDRESS: `0x${string}` = (
  WORLD_CHAIN_TESTNET ? USDC_ADDRESS_TESTNET : USDC_ADDRESS_MAINNET
) as `0x${string}`;
