import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';

const REQUIRED_ENV = {
  OG_COMPUTE_URL: 'http://localhost:3000',
  OG_API_KEY: 'test-key',
  OG_PLANNING_MODEL: 'planning-model',
  OG_ACTION_MODEL: 'action-model',
  WORLD_APP_ID: 'app_test',
  WORLD_ACTION: 'verify',
};

async function loadApp(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of Object.keys(REQUIRED_ENV)) {
    process.env[key] = REQUIRED_ENV[key as keyof typeof REQUIRED_ENV];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const { versionRoute } = await import('./version');
  const app = new Hono();
  app.route('/version', versionRoute);
  return app;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /version', () => {
  it('returns Vercel deployment and git metadata when available', async () => {
    const app = await loadApp({
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      VERCEL_URL: 'genie-preview.vercel.app',
      VERCEL_REGION: 'iad1',
      VERCEL_GIT_COMMIT_SHA: '4a16a37d093f3e4941b70fed01b1257bf0258bc9',
      VERCEL_GIT_COMMIT_REF: 'api-contract-test-coverage',
      VERCEL_GIT_COMMIT_MESSAGE: 'Fix API tests and contract validation',
      VERCEL_GIT_COMMIT_AUTHOR_LOGIN: 'lordofsnakes',
    });

    const res = await app.fetch(new Request('http://localhost/version'));
    expect(res.status).toBe(200);

    const json = await res.json() as Record<string, any>;
    expect(json.service).toBe('genie-api');
    expect(json.status).toBe('ok');
    expect(json.deployment).toEqual({
      provider: 'vercel',
      environment: 'preview',
      url: 'https://genie-preview.vercel.app',
      region: 'iad1',
    });
    expect(json.git).toEqual({
      sha: '4a16a37d093f3e4941b70fed01b1257bf0258bc9',
      shortSha: '4a16a37',
      branch: 'api-contract-test-coverage',
      message: 'Fix API tests and contract validation',
      author: 'lordofsnakes',
    });
  });

  it('returns safe local fallbacks when deployment metadata is unavailable', async () => {
    const app = await loadApp({
      VERCEL: undefined,
      VERCEL_ENV: undefined,
      VERCEL_URL: undefined,
      VERCEL_REGION: undefined,
      VERCEL_GIT_COMMIT_SHA: undefined,
      VERCEL_GIT_COMMIT_REF: undefined,
      VERCEL_GIT_COMMIT_MESSAGE: undefined,
      VERCEL_GIT_COMMIT_AUTHOR_LOGIN: undefined,
      NODE_ENV: 'test',
    });

    const res = await app.fetch(new Request('http://localhost/version'));
    expect(res.status).toBe(200);

    const json = await res.json() as Record<string, any>;
    expect(json.deployment).toEqual({
      provider: 'local',
      environment: 'test',
      url: null,
      region: null,
    });
    expect(json.git.shortSha).toBe('unknown');
    expect(json.git.branch).toBe('unknown');
  });
});
