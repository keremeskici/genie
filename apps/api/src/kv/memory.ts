import { createKvWriter, downloadFromStorage } from './client';
import { type AgentMemory, encodeKvKey } from './types';
import { db, users, eq } from '@genie/db';

/**
 * Read agent memory from 0G mainnet storage.
 * Looks up the root hash from Supabase, downloads the blob from 0G, parses the JSON.
 * Returns null if unavailable. NEVER throws.
 */
export async function readMemory(userId: string): Promise<AgentMemory | null> {
  try {
    const [user] = await db
      .select({ memoryRootHash: users.memoryRootHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.memoryRootHash) {
      console.log(`[kv] no memory root hash for user ${userId}`);
      return null;
    }

    const blob = await downloadFromStorage(user.memoryRootHash);
    if (!blob) {
      console.log(`[kv] download failed for root ${user.memoryRootHash}`);
      return null;
    }

    // Blob is KV stream-encoded binary: headers + streamId + key + value.
    // Extract our JSON value by finding the AgentMemory object.
    const text = blob.toString('utf-8');
    const jsonStart = text.indexOf('{"financialProfile"');
    if (jsonStart < 0) {
      console.log(`[kv] could not find memory JSON in blob for user ${userId}`);
      return null;
    }

    let depth = 0;
    let jsonEnd = jsonStart;
    for (let i = jsonStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      if (depth === 0) { jsonEnd = i + 1; break; }
    }

    const memory = JSON.parse(text.substring(jsonStart, jsonEnd)) as AgentMemory;
    console.log(`[kv] loaded memory for user ${userId} from 0G mainnet`);
    return memory;
  } catch (err) {
    console.error(`[kv] readMemory failed for user ${userId}:`, err);
    return null;
  }
}

/**
 * Write agent memory to 0G mainnet KV storage.
 * Stores the root hash in Supabase for later read-back.
 * NEVER throws — memory write failure must not break the conversation.
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

    // Persist root hash so readMemory can download it later
    await db
      .update(users)
      .set({ memoryRootHash: tx.rootHash })
      .where(eq(users.id, userId));

    console.log(`[kv] wrote memory for user ${userId}, root: ${tx.rootHash}`);
    return true;
  } catch (err) {
    console.error(`[kv] writeMemory failed for user ${userId}:`, err);
    return false;
  }
}
