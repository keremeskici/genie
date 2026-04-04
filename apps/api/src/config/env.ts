/**
 * Centralized environment configuration for the API server.
 * All process.env reads in apps/api/src/ must go through this module.
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

// --- 0G Compute ---
export const OG_COMPUTE_URL = requireEnv('OG_COMPUTE_URL');
export const OG_API_KEY = requireEnv('OG_API_KEY');
export const OG_PLANNING_MODEL = requireEnv('OG_PLANNING_MODEL');
export const OG_ACTION_MODEL = requireEnv('OG_ACTION_MODEL');

// --- 0G KV Storage (mainnet) ---
export const OG_PRIVATE_KEY = optionalEnv('OG_PRIVATE_KEY');
export const OG_KV_STREAM_ID = optionalEnv('OG_KV_STREAM_ID');

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
export const RELAYER_PRIVATE_KEY = optionalEnv('RELAYER_PRIVATE_KEY');
export const GENIE_ROUTER_ADDRESS = (optionalEnv('GENIE_ROUTER_ADDRESS') ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const PAY_HANDLER_ADDRESS = (optionalEnv('PAY_HANDLER_ADDRESS') ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const USDC_ADDRESS_TESTNET =
  optionalEnv('USDC_ADDRESS_TESTNET') ?? '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88';
export const USDC_ADDRESS_MAINNET =
  optionalEnv('USDC_ADDRESS_MAINNET') ?? '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1';

// --- API Server ---
export const PORT = parseInt(process.env.PORT ?? '3001', 10);
export const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS ?? '2048', 10);
export const WINDOW_LIMIT = parseInt(process.env.WINDOW_LIMIT ?? '40', 10);
