# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fileupload.spec.ts >> File Upload Flow >> User A sends encrypted file to User B
- Location: tests/e2e/fileupload.spec.ts:24:7

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
  3  | test.describe('File Upload Flow', () => {
  4  |   const userA = `uploader_${Date.now()}`;
  5  |   const userB = `receiver_${Date.now()}`;
  6  |   const password = 'SecurePassword123!';
  7  | 
  8  |   test.beforeAll(async ({ browser }) => {
  9  |     // Pre-register both users
  10 |     const context = await browser.newContext({ acceptDownloads: true });
  11 |     const page = await context.newPage();
  12 |     
  13 |     for (const u of [userA, userB]) {
> 14 |       await page.goto('/register');
     |                  ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/register
  15 |       await page.fill('input[type="email"]', `${u}@example.com`);
  16 |       await page.fill('input[type="text"]', u);
  17 |       await page.fill('input[type="password"]', password);
  18 |       await page.click('button[type="submit"]');
  19 |       await page.waitForURL(/.*\/login/);
  20 |     }
  21 |     await context.close();
  22 |   });
  23 | 
  24 |   test('User A sends encrypted file to User B', async ({ browser }) => {
  25 |     // User A session
  26 |     const contextA = await browser.newContext({ acceptDownloads: true });
  27 |     const pageA = await contextA.newPage();
  28 |     pageA.on('console', msg => console.log('Page A console:', msg.text()));
  29 |     
  30 |     await pageA.goto('/login');
  31 |     await pageA.fill('input[type="text"]', userA);
  32 |     await pageA.fill('input[type="password"]', password);
  33 |     await pageA.click('button[type="submit"]');
  34 |     await pageA.waitForURL(/.*\/dashboard/);
  35 | 
  36 |     // Create a dummy file to upload
  37 |     const fileContent = 'This is a top secret attachment content';
  38 |     const filePath = 'top_secret.txt';
  39 |     // Use Playwright API to set files directly
  40 |     const fileChooserPromise = pageA.waitForEvent('filechooser');
  41 | 
  42 |     await pageA.fill('#compose-to', userB);
  43 |     await pageA.fill('#compose-body', 'Here is the file!');
  44 | 
  45 |     await pageA.click('#compose-file'); // triggers filechooser
  46 |     const fileChooser = await fileChooserPromise;
  47 |     await fileChooser.setFiles({
  48 |         name: filePath,
  49 |         mimeType: 'text/plain',
  50 |         buffer: Buffer.from(fileContent)
  51 |     });
  52 | 
  53 |     await pageA.click('button:has-text("Send Encrypted")');
  54 |     await expect(pageA.locator('text=Message sent successfully!')).toBeVisible({ timeout: 15000 });
  55 |     await contextA.close();
  56 | 
  57 |     // User B session
  58 |     const contextB = await browser.newContext({ acceptDownloads: true });
  59 |     const pageB = await contextB.newPage();
  60 |     pageB.on('console', msg => console.log('Page B console:', msg.text()));
  61 |     
  62 |     await pageB.goto('/login');
  63 |     await pageB.fill('input[type="text"]', userB);
  64 |     await pageB.fill('input[type="password"]', password);
  65 |     await pageB.click('button[type="submit"]');
  66 |     await pageB.waitForURL(/.*\/dashboard/);
  67 | 
  68 |     // Check inbox
  69 |     await pageB.waitForSelector('text=From: ' + userA, { timeout: 15000 });
  70 |     await expect(pageB.locator('text=From: ' + userA)).toBeVisible();
  71 |     await pageB.click('text=From: ' + userA);
  72 | 
  73 |     // Verify message text and wait for Download Attachment button
  74 |     await expect(pageB.locator('text=Here is the file!')).toBeVisible();
  75 |     await expect(pageB.locator('button:has-text("Download Attachment")')).toBeVisible();
  76 | 
  77 |     const downloadPromise = pageB.waitForEvent('download', { timeout: 15000 });
  78 |     await pageB.click('button:has-text("Download Attachment")');
  79 |     const download = await downloadPromise;
  80 | 
  81 |     // Save and check content
  82 |     const downloadPath = await download.path();
  83 |     if (!downloadPath) throw new Error("Download failed");
  84 |     
  85 |     const fs = require('fs');
  86 |     const downloadedContent = fs.readFileSync(downloadPath, 'utf-8');
  87 | 
  88 |     expect(downloadedContent).toEqual(fileContent);
  89 | 
  90 |     await contextB.close();
  91 |   });
  92 | });
```