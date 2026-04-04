export interface AgentMemory {
  financialProfile: {
    monthlyIncome?: number;
    spendingCategories?: string[];
    riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  };
  preferences: {
    confirmationStyle?: 'always' | 'threshold' | 'never';
    reminderFrequency?: 'daily' | 'weekly' | 'off';
  };
  activeGoals: Array<{
    id: string;
    type: 'savings' | 'budget' | 'debt_payoff';
    description: string;
    targetAmount?: number;
    currentAmount?: number;
    createdAt: string;
  }>;
  updatedAt: string;
}

export const DEFAULT_MEMORY: AgentMemory = {
  financialProfile: {},
  preferences: {},
  activeGoals: [],
  updatedAt: new Date().toISOString(),
};

/** Encode a string key to Uint8Array for 0G KV operations */
export function encodeKvKey(key: string): Uint8Array {
  return Uint8Array.from(Buffer.from(key, 'utf-8'));
}

/** Encode AgentMemory to base64 string for KV write */
export function encodeKvValue(memory: AgentMemory): string {
  const json = JSON.stringify(memory);
  return Buffer.from(json, 'utf-8').toString('base64');
}

/** Decode base64 KV value back to AgentMemory. Returns null if empty or invalid. */
export function decodeKvValue(raw: string | null | undefined): AgentMemory | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64').toString('utf-8');
    return JSON.parse(json) as AgentMemory;
  } catch {
    return null;
  }
}
