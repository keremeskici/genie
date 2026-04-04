import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ModelMessage } from 'ai';

// Mock all dependencies before imports
vi.mock('ai', () => ({
  streamText: vi.fn(),
  stepCountIs: vi.fn((n: number) => ({ type: 'step-count', count: n })),
}));

vi.mock('./classifier', () => ({
  classifyIntent: vi.fn(),
  selectModel: vi.fn(),
}));

vi.mock('./context', () => ({
  loadSystemPrompt: vi.fn(() => 'mock system prompt'),
  assembleContext: vi.fn(),
}));

vi.mock('./window', () => ({
  applyWindow: vi.fn(),
}));

vi.mock('../tools/get-balance', () => ({
  createGetBalanceTool: vi.fn(() => ({ description: 'mock get_balance tool' })),
}));

vi.mock('../tools/resolve-contact', () => ({
  createResolveContactTool: vi.fn(() => ({ description: 'mock resolve_contact tool' })),
}));

vi.mock('../tools/send-usdc', () => ({
  createSendUsdcTool: vi.fn(() => ({ description: 'mock send_usdc tool' })),
}));

vi.mock('../tools/update-memory', () => ({
  createUpdateMemoryTool: vi.fn(() => ({ description: 'mock update_memory tool' })),
}));

vi.mock('../tools/create-debt', () => ({
  createCreateDebtTool: vi.fn(() => ({ description: 'mock create_debt tool' })),
}));

vi.mock('../tools/list-debts', () => ({
  createListDebtsTool: vi.fn(() => ({ description: 'mock list_debts tool' })),
}));

vi.mock('../tools/get-spending', () => ({
  createGetSpendingTool: vi.fn(() => ({ description: 'mock get_spending tool' })),
}));

vi.mock('../tools/add-contact', () => ({
  createAddContactTool: vi.fn(() => ({ description: 'mock add_contact tool' })),
}));

vi.mock('../tools/list-contacts', () => ({
  createListContactsTool: vi.fn(() => ({ description: 'mock list_contacts tool' })),
}));

import { runAgent } from './index';
import { streamText, stepCountIs } from 'ai';
import { classifyIntent, selectModel } from './classifier';
import { assembleContext, loadSystemPrompt } from './context';
import { applyWindow } from './window';

describe('runAgent', () => {
  const mockModel = { type: 'language-model', modelId: 'mock-model' } as any;
  const mockMessages: ModelMessage[] = [{ role: 'user', content: 'what is my balance?' }];
  const mockAssembledCtx = {
    system: 'mock system prompt',
    messages: [
      { role: 'user', content: '[User context: wallet=0x0, name=User, threshold=$25]' },
      { role: 'assistant', content: 'Understood.' },
      { role: 'user', content: 'what is my balance?' },
    ] as ModelMessage[],
  };
  const mockWindowedMessages = mockAssembledCtx.messages;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classifyIntent).mockResolvedValue('planning');
    vi.mocked(selectModel).mockReturnValue(mockModel);
    vi.mocked(assembleContext).mockReturnValue(mockAssembledCtx);
    vi.mocked(applyWindow).mockReturnValue(mockWindowedMessages);
    vi.mocked(streamText).mockReturnValue({ toUIMessageStreamResponse: vi.fn() } as any);
  });

  it('calls classifyIntent with the last user message text', async () => {
    await runAgent({ messages: mockMessages });
    expect(classifyIntent).toHaveBeenCalledWith('what is my balance?');
  });

  it('calls selectModel with the classified intent', async () => {
    await runAgent({ messages: mockMessages });
    expect(selectModel).toHaveBeenCalledWith('planning');
  });

  it('calls assembleContext with system prompt, stub user context, history (all messages except last), and user message', async () => {
    const multiMessages: ModelMessage[] = [
      { role: 'user', content: 'previous message' },
      { role: 'assistant', content: 'previous response' },
      { role: 'user', content: 'what is my balance?' },
    ];
    await runAgent({ messages: multiMessages });

    expect(assembleContext).toHaveBeenCalledWith(
      expect.any(String), // system prompt (loaded at module init or fallback)
      expect.objectContaining({
        walletAddress: expect.any(String),
        displayName: expect.any(String),
        autoApproveUsd: expect.any(Number),
      }),
      [
        { role: 'user', content: 'previous message' },
        { role: 'assistant', content: 'previous response' },
      ],
      'what is my balance?',
    );
  });

  it('calls applyWindow with assembled messages and limit 40', async () => {
    await runAgent({ messages: mockMessages });
    expect(applyWindow).toHaveBeenCalledWith(mockAssembledCtx.messages, 40);
  });

  it('calls streamText with the selected model, system, windowed messages, tools, and stopWhen', async () => {
    await runAgent({ messages: mockMessages });

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: mockModel,
        system: mockAssembledCtx.system,
        messages: mockWindowedMessages,
        tools: expect.objectContaining({ get_balance: expect.anything() }),
        stopWhen: expect.objectContaining({ type: 'step-count', count: 5 }),
      }),
    );
  });
});

describe('runAgent — update_memory tool registration', () => {
  const mockModel = { type: 'language-model', modelId: 'mock-model' } as any;
  const mockMessages: ModelMessage[] = [{ role: 'user', content: 'I earn 5000 a month' }];
  const mockAssembledCtx = {
    system: 'mock system prompt',
    messages: [
      { role: 'user', content: '[User context]' },
      { role: 'assistant', content: 'Understood.' },
      { role: 'user', content: 'I earn 5000 a month' },
    ] as ModelMessage[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classifyIntent).mockResolvedValue('action');
    vi.mocked(selectModel).mockReturnValue(mockModel);
    vi.mocked(assembleContext).mockReturnValue(mockAssembledCtx);
    vi.mocked(applyWindow).mockReturnValue(mockAssembledCtx.messages);
    vi.mocked(streamText).mockReturnValue({ toUIMessageStreamResponse: vi.fn() } as any);
  });

  it('includes update_memory tool when userId is provided', async () => {
    await runAgent({ messages: mockMessages, userId: 'user-123' });

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({ update_memory: expect.anything() }),
      }),
    );
  });

  it('does NOT include update_memory tool when userId is absent', async () => {
    await runAgent({ messages: mockMessages });

    const streamTextCall = vi.mocked(streamText).mock.calls[0][0];
    expect(streamTextCall.tools).not.toHaveProperty('update_memory');
  });
});
