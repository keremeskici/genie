export const VALID_CATEGORIES = ['food', 'transport', 'entertainment', 'bills', 'transfers'] as const;
export type Category = typeof VALID_CATEGORIES[number];

/**
 * Standalone categorization function (D-07).
 * Infers transaction category from a description string via keyword matching.
 * Returns 'transfers' as default when no keywords match (D-04).
 * Decoupled from send_usdc — can be called by any transaction source.
 */
export function inferCategory(description: string | null | undefined): Category {
  if (!description) return 'transfers';
  const lower = description.toLowerCase();
  if (/food|dinner|lunch|breakfast|restaurant|cafe|coffee|grocery|eat|meal/.test(lower)) return 'food';
  if (/transport|taxi|uber|lyft|bus|train|metro|ride|gas|parking|fare/.test(lower)) return 'transport';
  if (/entertainment|movie|game|concert|ticket|fun|bar|drink|party|show/.test(lower)) return 'entertainment';
  if (/bill|rent|utility|electric|water|internet|phone|insurance|subscription/.test(lower)) return 'bills';
  return 'transfers';
}
