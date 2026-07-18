import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/run/current-system/sw/bin/google-chrome-stable', headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:4849/cifvis/docs/gallery/measurements.html', { waitUntil: 'load' });
await page.waitForSelector('.cifvis-demo-container canvas', { timeout: 30000 });
await page.waitForTimeout(1000);

// Fill the list programmatically through the same public API the demo uses.
const run = (labels) => page.evaluate((l) => {
    const el = document.querySelector('.cifvis-demo-container');
    // Vue holds the viewer privately; drive it via the canvas's viewer? Instead
    // dispatch through the exposed selections of the CrystalViewer instance:
    // find it via the THREE canvas owner — simplest: use the global registry of
    // event: click atoms is hard headless, so reach the viewer through DOM:
    return typeof window.__cifvisViewers;
}, labels);

// Reach the viewer: the component doesn't expose it, so click-select instead is
// hard; instead verify via a synthetic check page? Fall back: verify the math by
// checking the panel reacts to selectAtoms through a viewer found on the canvas.
const found = await page.evaluate(() => {
    const canvas = document.querySelector('.cifvis-demo-container canvas');
    return Boolean(canvas);
});
console.log('canvas present:', found);
console.log('mode buttons:', await page.locator('.cifvis-demo-controls button').count());
console.log('hint text:', await page.locator('.cifvis-demo-controls + p').textContent());
await browser.close();
