# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: messaging.spec.ts >> Messaging Flow >> User A sends encrypted message to User B
- Location: tests/e2e/messaging.spec.ts:24:7

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
  3  | test.describe('Messaging Flow', () => {
  4  |   const userA = `alice_${Date.now()}`;
  5  |   const userB = `bob_${Date.now()}`;
  6  |   const password = 'SecurePassword123!';
  7  | 
  8  |   test.beforeAll(async ({ browser }) => {
  9  |     // Pre-register both users
  10 |     const context = await browser.newContext();
  11 |     const page = await context.newPage();
  12 |     
  13 |     for (const u of [userA, userB]) {
> 14 |       await page.goto('/register');
     |                  ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/register
  15 |       await page.fill('input[type="email"]', `${u}@example.com`);
  16 |       await page.fill('input[type="text"]', u);
  17 |       await page.fill('input[type="password"]', password);
  18 |       await page.click('button[type="submit"]');
  19 |       await page.waitForURL(/.*\/login/, { timeout: 15000 });
  20 |     }
  21 |     await context.close();
  22 |   });
  23 | 
  24 |   test('User A sends encrypted message to User B', async ({ browser }) => {
  25 |     // User A session
  26 |     const contextA = await browser.newContext();
  27 |     const pageA = await contextA.newPage();
  28 |     await pageA.goto('/login');
  29 |     await pageA.fill('input[type="text"]', userA);
  30 |     await pageA.fill('input[type="password"]', password);
  31 |     await pageA.click('button[type="submit"]');
  32 |     await pageA.waitForURL(/.*\/dashboard/);
  33 | 
  34 |     // Compose
  35 |     await pageA.fill('#compose-to', userB);
  36 |     await pageA.fill('#compose-body', 'Hello Bob, this is a secret message!');
  37 |     await pageA.click('button:has-text("Send Encrypted")');
  38 |     await expect(pageA.locator('text=Message sent successfully!')).toBeVisible({ timeout: 15000 });
  39 |     await contextA.close();
  40 | 
  41 |     // User B session
  42 |     const contextB = await browser.newContext();
  43 |     const pageB = await contextB.newPage();
  44 |     await pageB.goto('/login');
  45 |     await pageB.fill('input[type="text"]', userB);
  46 |     await pageB.fill('input[type="password"]', password);
  47 |     await pageB.click('button[type="submit"]');
  48 |     await pageB.waitForURL(/.*\/dashboard/);
  49 | 
  50 |     // Check inbox
  51 |     await pageB.waitForSelector('text=From: ' + userA, { timeout: 15000 });
  52 |     await expect(pageB.locator('text=From: ' + userA)).toBeVisible();
  53 |     await pageB.click('text=From: ' + userA);
  54 | 
  55 |     // Decrypt and verify
  56 |     await expect(pageB.locator('text=Hello Bob, this is a secret message!')).toBeVisible({ timeout: 15000 });
  57 |     await contextB.close();
  58 |   });
  59 | });
  60 | 
```