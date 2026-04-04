import { readFileSync } from 'fs';
import { join } from 'path';
import type { CoreMessage } from 'ai';
import type { AgentMemory } from '../kv/types';

export interface UserContext {
  walletAddress: string;
  displayName: string;
  autoApproveUsd: number;
  memory?: AgentMemory;
}

/**
 * Loads the system prompt from prompts/system.md, replacing {{date}} with today's date.
 */
export function loadSystemPrompt(): string {
  const templatePath = join(import.meta.dirname ?? __dirname, '..', 'prompts', 'system.md');
  const template = readFileSync(templatePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  return template.replace('{{date}}', today);
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
  history: CoreMessage[],
  userMessage: string,
): { system: string; messages: CoreMessage[] } {
  const memoryStr = userContext.memory
    ? `, goals=${userContext.memory.activeGoals.length}, profile=${JSON.stringify(userContext.memory.financialProfile)}`
    : '';
  const contextInjection = `[User context: wallet=${userContext.walletAddress}, name=${userContext.displayName}, threshold=$${userContext.autoApproveUsd}${memoryStr}]`;

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
