import { tool } from 'ai';
import { z } from 'zod';
import { db, contacts, eq } from '@genie/db';
import { WORLD_USERNAME_API_URL } from '../config/env';

/**
 * Resolves a World username to a wallet address via the World Username API.
 * Returns null if not found or on any error.
 */
async function resolveWorldUsername(name: string): Promise<string | null> {
  try {
    const res = await fetch(`${WORLD_USERNAME_API_URL}/${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: string };
    return data.address ?? null;
  } catch {
    return null;
  }
}

/**
 * resolve_contact tool factory — resolves a human-friendly name/username/address
 * to a wallet address using three-path resolution (D-07 priority order):
 *   1. Raw 0x address — returned directly
 *   2. World username API lookup
 *   3. Contacts DB search (case-insensitive includes match for disambiguation)
 *
 * Returns disambiguation list when multiple contacts match (D-08).
 */
export function createResolveContactTool(userId: string) {
  return tool({
    description:
      'Resolve a recipient name, username, or address to a wallet address. Use before send_usdc.',
    inputSchema: z.object({
      recipient: z.string().describe('Name, World username, or 0x wallet address'),
    }),
    execute: async ({ recipient }) => {
      // Path 1: Raw wallet address (D-07 priority 1)
      if (recipient.startsWith('0x') && recipient.length === 42) {
        return { resolved: true, address: recipient, source: 'direct' };
      }

      // Path 2: World username lookup (D-07 priority 2)
      const worldAddress = await resolveWorldUsername(recipient);
      if (worldAddress) {
        return {
          resolved: true,
          address: worldAddress,
          source: 'world_username',
          username: recipient,
        };
      }

      // Path 3: Contact name search (D-07 priority 3)
      // Fetch all contacts for this user and filter in JS (acceptable for hackathon scope)
      const allContacts = await db.select().from(contacts).where(eq(contacts.ownerUserId, userId));

      // Use case-insensitive includes match — covers both exact and partial
      // This ensures "Alice" matches both "Alice" and "Alice Smith" (D-08 disambiguation)
      const matches = allContacts.filter((r) =>
        r.displayName.toLowerCase().includes(recipient.toLowerCase()),
      );

      if (matches.length === 1) {
        return {
          resolved: true,
          address: matches[0].walletAddress,
          source: 'contact',
          name: matches[0].displayName,
        };
      }

      if (matches.length > 1) {
        // D-08: Multiple matches — list for disambiguation
        return {
          resolved: false,
          reason: 'multiple_matches',
          matches: matches.map((m) => ({
            name: m.displayName,
            addressSnippet: `${m.walletAddress.slice(0, 6)}...${m.walletAddress.slice(-4)}`,
            fullAddress: m.walletAddress,
          })),
        };
      }

      return {
        resolved: false,
        reason: 'not_found',
        message: `Could not resolve "${recipient}" to a wallet address.`,
      };
    },
  });
}
