import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './src',
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
  },
});
