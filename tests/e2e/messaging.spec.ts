import { test, expect } from '@playwright/test';

test.describe('Messaging Flow', () => {
  const userA = `alice_${Date.now()}`;
  const userB = `bob_${Date.now()}`;
  const password = 'SecurePassword123!';

  test.beforeAll(async ({ browser }) => {
    // Pre-register both users
    const context = await browser.newContext();
    const page = await context.newPage();
    
    for (const u of [userA, userB]) {
      await page.goto('/register');
      await page.fill('input[type="email"]', `${u}@example.com`);
      await page.fill('input[type="text"]', u);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/.*\/login/, { timeout: 15000 });
    }
    await context.close();
  });

  test('User A sends encrypted message to User B', async ({ browser }) => {
    // User A session
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto('/login');
    await pageA.fill('input[type="text"]', userA);
    await pageA.fill('input[type="password"]', password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForURL(/.*\/dashboard/);

    // Compose
    await pageA.fill('#compose-to', userB);
    await pageA.fill('#compose-body', 'Hello Bob, this is a secret message!');
    await pageA.click('button:has-text("Send Encrypted")');
    await expect(pageA.locator('text=Message sent successfully!')).toBeVisible();
    await contextA.close();

    // User B session
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('/login');
    await pageB.fill('input[type="text"]', userB);
    await pageB.fill('input[type="password"]', password);
    await pageB.click('button[type="submit"]');
    await pageB.waitForURL(/.*\/dashboard/);

    // Check inbox
    await pageB.waitForSelector('text=From: ' + userA, { timeout: 15000 });
    await expect(pageB.locator('text=From: ' + userA)).toBeVisible();
    await pageB.click('text=From: ' + userA);

    // Decrypt and verify
    await expect(pageB.locator('text=Hello Bob, this is a secret message!')).toBeVisible();
    await contextB.close();
  });
});
