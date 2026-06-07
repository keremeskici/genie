import { tool } from 'ai';
import { z } from 'zod';
import { db, contacts } from '@genie/db';

/**
 * add_contact tool factory — saves a new contact with a display name and wallet address
 * for the current user.
 *
 * No verification gate (adding contacts is not a gated financial action).
 */
export function createAddContactTool(userId: string) {
  return tool({
    description: 'Save a new contact with a display name and wallet address for the current user.',
    inputSchema: z.object({
      name: z.string().describe('Display name for the contact'),
      walletAddress: z.string().describe('0x wallet address of the contact'),
    }),
    execute: async ({ name, walletAddress }) => {
      // Validate wallet address format
      if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        return { success: false, error: 'Invalid wallet address format' };
      }

      try {
        const result = await db
          .insert(contacts)
          .values({ ownerUserId: userId, displayName: name, walletAddress })
          .returning();

        return {
          success: true,
          contact: {
            name: result[0].displayName,
            walletAddress: result[0].walletAddress,
          },
        };
      } catch {
        return { success: false, error: 'Failed to save contact' };
      }
    },
  });
}
