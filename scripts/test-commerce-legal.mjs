import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const pages=["privacy.html","delivery-returns.html","terms.html"];
for(const page of pages){
  const html=fs.readFileSync(path.join(root,page),"utf8");
  assert.ok(html.includes("The Black Sheep Shop"),page+" missing business identity");
  assert.ok(html.includes("2 Lancaster House"),page+" missing business address");
  assert.ok(html.includes("07776 185647"),page+" missing business phone");
  assert.ok(html.includes("orders@theblacksheepshop.co.uk"),page+" missing order email");
  assert.ok(html.includes("assets/style.css"),page+" missing shared styles");
  assert.ok(html.includes("assets/site.js"),page+" missing shared scripts");
}
const privacy=fs.readFileSync(path.join(root,"privacy.html"),"utf8");
assert.ok(privacy.includes("local storage"),"privacy notice must disclose basket storage");
assert.ok(privacy.includes("Turnstile"),"privacy notice must disclose security verification");
assert.ok(privacy.includes("do not collect or store payment-card details"),"privacy notice must state card-data boundary");
const returns=fs.readFileSync(path.join(root,"delivery-returns.html"),"utf8");
assert.ok(returns.includes("within 14 days"),"returns page must state distance cancellation period");
assert.ok(returns.includes("further 14 days"),"returns page must state return period after cancellation");
assert.ok(returns.includes("Model cancellation form"),"returns page must include a cancellation form");
assert.ok(returns.includes("no later than 14 days"),"returns page must state refund timing");
const terms=fs.readFileSync(path.join(root,"terms.html"),"utf8");
assert.ok(terms.includes("does not take payment"),"terms must explain request-first model");
assert.ok(terms.includes("A contract is formed when payment is successfully received"),"terms must define order acceptance point");
const checkout=fs.readFileSync(path.join(root,"checkout.html"),"utf8");
for(const href of ["/privacy.html","/delivery-returns.html","/terms.html"]){
  assert.ok(checkout.includes(href),"checkout missing legal link "+href);
}
const site=fs.readFileSync(path.join(root,"assets","site.js"),"utf8");
assert.ok(site.includes("footer-legal"),"site must inject legal links into shared footer");
console.log("Commerce legal/customer-information checks passed.");
