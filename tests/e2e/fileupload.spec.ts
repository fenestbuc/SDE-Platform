import { test, expect } from '@playwright/test';

test.describe('File Upload Flow', () => {
  const userA = `uploader_${Date.now()}`;
  const userB = `receiver_${Date.now()}`;
  const password = 'SecurePassword123!';

  test.beforeAll(async ({ browser }) => {
    // Pre-register both users
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    
    for (const u of [userA, userB]) {
      await page.goto('/register');
      await page.fill('input[type="email"]', `${u}@example.com`);
      await page.fill('input[type="text"]', u);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/.*\/login/);
    }
    await context.close();
  });

  test('User A sends encrypted file to User B', async ({ browser }) => {
    // User A session
    const contextA = await browser.newContext({ acceptDownloads: true });
    const pageA = await contextA.newPage();
    pageA.on('console', msg => console.log('Page A console:', msg.text()));
    
    await pageA.goto('/login');
    await pageA.fill('input[type="text"]', userA);
    await pageA.fill('input[type="password"]', password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForURL(/.*\/dashboard/);

    // Create a dummy file to upload
    const fileContent = 'This is a top secret attachment content';
    const filePath = 'top_secret.txt';
    // Use Playwright API to set files directly
    const fileChooserPromise = pageA.waitForEvent('filechooser');

    await pageA.fill('#compose-to', userB);
    await pageA.fill('#compose-body', 'Here is the file!');

    await pageA.click('#compose-file'); // triggers filechooser
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: filePath,
        mimeType: 'text/plain',
        buffer: Buffer.from(fileContent)
    });

    await pageA.click('button:has-text("Send Encrypted")');
    await expect(pageA.locator('text=Message sent successfully!')).toBeVisible({ timeout: 15000 });
    await contextA.close();

    // User B session
    const contextB = await browser.newContext({ acceptDownloads: true });
    const pageB = await contextB.newPage();
    pageB.on('console', msg => console.log('Page B console:', msg.text()));
    
    await pageB.goto('/login');
    await pageB.fill('input[type="text"]', userB);
    await pageB.fill('input[type="password"]', password);
    await pageB.click('button[type="submit"]');
    await pageB.waitForURL(/.*\/dashboard/);

    // Check inbox
    await pageB.waitForSelector('text=From: ' + userA, { timeout: 15000 });
    await expect(pageB.locator('text=From: ' + userA)).toBeVisible();
    await pageB.click('text=From: ' + userA);

    // Verify message text and wait for Download Attachment button
    await expect(pageB.locator('text=Here is the file!')).toBeVisible();
    await expect(pageB.locator('button:has-text("Download Attachment")')).toBeVisible();

    const downloadPromise = pageB.waitForEvent('download', { timeout: 15000 });
    await pageB.click('button:has-text("Download Attachment")');
    const download = await downloadPromise;

    // Save and check content
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("Download failed");
    
    const fs = require('fs');
    const downloadedContent = fs.readFileSync(downloadPath, 'utf-8');

    expect(downloadedContent).toEqual(fileContent);

    await contextB.close();
  });
});