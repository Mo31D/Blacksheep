import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, webkit } from 'playwright';

// Exercise the generated Admin at actual phone viewports without touching staging data.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/admin/ui.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64');
const { adminHtml } = await import(moduleUrl);
const html = adminHtml('owner@example.test', 'staging');
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/admin') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
  } else {
    response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;

try {
  for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await browserType.launch();
    try {
      for (const width of [390, 320]) {
        const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/admin#website');
        assert.equal(await page.evaluate(() => innerWidth), width, `${engine}: actual viewport`);
        assert.equal(await page.locator('.mobile-bottom').isVisible(), true, `${engine}: phone navigation`);
        assert.equal(await page.locator('.sidebar').isVisible(), false, `${engine}: desktop sidebar hidden`);
        assert.equal(await page.locator('#view-website').isVisible(), true, `${engine}: Website opens`);
        assert.equal(await page.locator('.mobile-bottom [data-nav]').count(), 4, `${engine}: four primary mobile jobs`);
        await page.locator('#openAdminNavigation').click();
        assert.equal(await page.locator('#adminNavigation').evaluate(dialog => dialog.open), true, `${engine}: More opens`);
        assert.deepEqual(await page.locator('#adminNavigation [data-nav]').allTextContents(), ['Website', 'Reports'], `${engine}: no duplicate child destinations`);
        await page.locator('#adminNavigation [data-nav="reports"]').click();
        assert.equal(await page.locator('#view-reports').isVisible(), true, `${engine}: Reports opens`);
        assert.equal(await page.locator('#adminNavigation').evaluate(dialog => dialog.open), false, `${engine}: More closes after choice`);
        await page.locator('#openAdminNavigation').click();
        await page.locator('#adminNavigation [data-nav="website"]').click();
        assert.equal(await page.locator('#view-website').isVisible(), true, `${engine}: Website returns`);
        assert.equal(await page.locator('#view-website [data-website-tab]').count(), 4, `${engine}: four Website tasks`);
        await page.locator('[data-website-tab="sections"]').click();
        assert.equal(await page.locator('#view-catalogue').isVisible(), true, `${engine}: Sections opens`);
        await page.locator('#backToWebsite').click();
        assert.equal(await page.locator('#view-website').isVisible(), true, `${engine}: Sections returns`);
        for (const [hash, tab] of [['appearance', 'appearance'], ['media', 'media']]) {
          await page.goto(base + '/admin#' + hash);
          assert.equal(await page.locator('#view-website').isVisible(), true, `${engine}: ${hash} deep link`);
          assert.equal(await page.locator(`[data-website-tab="${tab}"].active`).count(), 1, `${engine}: ${tab} selected`);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${engine}: no horizontal overflow at ${width}px`);
        assert.deepEqual(errors, [], `${engine}: no page errors at ${width}px`);
        await page.close();
        console.log(`${engine}: generated Admin navigation passed at ${width}px`);
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
