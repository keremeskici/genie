import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock chain/clients before importing the route
vi.mock('../chain/clients', () => ({
  publicClient: { readContract: vi.fn() },
  GENIE_ROUTER_ADDRESS: '0xRouter0000000000000000000000000000000001' as `0x${string}`,
  USDC_ADDRESS: '0xUSDC' as `0x${string}`,
}));

// Import after mocks
const { balanceRoute } = await import('./balance');

const app = new Hono();
app.route('/balance', balanceRoute);

const VALID_WALLET = '0x1234567890123456789012345678901234567890';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /balance', () => {
  it('Test 1: returns 200 with balance and currency for valid wallet', async () => {
    const { publicClient } = await import('../chain/clients');
    vi.mocked(publicClient.readContract).mockResolvedValue(1500000n as never);

    const req = new Request(`http://localhost/balance?wallet=${VALID_WALLET}`);
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { balance: string; currency: string };
    expect(typeof json.balance).toBe('string');
    expect(json.currency).toBe('USDC');
    // 1500000 raw / 1e6 = 1.5 USDC
    expect(json.balance).toBe('1.5');
  });

  it('Test 2: returns 400 with INVALID_WALLET when wallet param is missing', async () => {
    const req = new Request('http://localhost/balance');
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('INVALID_WALLET');
  });

  it('Test 3: returns 400 with INVALID_WALLET when wallet param is not an address', async () => {
    const req = new Request('http://localhost/balance?wallet=notanaddress');
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('INVALID_WALLET');
  });

  it('Test 4: returns 500 with FETCH_FAILED when readContract throws', async () => {
    const { publicClient } = await import('../chain/clients');
    vi.mocked(publicClient.readContract).mockRejectedValue(new Error('RPC fail') as never);

    const req = new Request(`http://localhost/balance?wallet=${VALID_WALLET}`);
    const res = await app.fetch(req);
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('FETCH_FAILED');
  });

  it('Test 5: returns allowance for the Genie router', async () => {
    const { publicClient } = await import('../chain/clients');
    vi.mocked(publicClient.readContract).mockResolvedValue(100000000n as never);

    const req = new Request(`http://localhost/balance/allowance?wallet=${VALID_WALLET}`);
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as {
      allowance: string;
      currency: string;
      owner: string;
      spender: string;
      token: string;
    };
    expect(json.allowance).toBe('100');
    expect(json.currency).toBe('USDC');
    expect(json.owner).toBe(VALID_WALLET);
    expect(json.spender).toBe('0xRouter0000000000000000000000000000000001');
    expect(json.token).toBe('0xUSDC');
  });
});
