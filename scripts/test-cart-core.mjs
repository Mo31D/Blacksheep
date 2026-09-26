import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,"..");
const sitePath=path.join(repoRoot,"assets","site.js");
const source=fs.readFileSync(sitePath,"utf8");

new vm.Script(source);

const startMarker="/* CART CORE FACTORY START */";
const endMarker="/* CART CORE FACTORY END */";
const start=source.indexOf(startMarker);
const end=source.indexOf(endMarker);
assert.ok(start>=0&&end>start,"cart core factory markers must exist");

const factorySource=source.slice(start,end+endMarker.length)+"\nglobalThis.__cartFactory=createBlackSheepCartCore;";
const context={};
vm.createContext(context);
new vm.Script(factorySource).runInContext(context);
const createCart=context.__cartFactory;
assert.equal(typeof createCart,"function");

class MemoryStorage{
  constructor(entries={}){this.map=new Map(Object.entries(entries))}
  getItem(key){return this.map.has(key)?this.map.get(key):null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}

const catalog=[
  {id:"A",type:"gifts",slug:"a",name:"A",price:10,img:"a.webp"},
  {id:"B",type:"gifts",slug:"b",name:"B",price:5,stockStatus:"out-of-stock"},
  {id:"C",type:"gifts",slug:"c",name:"C",price:7,availabilityStatus:"arriving-soon"},
  {id:"D",type:"gifts",slug:"d",name:"D"},
  {id:"E",type:"gifts",slug:"e",name:"E",price:8,commerceLive:true,commercePurchasable:true,commerceInventoryTracked:true,commerceAvailable:1},
  {id:"F",type:"gifts",slug:"f",name:"F",price:9,commerceLive:true,commercePurchasable:false,commerceUnavailableReason:"online_ordering_disabled"},
  {id:"G",type:"gifts",slug:"g",name:"G",price:11,sellStatus:"NOT_FOR_SALE"},
  {id:"H",type:"gifts",slug:"h",name:"H",price:12,onlineOrderingEnabled:false},
];
const resolve=(type,slug,productId)=>{
  if(productId){
    const byId=catalog.find(item=>item.id===productId);
    if(byId)return byId;
  }
  return catalog.find(item=>item.type===type&&item.slug===slug)||null;
};

{
  const storage=new MemoryStorage({
    "black-sheep-previsit-list-v1":JSON.stringify([
      {type:"gifts",slug:"a",quantity:2},
      {type:"gifts",slug:"missing",quantity:4},
      {type:"gifts",slug:"b",quantity:1}
    ])
  });
  const cart=createCart(storage,resolve);
  const items=cart.getItems();
  assert.equal(items.length,2);
  assert.equal(items.find(x=>x.slug==="a").quantity,2);
  assert.equal(storage.getItem("black-sheep-previsit-list-v1"),null);
}

{
  const storage=new MemoryStorage();
  const cart=createCart(storage,resolve);
  assert.equal(cart.add("gifts","a",2).ok,true);
  assert.equal(cart.count(),2);
  assert.equal(cart.subtotal(),20);
  assert.equal(cart.canCheckout(),true);
  assert.equal(cart.add("gifts","b",1).ok,false);
  assert.equal(cart.add("gifts","c",1).ok,false);
  assert.equal(cart.add("gifts","d",1).ok,false);
  assert.equal(cart.count(),2);
  cart.setQuantity("gifts","a",120);
  assert.equal(cart.count(),99);
  cart.change("gifts","a",-98);
  assert.equal(cart.count(),1);
  cart.change("gifts","a",-1);
  assert.equal(cart.count(),0);
}

{
  const storage=new MemoryStorage();
  const cart=createCart(storage,resolve);
  assert.equal(cart.add("gifts","e",1).ok,true);
  assert.equal(cart.count(),1);
  const second=cart.add("gifts","e",1);
  assert.equal(second.ok,false);
  assert.equal(second.reason,"out-of-stock");
  assert.equal(cart.count(),1);
  assert.equal(cart.setQuantity("gifts","e",2),false);
  assert.equal(cart.count(),1);
  assert.equal(cart.canCheckout(),true);
  catalog.find(x=>x.id==="E").commerceAvailable=0;
  assert.equal(cart.canCheckout(),false);
  assert.equal(cart.resolvedItems()[0].unavailableReason,"out-of-stock");
}

{
  const storage=new MemoryStorage();
  const cart=createCart(storage,resolve);
  const result=cart.add("gifts","f",1);
  assert.equal(result.ok,false);
  assert.equal(result.reason,"not-available-online");
  assert.equal(cart.count(),0);
}

{
  const storage=new MemoryStorage();
  const cart=createCart(storage,resolve);
  const notForSale=cart.add("gifts","g",1);
  assert.equal(notForSale.ok,false);
  assert.equal(notForSale.reason,"not-for-sale");
  const offline=cart.add("gifts","h",1);
  assert.equal(offline.ok,false);
  assert.equal(offline.reason,"not-available-online");
  assert.equal(cart.count(),0);
}

{
  const storage=new MemoryStorage({
    "black-sheep-cart-v1":JSON.stringify({
      version:1,
      items:[
        {productId:"A",type:"gifts",slug:"a",quantity:2},
        {productId:"B",type:"gifts",slug:"b",quantity:1}
      ]
    })
  });
  const cart=createCart(storage,resolve);
  const rows=cart.resolvedItems();
  assert.equal(rows.length,2);
  assert.equal(rows.find(x=>x.productId==="B").purchasable,false);
  assert.equal(cart.canCheckout(),false);
  assert.equal(cart.subtotal(),20);
}

{
  const storage=new MemoryStorage();
  const cart=createCart(storage,resolve);
  cart.add("gifts","a",1);
  assert.equal(cart.subtotal(),10);
  catalog.find(x=>x.id==="A").price=12.5;
  assert.equal(cart.subtotal(),12.5);
}

console.log("Cart core tests passed.");


const basketPath=path.join(repoRoot,"basket.html");
const basketHtml=fs.readFileSync(basketPath,"utf8");
assert.match(basketHtml,/id="basketPage"/);
assert.match(basketHtml,/id="basketPageItems"/);
assert.match(basketHtml,/id="basketPageSubtotal"/);
assert.match(basketHtml,/href="\/checkout\.html"/);
assert.match(basketHtml,/name="robots" content="noindex,follow"/);
assert.match(basketHtml,/data-checkout-ready="(?:true|false)"/);
console.log("Basket page contract checks passed.");


const checkoutPath=path.join(repoRoot,"checkout.html");
const checkoutHtml=fs.readFileSync(checkoutPath,"utf8");
assert.match(checkoutHtml,/id="checkoutPage"/);
assert.match(checkoutHtml,/id="checkoutForm"/);
assert.match(checkoutHtml,/name="fulfilmentMethod" value="delivery"/);
assert.match(checkoutHtml,/name="fulfilmentMethod" value="collection"/);
assert.match(checkoutHtml,/id="checkoutReviewStep"/);
assert.match(checkoutHtml,/id="checkoutTurnstile"/);
assert.match(checkoutHtml,/0x4AAAAAAFCyMDurtExV8uI0/);
assert.match(checkoutHtml,/data-order-submit-ready="(?:true|false)"/);
assert.match(checkoutHtml,/name="robots" content="noindex,follow"/);
console.log("Checkout page contract checks passed.");


const confirmationPath=path.join(repoRoot,"order-requested.html");
const confirmationHtml=fs.readFileSync(confirmationPath,"utf8");
assert.match(confirmationHtml,/id="orderRequestedPage"/);
assert.match(confirmationHtml,/id="orderRequestedReference"/);
assert.match(confirmationHtml,/No payment has been taken/);
assert.match(confirmationHtml,/name="robots" content="noindex,follow"/);
console.log("Order confirmation page contract checks passed.");

const liveCommercePath=path.join(repoRoot,"assets","commerce-live.js");
assert.ok(fs.existsSync(liveCommercePath),"Phase 6 live commerce overlay must exist");
const liveCommerceSource=fs.readFileSync(liveCommercePath,"utf8");
new vm.Script(liveCommerceSource);
assert.match(source,/PHASE 6 LIVE COMMERCE OVERLAY LOADER START/);
assert.match(source,/commerce-preview/);
assert.match(source,/black-sheep-commerce-api-staging/);
assert.match(source,/config\.liveCatalog===true/);
assert.match(source,/previewBlocked=window\.BLACK_SHEEP_LIVE_COMMERCE\?\.preview===true/);
assert.match(liveCommerceSource,/\/v1\/catalog/);
assert.match(liveCommerceSource,/\?limit=200/);
assert.match(liveCommerceSource,/catalog_pagination_guard/);
assert.match(liveCommerceSource,/cache:'no-store'/);
assert.match(liveCommerceSource,/commercePurchasable/);
assert.match(liveCommerceSource,/commerceAvailable/);
assert.match(liveCommerceSource,/commerceDynamic:true/);
assert.match(liveCommerceSource,/syncDynamicCatalogCards/);
assert.match(liveCommerceSource,/mediaUrl\(product\.primaryImageUrl\)/);
assert.match(source,/product\.html\?type=/);
assert.match(source,/function syncDynamicCatalogCards/);
assert.match(source,/function productImageSrc/);
assert.match(liveCommerceSource,/dataset\.commerceLive='fallback'/);
assert.match(liveCommerceSource,/Order submission is disabled in preview mode/);
assert.doesNotMatch(liveCommerceSource,/rel=["']canonical|history\.replaceState|location\.pathname\s*=/);

const dynamicProductPath=path.join(repoRoot,"product.html");
const dynamicProductHtml=fs.readFileSync(dynamicProductPath,"utf8");
assert.match(dynamicProductHtml,/id="detail"/);
assert.match(dynamicProductHtml,/black-sheep:commerce-live-ready/);
assert.match(dynamicProductHtml,/renderDetail\(\)/);
assert.match(dynamicProductHtml,/commerceDynamic/);
console.log("Phase 6 live commerce overlay contract checks passed.");

