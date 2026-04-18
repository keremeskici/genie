import { Hono } from 'hono';

export const versionRoute = new Hono();

versionRoute.get('/', (c) => {
  return c.json({
    service: 'genie-api',
    status: 'ok',
    deployment: {
      provider: process.env.VERCEL === '1' ? 'vercel' : 'local',
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      url: process.env.VERCEL_URL
        ? process.env.VERCEL_URL.startsWith('http')
          ? process.env.VERCEL_URL
          : `https://${process.env.VERCEL_URL}`
        : null,
      region: process.env.VERCEL_REGION ?? null,
    },
    git: {
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
      shortSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
      author: process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN ?? null,
    },
  });
});
