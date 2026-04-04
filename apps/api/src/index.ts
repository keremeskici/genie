import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { chatRoute } from './routes/chat';
import { verifyRoute } from './routes/verify';
import { confirmRoute } from './routes/confirm';
import { usersRoute } from './routes/users';
import { PORT } from './config/env';

const app = new Hono();
app.use('*', cors());
app.use('*', logger());
app.get('/health', (c) => c.json({ status: 'ok', service: 'genie-api' }));
app.route('/api', chatRoute);
app.route('/api', verifyRoute);
app.route('/api', confirmRoute);
app.route('/api', usersRoute);

serve({ fetch: app.fetch, port: PORT });
console.log(`[genie-api] listening on http://localhost:${PORT}`);

export { app };
