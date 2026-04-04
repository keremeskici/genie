import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import { glm5, deepseekV3 } from './providers';

export type Intent = 'planning' | 'action';

/**
 * Classifies a user message as either 'planning' or 'action'.
 * - 'planning': financial advice, summaries, goals, questions, greetings, general chat
 * - 'action': send money, check balance, resolve contacts, execute transfers, create debts
 *
 * Uses DeepSeek V3 via 0G Compute for the classification call (D-01).
 * Defaults to 'planning' on failure or ambiguous response (D-02).
 */
export async function classifyIntent(userMessage: string): Promise<Intent> {
  try {
    const { text } = await generateText({
      model: deepseekV3,
      system: `You are a router. Classify the user's message as either "planning" (financial advice, summaries, goals, questions, greetings, general chat) or "action" (send money, check balance, resolve contacts, execute transfers, create debts). Respond with exactly one word: planning or action.`,
      prompt: userMessage,
      maxOutputTokens: 5,
    });
    const label = text.trim().toLowerCase();
    return label === 'action' ? 'action' : 'planning'; // Default to planning per D-02
  } catch (err) {
    console.error('[classifier] error, defaulting to planning:', err);
    return 'planning'; // Default on failure per D-02
  }
}

/**
 * Selects the appropriate model based on the classified intent.
 * - 'action' → DeepSeek V3 (fast tool execution)
 * - 'planning' → GLM-5 (quality reasoning)
 */
export function selectModel(intent: Intent): LanguageModel {
  return intent === 'action' ? deepseekV3 : glm5;
}
