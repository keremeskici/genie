import { db, users, eq } from '@genie/db';
import type { AgentMemory } from './memory-types';

export type { AgentMemory } from './memory-types';
export { DEFAULT_MEMORY } from './memory-types';

/**
 * Read agent memory for a user from the Postgres JSONB column.
 * Returns null if the user has no stored memory. NEVER throws.
 */
export async function readMemory(userId: string): Promise<AgentMemory | null> {
  try {
    const [user] = await db
      .select({ memory: users.memory })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const memory = user?.memory as AgentMemory | null | undefined;
    if (!memory) return null;
    return memory;
  } catch (err) {
    console.error(`[memory] readMemory failed for user ${userId}:`, err);
    return null;
  }
}

/**
 * Write agent memory for a user to the Postgres JSONB column.
 * NEVER throws — memory write failure must not break the conversation.
 */
export async function writeMemory(userId: string, memory: AgentMemory): Promise<boolean> {
  try {
    await db.update(users).set({ memory }).where(eq(users.id, userId));
    console.log(`[memory] wrote memory for user ${userId}`);
    return true;
  } catch (err) {
    console.error(`[memory] writeMemory failed for user ${userId}:`, err);
    return false;
  }
}
