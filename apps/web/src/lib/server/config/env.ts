/**
 * Centralized environment configuration for the server (lib/server).
 * All process.env reads in lib/server/ should go through this module.
 * Group by concern; use requireEnv for must-have vars, optionalEnv for gracefully-degraded ones.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// --- OpenAI ---
export const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
export const OPENAI_MODEL = optionalEnv('OPENAI_MODEL') ?? 'gpt-4.1-mini';

// --- World ID ---
export const WORLD_APP_ID = requireEnv('WORLD_APP_ID');
export const WORLD_ACTION = requireEnv('WORLD_ACTION');
export const WORLD_VERIFY_API_URL =
  optionalEnv('WORLD_VERIFY_API_URL') ?? 'https://developer.world.org/api/v2/verify';
export const WORLD_USERNAME_API_URL =
  optionalEnv('WORLD_USERNAME_API_URL') ?? 'https://usernames.worldcoin.org/api/v1';

// --- World Chain ---
export const WORLD_CHAIN_RPC_URL = optionalEnv('WORLD_CHAIN_RPC_URL');
export const WORLD_CHAIN_TESTNET = process.env.WORLD_CHAIN_TESTNET === 'true';

// RELAYER_PRIVATE_KEY is the AGENT key — it moves user funds within on-chain spending caps.
export const RELAYER_PRIVATE_KEY = optionalEnv('RELAYER_PRIVATE_KEY');

// GenieVault — custodial, yield-bearing vault the agent acts on.
export const GENIE_VAULT_ADDRESS = (optionalEnv('GENIE_VAULT_ADDRESS') ?? ZERO_ADDRESS) as `0x${string}`;
// RE7 ERC-4626 yield vault that GenieVault routes idle balances into (for reference/admin).
export const YIELD_VAULT_ADDRESS = (optionalEnv('YIELD_VAULT_ADDRESS') ?? ZERO_ADDRESS) as `0x${string}`;

export const USDC_ADDRESS_TESTNET =
  optionalEnv('USDC_ADDRESS_TESTNET') ?? '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88';
export const USDC_ADDRESS_MAINNET =
  optionalEnv('USDC_ADDRESS_MAINNET') ?? '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1';

// --- Agent runtime ---
export const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS ?? '2048', 10);
export const WINDOW_LIMIT = parseInt(process.env.WINDOW_LIMIT ?? '40', 10);
export const ALLOW_UNVERIFIED_AGENT_ACTIONS =
  process.env.ALLOW_UNVERIFIED_AGENT_ACTIONS === 'true';
export const MOCK_CHAIN_TRANSFERS = process.env.MOCK_CHAIN_TRANSFERS === 'true';
