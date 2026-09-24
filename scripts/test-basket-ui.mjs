import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const site=fs.readFileSync(path.join(root,"assets","site.js"),"utf8");
const css=fs.readFileSync(path.join(root,"assets","style.css"),"utf8");
const basket=fs.readFileSync(path.join(root,"basket.html"),"utf8");

for(const required of [
  "Basket, ",
  "added to basket",
  "Clear your basket?",
  'id="bsBasketSubtotal"',
  'id="bsViewBasket"',
  'href="/basket.html"',
  "blackSheepBasketKeydown",
  "basketProductImageMarkup",
  "renderBlackSheepBasketPage",
]){
  assert.ok(site.includes(required),`site.js missing basket UI requirement: ${required}`);
}
assert.ok(site.includes("Add to basket"),"product buttons must use Add to basket");
assert.ok(!site.includes('header-list-label">My list'),"header must not expose My list");
for(const required of ["basket-page-grid","bs-list-bill","bs-list-pricing","bs-list-media"]){
  assert.ok(css.includes(required),`style.css missing ${required}`);
}
for(const required of ['id="basketPageItems"','id="basketPageSubtotal"','id="basketPageCount"','noindex,follow']){
  assert.ok(basket.includes(required),`basket.html missing ${required}`);
}
console.log("Basket UI static checks passed.");
