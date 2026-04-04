import { Hono } from 'hono';
import { runAgent } from '../agent/index';

export const chatRoute = new Hono();

/**
 * POST /chat — streaming agent endpoint.
 *
 * Returns Server-Sent Events via toUIMessageStreamResponse() (not pipeDataStreamToResponse,
 * which is Node.js-only and crashes on Bun/Hono — Pitfall 3 from RESEARCH).
 */
chatRoute.post('/chat', async (c) => {
  try {
    const body = await c.req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { error: 'messages array is required and must not be empty' },
        400,
      );
    }

    console.log(`[route:chat] received ${messages.length} messages`);

    const result = await runAgent({ messages });

    // CRITICAL: Use toUIMessageStreamResponse() NOT pipeDataStreamToResponse()
    // pipeDataStreamToResponse is Node.js-specific and crashes on Bun/Hono (Pitfall 3)
    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error('[route:chat] error:', err);
    return c.json({ error: 'Internal server error', message: String(err) }, 500);
  }
});
