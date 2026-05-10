import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1, // Sequential for predictable DB state
  globalSetup: require.resolve('./tests/e2e/global.setup.ts'),
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && cd src/client && npm run build && cd ../.. && npm run start',
    url: 'http://localhost:3000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test'
    }
  }
});
