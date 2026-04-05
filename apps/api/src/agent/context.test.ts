import { describe, it, expect } from 'vitest';
import { assembleContext } from './context';
import type { UserContext } from './context';
import type { ModelMessage } from 'ai';
import { DEFAULT_MEMORY } from '../kv/types';
import type { AgentMemory } from '../kv/types';

const mockUserContext: UserContext = {
  walletAddress: '0xABC',
  displayName: 'Alice',
  autoApproveUsd: 25,
  isVerified: false,
  isHumanBacked: false,
};

const mockSystemPrompt = 'You are Genie. Current date: 2026-04-04';

const mockHistory: ModelMessage[] = [
  { role: 'user', content: 'What is my balance?' },
  { role: 'assistant', content: 'Your balance is 100 USDC.' },
];

describe('assembleContext', () => {
  it('returns system string equal to the passed systemPrompt', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, [], 'hello');
    expect(result.system).toBe(mockSystemPrompt);
  });

  it('messages start with user context injection, then assistant ack, then current user message (empty history)', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, [], 'What can you do?');
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[2].role).toBe('user');
    expect(result.messages[2].content).toBe('What can you do?');
  });

  it('user context injection contains wallet address and display name', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, [], 'hello');
    const contextMsg = result.messages[0];
    expect(contextMsg.content).toContain('0xABC');
    expect(contextMsg.content).toContain('Alice');
    expect(contextMsg.content).toContain('25');
  });

  it('messages with history: context injection + ack + history + current message', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, mockHistory, 'Next question');
    // context injection (1) + assistant ack (1) + history (2) + current (1) = 5
    expect(result.messages).toHaveLength(5);
    expect(result.messages[0].role).toBe('user'); // context injection
    expect(result.messages[1].role).toBe('assistant'); // ack
    expect(result.messages[2].content).toBe('What is my balance?'); // history[0]
    expect(result.messages[3].content).toBe('Your balance is 100 USDC.'); // history[1]
    expect(result.messages[4].content).toBe('Next question'); // current
  });
});

describe('assembleContext — without memory (backwards compatibility)', () => {
  it('does NOT include goals= or profile= when no memory field', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, [], 'hello');
    const injection = result.messages[0].content as string;
    expect(injection).not.toContain('goals=');
    expect(injection).not.toContain('profile=');
  });
});

describe('assembleContext — with memory (2 active goals)', () => {
  const memoryWith2Goals: AgentMemory = {
    ...DEFAULT_MEMORY,
    activeGoals: [
      {
        id: 'goal-1',
        type: 'savings',
        description: 'Emergency fund',
        targetAmount: 5000,
        currentAmount: 1000,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'goal-2',
        type: 'budget',
        description: 'Monthly budget',
        createdAt: '2026-01-02T00:00:00Z',
      },
    ],
  };

  it('includes goals=2 in contextInjection', () => {
    const ctx: UserContext = { ...mockUserContext, memory: memoryWith2Goals };
    const result = assembleContext(mockSystemPrompt, ctx, [], 'hello');
    const injection = result.messages[0].content as string;
    expect(injection).toContain('goals=2');
  });
});

describe('assembleContext — with memory (riskTolerance moderate)', () => {
  const memoryWithProfile: AgentMemory = {
    ...DEFAULT_MEMORY,
    financialProfile: {
      riskTolerance: 'moderate',
      monthlyIncome: 5000,
    },
  };

  it('includes profile= and contains moderate in contextInjection', () => {
    const ctx: UserContext = { ...mockUserContext, memory: memoryWithProfile };
    const result = assembleContext(mockSystemPrompt, ctx, [], 'hello');
    const injection = result.messages[0].content as string;
    expect(injection).toContain('profile=');
    expect(injection).toContain('moderate');
  });
});

describe('assembleContext — with DEFAULT_MEMORY (empty memory)', () => {
  it('includes goals=0 and profile={} in contextInjection', () => {
    const ctx: UserContext = { ...mockUserContext, memory: DEFAULT_MEMORY };
    const result = assembleContext(mockSystemPrompt, ctx, [], 'hello');
    const injection = result.messages[0].content as string;
    expect(injection).toContain('goals=0');
    expect(injection).toContain('profile={}');
  });
});

describe('assembleContext — no verification in context injection', () => {
  it('does not include verified= or humanBacked= in context injection', () => {
    const result = assembleContext(mockSystemPrompt, mockUserContext, [], 'hello');
    const injection = result.messages[0].content as string;
    expect(injection).not.toContain('verified=');
    expect(injection).not.toContain('humanBacked=');
  });
});
