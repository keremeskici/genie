import { describe, it, expect } from 'vitest';
import { applyWindow, isSticky } from './window';
import type { ModelMessage } from 'ai';

function makeMsg(role: ModelMessage['role'], content: string): ModelMessage {
  return { role, content } as ModelMessage;
}

function makeMessages(count: number, role: ModelMessage['role'] = 'user'): ModelMessage[] {
  return Array.from({ length: count }, (_, i) => makeMsg(role, `message ${i}`));
}

describe('applyWindow', () => {
  it('returns messages unchanged when under the 40-message limit', () => {
    const msgs = makeMessages(30);
    const result = applyWindow(msgs);
    expect(result).toHaveLength(30);
    expect(result).toEqual(msgs);
  });

  it('returns messages unchanged when exactly at the 40-message limit', () => {
    const msgs = makeMessages(40);
    const result = applyWindow(msgs);
    expect(result).toHaveLength(40);
  });

  it('drops oldest non-sticky messages when over the limit', () => {
    const msgs = makeMessages(41);
    const result = applyWindow(msgs);
    expect(result).toHaveLength(40);
    // oldest (index 0) should be dropped
    expect(result[0].content).toBe('message 1');
  });

  it('drops multiple oldest non-sticky messages when significantly over limit', () => {
    const msgs = makeMessages(50);
    const result = applyWindow(msgs);
    expect(result).toHaveLength(40);
    // oldest 10 dropped, so first remaining is index 10
    expect(result[0].content).toBe('message 10');
  });

  it('preserves sticky tool-role messages — never drops them', () => {
    // 38 regular user messages + 2 tool messages = 40 (at limit, no drop needed)
    // Add 1 more to go over
    const msgs: ModelMessage[] = [
      ...makeMessages(38),
      makeMsg('tool', 'balance: 100 USDC'),
      makeMsg('tool', 'tx confirmed'),
      makeMsg('user', 'extra message'), // this makes it 41
    ];
    const result = applyWindow(msgs);
    expect(result).toHaveLength(40);
    // Tool messages must still be present
    const toolMsgs = result.filter((m) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(2);
  });

  it('preserves sticky "yes, send" confirmation messages — never drops them', () => {
    const msgs: ModelMessage[] = [
      ...makeMessages(38),
      makeMsg('user', 'yes, send it'),
      makeMsg('user', 'extra 1'),
      makeMsg('user', 'extra 2'), // 41 messages total
    ];
    const result = applyWindow(msgs);
    expect(result).toHaveLength(40);
    // "yes, send" message must be preserved
    const confirmMsg = result.find((m) => typeof m.content === 'string' && m.content.includes('yes, send'));
    expect(confirmMsg).toBeTruthy();
  });

  it('preserves sticky "no, cancel" messages — never drops them', () => {
    const msgs: ModelMessage[] = [
      ...makeMessages(38),
      makeMsg('user', 'no, cancel'),
      makeMsg('user', 'extra 1'),
      makeMsg('user', 'extra 2'), // 41 messages total
    ];
    const result = applyWindow(msgs);
    expect(result).toHaveLength(40);
    const cancelMsg = result.find((m) => typeof m.content === 'string' && m.content.includes('no, cancel'));
    expect(cancelMsg).toBeTruthy();
  });

  it('returns all messages when all are sticky and over limit (cannot drop sticky)', () => {
    // All tool messages — none can be dropped
    const msgs = Array.from({ length: 45 }, (_, i) => makeMsg('tool', `tool result ${i}`));
    const result = applyWindow(msgs);
    expect(result).toHaveLength(45);
  });
});

describe('isSticky', () => {
  it('returns true for tool-role messages', () => {
    expect(isSticky(makeMsg('tool', 'any content'))).toBe(true);
  });

  it('returns true for system-role messages', () => {
    expect(isSticky(makeMsg('system', 'system context'))).toBe(true);
  });

  it('returns true for "yes, send" user messages (case-insensitive)', () => {
    expect(isSticky(makeMsg('user', 'yes, send it'))).toBe(true);
    expect(isSticky(makeMsg('user', 'YES, SEND IT'))).toBe(true);
  });

  it('returns true for "no, cancel" user messages (case-insensitive)', () => {
    expect(isSticky(makeMsg('user', 'no, cancel'))).toBe(true);
    expect(isSticky(makeMsg('user', 'NO, CANCEL'))).toBe(true);
  });

  it('returns false for regular user messages', () => {
    expect(isSticky(makeMsg('user', 'What is my balance?'))).toBe(false);
  });

  it('returns false for regular assistant messages', () => {
    expect(isSticky(makeMsg('assistant', 'Your balance is 100 USDC.'))).toBe(false);
  });
});
