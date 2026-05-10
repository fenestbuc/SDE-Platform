import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1, // Sequential for predictable DB state
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  }
});
