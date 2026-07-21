const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve('output/playwright/goal-5-auth-pwa/');

const viewports = [
  { name: 'Mobile', width: 390, height: 844 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1440, height: 900 }
];

const urls = [
  { name: 'ConsumerLogin', url: 'http://localhost:3000/auth/login' },
  { name: 'ConsumerRegister', url: 'http://localhost:3000/auth/register' },
  { name: 'SellerLogin', url: 'http://localhost:3000/seller/login' },
  { name: 'SellerRegister', url: 'http://localhost:3000/seller/register' },
  { name: 'AdminLogin', url: 'http://localhost:3000/admin/login' },
  { name: 'ConsumerOTP', url: 'http://localhost:3000/auth/verify-code?email=test%40zogular.com' },
];

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const browser = await chromium.launch();
  
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height }
    });
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
