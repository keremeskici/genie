import type { ModelMessage } from 'ai';

/**
 * Returns true if a message should never be dropped from the sliding window.
 * Sticky messages:
 * - tool results (balances, transaction confirmations)
 * - user confirmations ("yes, send" / "no, cancel")
 * - system messages
 */
export function isSticky(msg: ModelMessage): boolean {
  if (msg.role === 'tool') return true;
  if (msg.role === 'system') return true;
  if (msg.role === 'user' && typeof msg.content === 'string') {
    const lower = msg.content.toLowerCase();
    if (lower.includes('yes, send') || lower.includes('no, cancel')) return true;
  }
  return false;
}

/**
 * Enforces a sliding window on conversation history.
 * When messages exceed the limit, drops the oldest non-sticky messages first.
 * Sticky messages are never dropped regardless of limit.
 *
 * @param messages - Full message array to trim
 * @param limit - Maximum number of messages to keep (default: 40)
 * @returns Trimmed message array
 */
export function applyWindow(messages: ModelMessage[], limit: number = 40): ModelMessage[] {
  if (messages.length <= limit) return messages;

  const excess = messages.length - limit;

  // Collect indices of non-sticky messages (oldest first = lowest indices)
  const nonStickyIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (!isSticky(messages[i])) {
      nonStickyIndices.push(i);
    }
  }

  // Drop the first `excess` non-sticky messages (oldest)
  const toDrop = new Set(nonStickyIndices.slice(0, excess));

  return messages.filter((_, i) => !toDrop.has(i));
}
