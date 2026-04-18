import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { chatRoute } from './routes/chat';
import { verifyRoute } from './routes/verify';
import { confirmRoute } from './routes/confirm';
import { usersRoute } from './routes/users';
import { balanceRoute } from './routes/balance';
import { sendRoute } from './routes/send';
import { transactionsRoute } from './routes/transactions';
import { versionRoute } from './routes/version';
import { PORT } from './config/env';

const app = new Hono();
app.use('*', cors());
app.use('*', logger());
app.get('/health', (c) => c.json({ status: 'ok', service: 'genie-api' }));
app.route('/api/chat', chatRoute);
app.route('/api/verify', verifyRoute);
app.route('/api/confirm', confirmRoute);
app.route('/api/users', usersRoute);
app.route('/api/balance', balanceRoute);
app.route('/api/send', sendRoute);
app.route('/api/transactions', transactionsRoute);
app.route('/api/version', versionRoute);

app.notFound((c) => {
  console.error(`[genie-api] 404 Not Found: ${c.req.method} ${c.req.url}`);
  return c.json({ error: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.url} not found` }, 404);
});

serve({ fetch: app.fetch, port: PORT });
console.log(`[genie-api] listening on http://localhost:${PORT}`);

export { app };
