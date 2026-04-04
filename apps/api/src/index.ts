import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { chatRoute } from './routes/chat';

const app = new Hono();
app.use('*', cors());
app.use('*', logger());
app.get('/health', (c) => c.json({ status: 'ok', service: 'genie-api' }));
app.route('/', chatRoute);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Bun-native server export — Bun reads this automatically
export default {
  port,
  fetch: app.fetch,
};
export { app };

// Node.js fallback — used when running via tsx/node (dev without Bun)
// @ts-ignore — typeof Bun may not be recognized by TS
if (typeof Bun === 'undefined') {
  import('@hono/node-server').then(({ serve }) => {
    serve({ fetch: app.fetch, port });
    console.log(`[genie-api] listening on http://localhost:${port}`);
  });
}
