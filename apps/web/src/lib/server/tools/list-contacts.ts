import { tool } from 'ai';
import { z } from 'zod';
import { db, contacts, eq } from '@genie/db';

/**
 * list_contacts tool factory — returns all saved contacts for the current user.
 */
export function createListContactsTool(userId: string) {
  return tool({
    description: 'List all saved contacts for the current user.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const rows = await db
          .select()
          .from(contacts)
          .where(eq(contacts.ownerUserId, userId));

        return {
          contacts: rows.map((r) => ({
            name: r.displayName,
            walletAddress: r.walletAddress,
          })),
          count: rows.length,
        };
      } catch {
        return { contacts: [], count: 0, error: 'Failed to load contacts' };
      }
    },
  });
}
