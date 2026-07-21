import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'output', 'playwright', 'homepage-cards-qa');

const VIEWPORTS = [
  { width: 320, height: 568, name: 'mobile-small' },
  { width: 390, height: 844, name: 'iphone-12' },
  { width: 430, height: 932, name: 'iphone-14-pro-max' },
  { width: 768, height: 1024, name: 'ipad' },
  { width: 1440, height: 900, name: 'desktop' }
];

const ROUTES = [
  { path: '/', name: 'homepage' }
];

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    for (const route of ROUTES) {
      console.log(`Taking screenshot for ${route.name} at ${viewport.name}`);
      try {
        await page.goto(`http://localhost:3000${route.path}`, { waitUntil: 'networkidle', timeout: 10000 });
        const filePath = path.join(OUT_DIR, `${route.name}-${viewport.name}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
      } catch (err) {
        console.error(`Failed to capture ${route.name} at ${viewport.name}:`, err.message);
      }
    }
    await context.close();
  }

  await browser.close();
}

main().catch(console.error);
