import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CoreMessage } from 'ai';

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

import { runAgent } from './index';
import { streamText, stepCountIs } from 'ai';
import { classifyIntent, selectModel } from './classifier';
import { assembleContext, loadSystemPrompt } from './context';
import { applyWindow } from './window';

describe('runAgent', () => {
  const mockModel = { type: 'language-model', modelId: 'mock-model' } as any;
  const mockMessages: CoreMessage[] = [{ role: 'user', content: 'what is my balance?' }];
  const mockAssembledCtx = {
    system: 'mock system prompt',
    messages: [
      { role: 'user', content: '[User context: wallet=0x0, name=User, threshold=$25]' },
      { role: 'assistant', content: 'Understood.' },
      { role: 'user', content: 'what is my balance?' },
    ] as CoreMessage[],
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
    const multiMessages: CoreMessage[] = [
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
