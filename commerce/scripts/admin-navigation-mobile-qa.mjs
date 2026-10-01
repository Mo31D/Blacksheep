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
const nodes = [
  { id: 'sfn_gifts_peter_rabbit', name: 'Peter Rabbit', legacyPath: '/gifts-peter-rabbit.html', publicationStatus: 'ACTIVE', publishedVersionId: 'sfv-rabbit' },
  { id: 'sfn_gifts_highland_cows', name: 'Highland Cows', legacyPath: '/gifts-highland-cows.html', publicationStatus: 'ACTIVE', publishedVersionId: 'sfv-cows' },
  { id: 'sfn_icecream', name: 'Ice Cream', legacyPath: '/icecream.html', publicationStatus: 'ACTIVE', publishedVersionId: 'sfv-icecream' },
  { id: 'sfn_local_treats', name: 'Local Treats', slug: 'local-treats', parentNodeId: null, sortOrder: 10, publicationStatus: 'ACTIVE', publishedVersionId: 'sfv-local' },
  { id: 'sfn_romneys', name: "Romney's", slug: 'romneys', parentNodeId: 'sfn_local_treats', sortOrder: 10, publicationStatus: 'ACTIVE', publishedVersionId: 'sfv-romneys' },
  { id: 'sfn_mint_cake', name: 'Mint Cake', slug: 'mint-cake', parentNodeId: 'sfn_romneys', sortOrder: 10, publicationStatus: 'ACTIVE', publishedVersionId: 'sfv-mint' },
];
const homepage = {
  version: 1, hasDraft: false, publishedVersionId: 'hmv-default', enabled: false,
  mode: 'NEW_ARRIVALS', productLimit: 8, heading: null, selectedStorefrontNodeId: null,
  featuredProducts: [], modules: ['HERO', 'COLLECTIONS', 'PRODUCT_RAIL', 'LOCAL_FAVOURITES', 'VISIT_SHOP'].map((key, index) => ({ key, enabled: true, position: (index + 1) * 10 })),
  cards: {
    COLLECTIONS: nodes.slice(0, 2).map((node, index) => ({ storefrontNodeId: node.id, name: node.name, imageUrl: null, position: (index + 1) * 10 })),
    LOCAL_FAVOURITES: [{ storefrontNodeId: nodes[2].id, name: nodes[2].name, imageUrl: null, position: 10 }],
  },
};
let draftWrites = 0;
let pendingUploadResponse = null;
let mediaUploadCount = 0;
async function waitForUploadResponse() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (pendingUploadResponse) return pendingUploadResponse;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Mock Image Library upload did not reach the server');
}
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (request.method !== 'GET' && pathname.includes('/draft')) draftWrites++;
  if (pathname === '/admin/api/media' && request.method === 'POST') {
    mediaUploadCount++;
    pendingUploadResponse = response;
    return;
  }
  if (pathname === '/admin') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
  } else {
    const body = pathname === '/admin/api/storefront-structure' ? { nodes }
      : pathname === '/admin/api/homepage-merchandising' ? { config: homepage }
      : pathname === '/admin/api/media' ? { assets: [
          { id: 'asset-existing', publicUrl: '/media/asset-existing', title: 'Existing section artwork', altText: 'Existing artwork', status: 'ACTIVE', currentUsageCount: 1, usageCount: 2 },
          { id: 'asset-history', publicUrl: '/media/asset-history', title: 'Saved artwork', status: 'ACTIVE', currentUsageCount: 0, usageCount: 1 },
          { id: 'asset-unused', publicUrl: '/media/asset-unused', title: 'New artwork', status: 'ACTIVE', currentUsageCount: 0, usageCount: 0 },
        ] }
      : pathname === '/admin/api/media/asset-existing/usage' ? { asset: { id: 'asset-existing', title: 'Existing section artwork', usageCount: 2 }, places: [{ type: 'SECTION', label: 'Local Treats', published: true, draft: false }] } : {};
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
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
        await page.locator('#homepageCollectionCards .homepage-destination-row').first().waitFor();
        assert.equal(await page.locator('#homepageCollectionCards .homepage-destination-row').count(), 2, `${engine}: card editor shows current collections`);
        await page.locator('#homepageCollectionCards [data-card-move="1"]').first().click();
        assert.equal(await page.locator('#homepageCollectionCards .homepage-destination-row strong').first().textContent(), 'Highland Cows', `${engine}: phone reorder works`);
        page.once('dialog', dialog => dialog.dismiss());
        await page.locator('#homepagePublish').click();
        assert.equal(draftWrites, 0, `${engine}: cancelling Publish must not save the draft`);
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
        await page.locator('[data-structure-edit="sfn_mint_cake"]').waitFor();
        assert.equal(await page.locator('#storefrontStructureTree').innerText().then(text => text.includes('Local Treats') && text.includes("Romney's") && text.includes('Mint Cake')), true, `${engine}: third-level structure is visible`);
        await page.locator('[data-structure-edit="sfn_romneys"]').click();
        assert.equal(await page.locator('#structureParent').inputValue(), 'sfn_local_treats', `${engine}: parent with children remains editable`);
        const uploadRequest = page.waitForRequest(request => request.url().endsWith('/admin/api/media') && request.method() === 'POST');
        await page.locator('#structureImageUpload').setInputFiles({ name: 'section.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
        await uploadRequest;
        assert.equal(await page.locator('#saveStructureNode').isDisabled(), true, `${engine}: Save waits for image upload`);
        assert.ok(pendingUploadResponse, `${engine}: media upload reached shared endpoint`);
        pendingUploadResponse.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ asset: { id: 'asset-fixture', publicUrl: '/media/asset-fixture' } }));
        pendingUploadResponse = null;
        await page.waitForFunction(() => document.getElementById('saveStructureNode')?.disabled === false);
        assert.equal(await page.locator('#structureImageUrl').inputValue(), '/media/asset-fixture', `${engine}: upload fills canonical Section draft`);
        await page.locator('#structureImageChoose').click();
        await page.locator('[data-structure-image-choice="asset-existing"]').waitFor();
        await page.locator('[data-structure-image-choice="asset-existing"]').click();
        assert.equal(await page.locator('#structureImageUrl').inputValue(), '/media/asset-existing', `${engine}: existing Shared Media selection fills the same Section draft`);
        const beforeDuplicate = mediaUploadCount;
        const duplicateRequest = page.waitForRequest(request => request.url().endsWith('/admin/api/media') && request.method() === 'POST');
        await page.locator('#structureImageUpload').setInputFiles({ name: 'same-artwork.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
        await duplicateRequest;
        (await waitForUploadResponse()).writeHead(409, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { code: 'shared_media_duplicate' }, existingAsset: { id: 'asset-existing', title: 'Existing section artwork', publicUrl: '/media/asset-existing', status: 'ACTIVE' } }));
        pendingUploadResponse = null;
        await page.locator('.media-duplicate-dialog').waitFor();
        await page.locator('.media-duplicate-dialog button[value="reuse"]').click();
        await page.waitForFunction(() => document.getElementById('saveStructureNode')?.disabled === false);
        assert.equal(mediaUploadCount, beforeDuplicate + 1, `${engine}: reuse does not create another image`);
        assert.equal(await page.locator('#structureImageUrl').inputValue(), '/media/asset-existing', `${engine}: reuse fills the Section draft`);
        const separateProbe = page.waitForRequest(request => request.url().endsWith('/admin/api/media') && request.method() === 'POST');
        await page.locator('#structureImageUpload').setInputFiles({ name: 'separate-artwork.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
        await separateProbe;
        (await waitForUploadResponse()).writeHead(409, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { code: 'shared_media_duplicate' }, existingAsset: { id: 'asset-existing', title: 'Existing section artwork', publicUrl: '/media/asset-existing', status: 'ACTIVE' } }));
        pendingUploadResponse = null;
        const separateRetry = page.waitForRequest(request => request.url().endsWith('/admin/api/media') && request.method() === 'POST');
        await page.locator('.media-duplicate-dialog button[value="separate"]').click();
        await separateRetry;
        await waitForUploadResponse();
        assert.equal(mediaUploadCount, beforeDuplicate + 3, `${engine}: separate copy requires a second explicit request`);
        assert.ok(pendingUploadResponse, `${engine}: separate choice retries upload explicitly`);
        pendingUploadResponse.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify({ asset: { id: 'asset-separate', publicUrl: '/media/asset-separate' } }));
        pendingUploadResponse = null;
        await page.waitForFunction(() => document.getElementById('saveStructureNode')?.disabled === false);
        assert.equal(await page.locator('#structureImageUrl').inputValue(), '/media/asset-separate', `${engine}: separate choice fills its own new asset`);
        assert.equal(draftWrites, 0, `${engine}: image selection stays private until Save`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${engine}: structure editor fits ${width}px`);
        await page.locator('[data-close-product-sheet]').first().click();
        await page.locator('#backToWebsite').click();
        assert.equal(await page.locator('#view-website').isVisible(), true, `${engine}: Sections returns`);
        for (const [hash, tab] of [['appearance', 'appearance'], ['media', 'media']]) {
          await page.goto(base + '/admin#' + hash);
          // A same-document hash navigation does not execute the Admin bootstrap again.
          await page.reload();
          assert.equal(await page.locator('#view-website').isVisible(), true, `${engine}: ${hash} deep link`);
          assert.equal(await page.locator(`[data-website-tab="${tab}"].active`).count(), 1, `${engine}: ${tab} selected`);
          if (tab === 'appearance') {
            const heroUploadRequest = page.waitForRequest(request => request.url().endsWith('/admin/api/media') && request.method() === 'POST');
            await page.locator('#appearanceHeroUpload').setInputFiles({ name: 'hero.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
            await heroUploadRequest;
            await waitForUploadResponse();
            for (const id of ['appearanceSaveDraft', 'appearancePreview', 'appearancePublish', 'appearanceHeroClear', 'appearanceHeroChooseMedia']) {
              assert.equal(await page.locator('#' + id).isDisabled(), true, `${engine}: ${id} waits for Hero upload`);
            }
            pendingUploadResponse.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify({ asset: { id: 'hero-upload', publicUrl: '/media/hero-upload' } }));
            pendingUploadResponse = null;
            await page.waitForFunction(() => document.getElementById('appearanceSaveDraft')?.disabled === false);
            assert.equal(await page.locator('#appearanceHeroImage').inputValue(), '/media/hero-upload', `${engine}: Hero upload fills the private form after completion`);
            await page.locator('#appearanceHeroChooseMedia').click();
            await page.locator('[data-appearance-image-choice="asset-existing"]').waitFor();
            await page.locator('[data-appearance-image-choice="asset-existing"]').click();
            assert.equal(await page.locator('#appearanceHeroImage').inputValue(), '/media/asset-existing', `${engine}: Hero selects existing image in place`);
            assert.equal(draftWrites, 0, `${engine}: Hero selection does not save a draft`);
          }
        }
        await page.locator('[data-shared-media-usage="asset-existing"]').waitFor();
        assert.equal(await page.locator('#sharedMediaGrid').innerText().then(text => text.includes('1 current place') && text.includes('Retained by saved content') && text.includes('Unused')), true, `${engine}: current, historical and unused image states are distinct`);
        await page.locator('[data-shared-media-usage="asset-existing"]').click();
        assert.equal(await page.locator('#sharedMediaUsage').evaluate(dialog => dialog.open), true, `${engine}: usage dialog opens`);
        assert.equal(await page.locator('#sharedMediaUsageBody').innerText().then(text => text.includes('Local Treats') && text.includes('Published')), true, `${engine}: usage names the actual published Section`);
        await page.locator('#sharedMediaUsage button[type="submit"]').click();
        assert.equal(await page.locator('#sharedMediaUsage').evaluate(dialog => dialog.open), false, `${engine}: usage dialog closes`);
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
