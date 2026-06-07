/**
 * Agent memory — persistent, cross-session user context.
 * Persisted as a JSONB column on the users row.
 * Pure types only — no DB import, so tests can use these without a DB.
 */
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
