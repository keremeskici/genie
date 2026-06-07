import type { ModelMessage } from 'ai';
import type { AgentMemory } from './memory-types';
import { SYSTEM_PROMPT } from '../prompts/system-prompt';

export interface UserContext {
  walletAddress: string;
  displayName: string;
  autoApproveUsd: number;
  memory?: AgentMemory;
  isVerified: boolean;
  isHumanBacked: boolean;
}

/**
 * Returns the system prompt (bundled as a TS string), replacing {{date}} with today's date.
 */
export function loadSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];
  return SYSTEM_PROMPT.replace('{{date}}', today);
}

/**
 * Assembles the three-layer context for the agent:
 * 1. system: system prompt string (passed in, already interpolated)
 * 2. messages:
 *    a. User context injection message (wallet address, display name, threshold)
 *    b. Assistant acknowledgement
 *    c. Conversation history (spread)
 *    d. Current user message
 */
export function assembleContext(
  systemPrompt: string,
  userContext: UserContext,
  history: ModelMessage[],
  userMessage: string,
): { system: string; messages: ModelMessage[] } {
  const memoryStr = userContext.memory
    ? `, goals=${userContext.memory.activeGoals.length}, profile=${JSON.stringify(userContext.memory.financialProfile)}`
    : '';
  const bypassStr = ', verificationBypass=true (temporary agent testing — gated actions available)';
  const verifiedStr = userContext.isVerified
    ? ', verified=true'
    : ', verified=false (temporary testing bypass active)';
  const humanBackedStr = `, humanBacked=${userContext.isHumanBacked}`;
  const contextInjection = `[User context: wallet=${userContext.walletAddress}, name=${userContext.displayName}, threshold=$${userContext.autoApproveUsd}${memoryStr}${verifiedStr}${humanBackedStr}${bypassStr}]`;

  return {
    system: systemPrompt,
    messages: [
      { role: 'user', content: contextInjection },
      { role: 'assistant', content: 'Understood. I have your account context.' },
      ...history,
      { role: 'user', content: userMessage },
    ],
  };
}
