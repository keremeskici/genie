import { KvClient, Indexer, Batcher } from '@0glabs/0g-ts-sdk';
import type { FixedPriceFlow } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';

const EVM_RPC = 'https://evmrpc-testnet.0g.ai';
const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai';

/**
 * Create a KvClient for reads. No wallet needed — reads are free.
 * Returns null if OG_KV_CLIENT_URL is not set (graceful degradation).
 */
export function createKvReader(): KvClient | null {
  const url = process.env.OG_KV_CLIENT_URL;
  if (!url) {
    console.warn('[kv] OG_KV_CLIENT_URL not set — KV reads disabled');
    return null;
  }
  return new KvClient(url);
}

/**
 * Create a Batcher for writes. Requires OG_PRIVATE_KEY with testnet gas.
 * Returns the batcher and stream ID needed for write operations.
 * Returns null if env vars are missing (graceful degradation).
 */
export async function createKvWriter(): Promise<{
  batcher: InstanceType<typeof Batcher>;
  streamId: string;
} | null> {
  const privateKey = process.env.OG_PRIVATE_KEY;
  const streamId = process.env.OG_KV_STREAM_ID;
  if (!privateKey || !streamId) {
    console.warn('[kv] OG_PRIVATE_KEY or OG_KV_STREAM_ID not set — KV writes disabled');
    return null;
  }

  const provider = new ethers.JsonRpcProvider(EVM_RPC);
  const signer = new ethers.Wallet(privateKey, provider);
  const indexer = new Indexer(INDEXER_RPC);

  const [nodes, nodesErr] = await indexer.selectNodes(1);
  if (nodesErr) {
    console.error('[kv] selectNodes failed:', nodesErr);
    return null;
  }

  // flowContract: pass undefined — SDK auto-discovers via indexer (see RESEARCH open question 2)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batcher = new Batcher(1, nodes, undefined as unknown as FixedPriceFlow, EVM_RPC);
  return { batcher, streamId };
}
