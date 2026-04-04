import { createKvReader, createKvWriter } from './client';
import { type AgentMemory, encodeKvKey, decodeKvValue } from './types';

/**
 * Read agent memory from 0G KV. Returns null if KV is unavailable or key not found.
 * NEVER throws — chat must work without KV (per anti-pattern rules in RESEARCH).
 */
export async function readMemory(userId: string): Promise<AgentMemory | null> {
  try {
    const kvClient = createKvReader();
    if (!kvClient) return null;

    const streamId = process.env.OG_KV_STREAM_ID;
    if (!streamId) return null;

    const key = `user:${userId}:memory`;
    // encodeKvKey returns Uint8Array — KvClient.getValue accepts Bytes (Uint8Array is Bytes-compatible)
    const encodedKey = encodeKvKey(key);
    const result = await kvClient.getValue(
      streamId,
      encodedKey as unknown as Parameters<typeof kvClient.getValue>[1],
    );

    if (!result) {
      console.log(`[kv] no memory found for user ${userId}`);
      return null;
    }

    // result.data is a Base64 string — pass to decodeKvValue which decodes base64 -> AgentMemory
    const memory = decodeKvValue(result.data);
    console.log(`[kv] loaded memory for user ${userId}`);
    return memory;
  } catch (err) {
    console.error(`[kv] readMemory failed for user ${userId}:`, err);
    return null;
  }
}

/**
 * Write agent memory to 0G KV. Silently fails if KV is unavailable.
 * NEVER throws — memory write failure must not break the conversation.
 * Called after key moments: new goal, preference stated, profile change (D-07).
 */
export async function writeMemory(userId: string, memory: AgentMemory): Promise<boolean> {
  try {
    const writer = await createKvWriter();
    if (!writer) return false;

    const key = encodeKvKey(`user:${userId}:memory`);
    const value = Uint8Array.from(Buffer.from(JSON.stringify(memory), 'utf-8'));

    writer.batcher.streamDataBuilder.set(writer.streamId, key, value);
    const [tx, err] = await writer.batcher.exec();

    if (err) {
      console.error(`[kv] writeMemory exec failed for user ${userId}:`, err);
      return false;
    }

    console.log(`[kv] wrote memory for user ${userId}, tx:`, tx);
    return true;
  } catch (err) {
    console.error(`[kv] writeMemory failed for user ${userId}:`, err);
    return false;
  }
}
