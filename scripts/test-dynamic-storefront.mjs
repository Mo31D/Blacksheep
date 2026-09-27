import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fail=[];
const read=p=>fs.readFileSync(path.join(repoRoot,p),'utf8');

const live=read('assets/commerce-live.js');
const site=read('assets/site.js');
const collection=read('collection.html');
const index=read('commerce/src/index.ts');
const route=read('commerce/src/routes/catalog.ts');

const expect=(condition,message)=>{if(!condition)fail.push(message)};

expect(route.includes('/v1/storefront-structure'),'Public Storefront Structure endpoint missing.');
expect(route.includes('listPublishedStorefrontNodes'),'Published Storefront Structure data source missing.');
expect(index.includes('url.pathname === "/v1/storefront-structure"'),'Worker does not route Storefront Structure endpoint.');

expect(live.includes("apiBase+'/v1/storefront-structure'"),'Live commerce loader does not fetch Storefront Structure.');
expect(live.includes('commerceStorefrontNodeIds'),'Product live overlay does not preserve Storefront placement ids.');
expect(live.includes('structureFallback'),'Storefront Structure failure is not isolated from catalogue fallback.');

for(const contract of [
  'function syncDynamicStorefrontStructure(nodes)',
  'function syncStorefrontNavigation(nodes)',
  'function renderDynamicCollectionPage(nodes)',
  'function syncLegacyCollectionChildren(nodes)',
  'function dynamicCollectionRows(node,nodes)',
  'function storefrontCollectionUrl(node)'
]){
  expect(site.includes(contract),'Missing dynamic storefront function: '+contract);
}
expect(site.includes("if(node.legacyPath)return String(node.legacyPath)"),'Legacy Storefront URLs are not preserved.');
expect(site.includes("'/collection.html?section='"),'New Storefront nodes do not receive dynamic collection URLs.');
expect(site.includes("node.showInNavigation===true"),'Navigation does not respect show-in-navigation.');
expect(site.includes("data.dynamicStorefrontChild='1'")||site.includes("dataset.dynamicStorefrontChild='1'"),'Legacy collection pages do not expose newly published child sections.');
expect(site.includes("Number(a.sortOrder||0)-Number(b.sortOrder||0)"),'Navigation/collections do not respect Storefront ordering.');
expect(site.includes('item.commerceStorefrontNodeIds'),'Dynamic collection membership is not placement-driven.');
expect(site.includes("location.replace(node.legacyPath)"),'Dynamic collection route does not hand legacy nodes back to existing indexed URLs.');

expect(site.includes("safeName=storefrontEscape(item.name||'')"),'Dynamic Product cards do not escape Admin-authored names.');
expect(site.includes("safeDesc=storefrontEscape(item.desc||'')"),'Dynamic Product cards do not escape Admin-authored descriptions.');
expect(site.includes('data-basket-type="${safeType}"')&&site.includes('data-basket-slug="${safeSlug}"'),'Dynamic Product basket buttons are not data-driven/escaped.');
expect(site.includes("storefrontEscape(images[0].alt||item.name||'')"),'Dynamic Product detail media alt text is not escaped.');
expect(site.includes("item.note?'<div class=\"info-row\"><strong>Range note</strong><span>'+esc(item.note)"),'Dynamic Product detail notes are not escaped.');
expect(site.includes("if(data&&btn.dataset.basketType&&btn.dataset.basketSlug"),'Dynamic Product basket buttons are not wired without inline Admin-shaped JavaScript.');

expect(/id=["']dynamicCollectionPage["']/.test(collection),'Dynamic collection page shell missing.');
expect(/name=["']robots["'][^>]*noindex,follow/i.test(collection),'Dynamic collection compatibility route must remain noindex until CARD 12.');
expect(collection.includes('id="dynamicCollectionTitle"'),'Dynamic collection title mount missing.');
expect(collection.includes('id="dynamicCollectionChildren"'),'Dynamic child collection mount missing.');
expect(collection.includes('id="catalog"'),'Dynamic product grid mount missing.');
expect(collection.includes('assets/catalog.js')&&collection.includes('assets/site.js'),'Dynamic collection page does not load storefront runtime.');

if(fail.length){
  console.error('Dynamic Storefront contract checks failed:');
  fail.forEach(x=>console.error('- '+x));
  process.exit(1);
}
console.log('Dynamic Storefront contract checks passed.');
