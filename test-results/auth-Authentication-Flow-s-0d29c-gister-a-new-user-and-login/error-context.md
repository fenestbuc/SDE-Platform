# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow >> should register a new user and login
- Location: tests/e2e/auth.spec.ts:8:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/register
Call log:
  - navigating to "http://localhost:3000/register", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Authentication Flow', () => {
  4  |   const username = `user_${Date.now()}`;
  5  |   const email = `${username}@example.com`;
  6  |   const password = 'SecurePassword123!';
  7  | 
  8  |   test('should register a new user and login', async ({ page }) => {
  9  |     // Register
> 10 |     await page.goto('/register');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/register
  11 |     await page.fill('input[type="email"]', email);
  12 |     await page.fill('input[type="text"]', username);
  13 |     await page.fill('input[type="password"]', password);
  14 |     await page.click('button[type="submit"]');
  15 | 
  16 |     // Wait for redirect to login
  17 |     await page.waitForURL(/.*\/login/);
  18 | 
  19 |     // Login
  20 |     await page.fill('input[type="text"]', username);
  21 |     await page.fill('input[type="password"]', password);
  22 |     await page.click('button[type="submit"]');
  23 | 
  24 |     // Wait for redirect to dashboard
  25 |     await expect(page).toHaveURL(/.*\/dashboard/);
  26 |     await expect(page.locator('text=Welcome, ' + username)).toBeVisible();
  27 |   });
  28 | });
  29 | 
```