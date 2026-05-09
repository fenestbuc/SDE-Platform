import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const username = `user_${Date.now()}`;
  const email = `${username}@example.com`;
  const password = 'SecurePassword123!';

  test('should register a new user and login', async ({ page }) => {
    // Register
    await page.goto('/register');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for redirect to login
    await expect(page).toHaveURL(/.*\/login/);

    // Login
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('text=Welcome, ' + username)).toBeVisible();
  });
});
