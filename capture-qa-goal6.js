const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const ADMIN_ROUTES = [
  { name: "dashboard", url: "/admin/dashboard" },
  { name: "sellers", url: "/admin/sellers" },
  { name: "products", url: "/admin/products" },
  { name: "categories", url: "/admin/categories" },
  { name: "orders", url: "/admin/orders" },
  { name: "support", url: "/admin/support" },
];

const OUTPUT_DIR = path.join(process.cwd(), "output", "playwright", "goal-6-admin-recovery");

async function capture() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  
  for (const route of ADMIN_ROUTES) {
    console.log(`Capturing ${route.name}...`);
    
    // Desktop
    const desktopContext = await browser.newContext();
    const desktopPage = await desktopContext.newPage();
    
    // Auth - assuming standard next-auth or cookie setup if needed, 
    // or maybe the admin routes have a mock bypass for testing?
    // Here we'll try to set an admin session cookie if it's based on it.
    await desktopContext.addCookies([
      { name: "admin_session", value: "admin_token", domain: "localhost", path: "/", expires: Date.now() / 1000 + 3600 }
    ]);
    
    try {
      await desktopPage.goto(`http://localhost:3000${route.url}`, { waitUntil: "networkidle" });
      await desktopPage.waitForTimeout(2000);
      await desktopPage.screenshot({ path: path.join(OUTPUT_DIR, `${route.name}-desktop.png`), fullPage: true });
    } catch (e) {
      console.error(`Failed desktop ${route.name}`, e);
    }
    await desktopContext.close();

    // Mobile
    const mobileContext = await browser.newContext({
      ...devices['iPhone 13']
    });
    const mobilePage = await mobileContext.newPage();
    await mobileContext.addCookies([
      { name: "admin_session", value: "admin_token", domain: "localhost", path: "/", expires: Date.now() / 1000 + 3600 }
    ]);
    try {
      await mobilePage.goto(`http://localhost:3000${route.url}`, { waitUntil: "networkidle" });
      await mobilePage.waitForTimeout(2000);
      await mobilePage.screenshot({ path: path.join(OUTPUT_DIR, `${route.name}-mobile.png`), fullPage: true });
    } catch (e) {
      console.error(`Failed mobile ${route.name}`, e);
    }
    await mobileContext.close();
  }
  
  await browser.close();
  console.log("Done capturing.");
}

capture().catch(console.error);
