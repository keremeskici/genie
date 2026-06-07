import { tool } from 'ai';
import { z } from 'zod';
import { writeMemory } from '../agent/memory';
import type { AgentMemory } from '../agent/memory-types';
import { DEFAULT_MEMORY } from '../agent/memory-types';
import { invalidateContextCache } from '../users';

const goalSchema = z.object({
  type: z.enum(['savings', 'budget', 'debt_payoff']),
  description: z.string(),
  targetAmount: z.number().optional(),
});

const inputSchema = z.object({
  financialProfile: z.object({
    monthlyIncome: z.number().optional(),
    spendingCategories: z.array(z.string()).optional(),
    riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  }).optional(),
  preferences: z.object({
    confirmationStyle: z.enum(['always', 'threshold', 'never']).optional(),
    reminderFrequency: z.enum(['daily', 'weekly', 'off']).optional(),
  }).optional(),
  addGoal: goalSchema.optional(),
  removeGoalId: z.string().optional(),
});

/**
 * Factory function — creates an update_memory tool bound to a specific userId and currentMemory.
 * Uses factory pattern because each request needs its own userId + memory snapshot.
 * The tool is only registered when userId is present (anonymous users cannot persist memory).
 */
export function createUpdateMemoryTool(userId: string, currentMemory: AgentMemory) {
  // Suppress unused import warning — DEFAULT_MEMORY used for type reference in parent
  void DEFAULT_MEMORY;

  return tool({
    description:
      "Update the user's persistent memory when they state a financial preference, set a goal, or change their profile. Only call this when the user explicitly shares preferences, goals, or profile information — not on every turn.",
    inputSchema,
    execute: async (input) => {
      const merged: AgentMemory = {
        financialProfile: {
          ...currentMemory.financialProfile,
          ...(input.financialProfile ?? {}),
        },
        preferences: {
          ...currentMemory.preferences,
          ...(input.preferences ?? {}),
        },
        activeGoals: [...currentMemory.activeGoals],
        updatedAt: new Date().toISOString(),
      };

      // Add new goal if provided
      if (input.addGoal) {
        merged.activeGoals.push({
          id: crypto.randomUUID(),
          ...input.addGoal,
          createdAt: new Date().toISOString(),
        });
      }

      // Remove goal if requested
      if (input.removeGoalId) {
        merged.activeGoals = merged.activeGoals.filter((g) => g.id !== input.removeGoalId);
      }

      const success = await writeMemory(userId, merged);

      if (success) {
        // Invalidate context cache so next session loads updated memory
        invalidateContextCache(userId);
        // Also update the currentMemory reference in-place for subsequent tool calls in this session
        Object.assign(currentMemory, merged);
      }

      return {
        success,
        message: success
          ? "Memory updated successfully. I'll remember this for future conversations."
          : "Memory update failed — I'll still remember this for the current session.",
        updatedFields: Object.keys(input).filter(
          (k) => input[k as keyof typeof input] !== undefined,
        ),
      };
    },
  });
}
