const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve('output/playwright/goal-7-portal-acceptance');

const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
];

const urls = [
  { name: 'Consumer-Home', url: 'http://localhost:3000/' },
  { name: 'Consumer-Category', url: 'http://localhost:3000/category/smartphones' },
  { name: 'Seller-Dashboard', url: 'http://localhost:3000/seller/dashboard' },
  { name: 'Admin-Dashboard', url: 'http://localhost:3000/admin/dashboard' },
  { name: 'Admin-Buyers', url: 'http://localhost:3000/admin/buyers' },
  { name: 'Admin-Access', url: 'http://localhost:3000/admin/access' },
];

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    
    const expires = Date.now() / 1000 + 3600;
    await context.addCookies([
      { name: 'admin_session', value: 'admin_token', domain: 'localhost', path: '/', expires },
      { name: 'vendor_session', value: 'vendor_token', domain: 'localhost', path: '/', expires }
    ]);

    const page = await context.newPage();

    for (const u of urls) {
      console.log(`Navigating to ${u.name} on ${vp.name}...`);
      try {
        await page.goto(u.url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        const screenshotPath = path.join(OUTPUT_DIR, `${u.name}-${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Saved screenshot to ${screenshotPath}`);
      } catch (e) {
        console.error(`Failed to capture ${u.name} on ${vp.name}:`, e);
      }
    }

    await context.close();
  }

  await browser.close();
}

main().catch(console.error);
