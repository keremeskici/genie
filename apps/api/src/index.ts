import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { chatRoute } from './routes/chat';
import { verifyRoute } from './routes/verify';
import { confirmRoute } from './routes/confirm';

const app = new Hono();
app.use('*', cors());
app.use('*', logger());
app.get('/health', (c) => c.json({ status: 'ok', service: 'genie-api' }));
app.route('/api', chatRoute);
app.route('/api', verifyRoute);
app.route('/api', confirmRoute);

const port = parseInt(process.env.PORT ?? '3001', 10);

serve({ fetch: app.fetch, port });
console.log(`[genie-api] listening on http://localhost:${port}`);

export { app };
