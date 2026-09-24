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
console.log("Basket page contract checks passed.");


const checkoutPath=path.join(repoRoot,"checkout.html");
const checkoutHtml=fs.readFileSync(checkoutPath,"utf8");
assert.match(checkoutHtml,/id="checkoutPage"/);
assert.match(checkoutHtml,/id="checkoutForm"/);
assert.match(checkoutHtml,/name="fulfilmentMethod" value="delivery"/);
assert.match(checkoutHtml,/name="fulfilmentMethod" value="collection"/);
assert.match(checkoutHtml,/id="checkoutReviewStep"/);
assert.match(checkoutHtml,/id="checkoutTurnstile"/);
assert.match(checkoutHtml,/0x4AAAAAAFChkRt-LzNQw9bK/);
assert.match(checkoutHtml,/data-order-submit-ready="false"/);
assert.match(checkoutHtml,/name="robots" content="noindex,follow"/);
console.log("Checkout page contract checks passed.");
