import { Indexer, Batcher, getFlowContract } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';
import { OG_PRIVATE_KEY, OG_KV_STREAM_ID } from '../config/env';

// 0G Mainnet endpoints
const EVM_RPC = 'https://evmrpc.0g.ai';
const INDEXER_RPC = 'https://indexer-storage-turbo.0g.ai';

/** Shared indexer instance (stateless HTTP client, safe to reuse). */
let _indexer: InstanceType<typeof Indexer> | null = null;
function getIndexer(): InstanceType<typeof Indexer> {
  if (!_indexer) _indexer = new Indexer(INDEXER_RPC);
  return _indexer;
}

/**
 * Create a Batcher for writes. Requires OG_PRIVATE_KEY with mainnet A0GI for gas.
 * Auto-discovers the flow contract from storage nodes.
 * Returns null if env vars are missing (graceful degradation).
 */
export async function createKvWriter(): Promise<{
  batcher: InstanceType<typeof Batcher>;
  streamId: string;
} | null> {
  const privateKey = OG_PRIVATE_KEY;
  const streamId = OG_KV_STREAM_ID;
  if (!privateKey || !streamId) {
    console.warn('[kv] OG_PRIVATE_KEY or OG_KV_STREAM_ID not set — KV writes disabled');
    return null;
  }

  const provider = new ethers.JsonRpcProvider(EVM_RPC);
  const signer = new ethers.Wallet(privateKey, provider);
  const indexer = getIndexer();

  const [nodes, nodesErr] = await indexer.selectNodes(1);
  if (nodesErr || !nodes?.length) {
    console.error('[kv] selectNodes failed:', nodesErr);
    return null;
  }

  // Auto-discover flow contract address from a storage node
  const status = await nodes[0].getStatus();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flowContract = getFlowContract(status.networkIdentity.flowAddress, signer as any);

  const batcher = new Batcher(1, nodes, flowContract, EVM_RPC);
  return { batcher, streamId };
}

/**
 * Download raw data from 0G storage by root hash via the indexer.
 * Returns the file contents as a Buffer, or null on failure.
 */
export async function downloadFromStorage(rootHash: string): Promise<Buffer | null> {
  const indexer = getIndexer();
  const tmpPath = `/tmp/0g-kv-${rootHash.slice(0, 16)}.bin`;

  try {
    const fs = await import('fs');
    await indexer.download(rootHash, tmpPath, false);
    const data = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);
    return Buffer.from(data);
  } catch {
    return null;
  }
}
