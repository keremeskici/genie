import { describe, it, expect, vi } from 'vitest';

// Mock viem and chain clients before importing
vi.mock('../chain/clients', () => ({
  publicClient: {
    readContract: vi.fn().mockResolvedValue(BigInt('100000000')), // 100 USDC in 6 decimals
  },
  USDC_ADDRESS: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1',
}));

import { createGetBalanceTool } from './get-balance';
import type { UserContext } from '../agent/context';

const mockUserContext: UserContext = {
  walletAddress: '0x1234567890123456789012345678901234567890',
  displayName: 'Test User',
  autoApproveUsd: 25,
  isVerified: true,
  isHumanBacked: true,
};

describe('createGetBalanceTool', () => {
  it('creates a tool with USDC description', () => {
    const tool = createGetBalanceTool(mockUserContext);
    expect(tool.description).toContain('USDC');
  });

  it('has inputSchema and execute function', () => {
    const tool = createGetBalanceTool(mockUserContext);
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('execute() returns balance from chain', async () => {
    const tool = createGetBalanceTool(mockUserContext);
    const result = await tool.execute!({}, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      balance: '100',
      currency: 'USDC',
      chain: 'World Chain',
    });
  });
});
