import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'output', 'playwright', 'product-details-qa');

const VIEWPORTS = [
  { width: 390, height: 844, name: 'mobile' }, // iPhone 12
  { width: 1440, height: 900, name: 'desktop' } // Standard Desktop
];

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to homepage to find a product link...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
  
  const productLink = await page.$('a[href^="/product/"]');
  if (!productLink) {
    console.error('Could not find any product link on the homepage!');
    await browser.close();
    return;
  }
  
  const productHref = await productLink.getAttribute('href');
  const fullUrl = `http://localhost:3000${productHref}`;
  console.log(`Found product link: ${fullUrl}`);

  for (const viewport of VIEWPORTS) {
    console.log(`Taking screenshot for ${viewport.name}...`);
    const vpContext = await browser.newContext({ viewport });
    const vpPage = await vpContext.newPage();
    
    try {
      await vpPage.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
      // Add a slight delay for any client-side hydration/images to load
      await vpPage.waitForTimeout(1000);
      
      const filePath = path.join(OUT_DIR, `product-details-${viewport.name}.png`);
      await vpPage.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved screenshot to ${filePath}`);
    } catch (err) {
      console.error(`Failed to capture ${viewport.name}:`, err.message);
    }
    
    await vpContext.close();
  }

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
