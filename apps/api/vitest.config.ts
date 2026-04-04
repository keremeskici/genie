import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './src',
    environment: 'node',
    env: {
      OG_COMPUTE_URL: 'http://localhost:8000',
      OG_API_KEY: 'test-key',
      OG_PLANNING_MODEL: 'test-planning-model',
      OG_ACTION_MODEL: 'test-action-model',
      OG_KV_CLIENT_URL: 'http://localhost:6789',
      OG_KV_STREAM_ID: '0xtest-stream-id',
    },
  },
});
