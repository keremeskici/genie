import { Hono } from 'hono';
import {
  NODE_ENV,
  VERCEL,
  VERCEL_ENV,
  VERCEL_GIT_COMMIT_AUTHOR_LOGIN,
  VERCEL_GIT_COMMIT_MESSAGE,
  VERCEL_GIT_COMMIT_REF,
  VERCEL_GIT_COMMIT_SHA,
  VERCEL_REGION,
  VERCEL_URL,
} from '../config/env';

export const versionRoute = new Hono();

function deploymentUrl(): string | null {
  if (!VERCEL_URL) return null;
  return VERCEL_URL.startsWith('http') ? VERCEL_URL : `https://${VERCEL_URL}`;
}

versionRoute.get('/', (c) => {
  return c.json({
    service: 'genie-api',
    status: 'ok',
    deployment: {
      provider: VERCEL === '1' ? 'vercel' : 'local',
      environment: VERCEL_ENV ?? NODE_ENV ?? 'unknown',
      url: deploymentUrl(),
      region: VERCEL_REGION ?? null,
    },
    git: {
      sha: VERCEL_GIT_COMMIT_SHA ?? 'unknown',
      shortSha: VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
      branch: VERCEL_GIT_COMMIT_REF ?? 'unknown',
      message: VERCEL_GIT_COMMIT_MESSAGE ?? null,
      author: VERCEL_GIT_COMMIT_AUTHOR_LOGIN ?? null,
    },
  });
});
