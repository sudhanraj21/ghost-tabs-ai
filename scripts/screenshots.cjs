const { chromium } = require('playwright');

async function takeScreenshots() {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  
  const pages = [
    { url: 'http://localhost:8080/options.html', name: 'screenshot-settings' },
    { url: 'http://localhost:8080/sidepanel.html', name: 'screenshot-sidepanel' },
  ];
  
  for (const p of pages) {
    await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `store-assets/${p.name}.png`, fullPage: true });
    console.log(`Saved ${p.name}.png`);
  }
  
  await browser.close();
  console.log('Done!');
}

takeScreenshots().catch(console.error);