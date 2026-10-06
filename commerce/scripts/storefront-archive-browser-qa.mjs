import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

// Exercise the checked-out candidate, before deployment, with no database writes.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/catalog.js'),'utf8'),context);
const products=Object.entries(context.window.CATALOG).flatMap(([type,items])=>items.map(item=>({
  id:item.id,productId:item.id,slug:item.slug,name:item.name,type,
  priceMinor:250,purchasable:true,status:'available',publishedVersionId:'qa-published',
  categories:item.categories||[],inventory:{tracked:false,available:null},
})));
const archived=products.find(p=>p.id==='HC-003');
assert(archived,'Original design fixture missing');
const newProduct={...archived,id:'new-qa-product',productId:'new-qa-product',slug:'new-qa-product',name:'New QA Product'};
const lakeProduct={...newProduct,id:'lake-qa-product',productId:'lake-qa-product',slug:'lake-qa-product',name:'Lake QA Product',storefrontNodeIds:['lake-child']};
const promotedProduct={...newProduct,id:'promoted-qa-product',productId:'promoted-qa-product',slug:'promoted-qa-product',name:'Promoted QA Product',storefrontNodeIds:['promoted']};
const iceProduct={...newProduct,id:'ice-qa-product',productId:'ice-qa-product',slug:'ice-qa-product',name:'Ice Cream QA Product',type:'icecream',storefrontNodeIds:['icecream']};
const hierarchyNodes=parentNodeId=>[
  {id:'lake',name:'Lake District Souvenirs',slug:'lake',legacyPath:'/gifts.html',parentNodeId:null,sortOrder:10,showInNavigation:true},
  {id:'lake-child',name:'Local Gifts',slug:'local-gifts',legacyPath:'/gifts-mugs.html',parentNodeId:'lake',sortOrder:10,showInNavigation:true},
  {id:'promoted',name:'Promoted Collection',slug:'promoted',legacyPath:'/gifts-highland-cows.html',parentNodeId,sortOrder:20,showInNavigation:true},
  {id:'icecream',name:'Ice Cream',slug:'ice-cream',legacyPath:'/icecream.html',parentNodeId:null,sortOrder:30,showInNavigation:true},
];
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!target.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(target,(error,data)=>{
    if(error){response.writeHead(404).end();return;}
    const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(target)]||'application/octet-stream';
    response.writeHead(200,{'content-type':type});response.end(data);
  });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
try{
  for(const [name,browserType] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await browserType.launch();
    try{
      const page=await browser.newPage({viewport:{width:820,height:1180}});
      let mode='published';
      await page.route('https://api.theblacksheepshop.co.uk/**',async route=>{
        const url=new URL(route.request().url());
        if(url.pathname==='/media/section-image'){await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>'});return;}
        if(url.pathname==='/v1/storefront-structure'&&mode.startsWith('hierarchy-')){await route.fulfill({contentType:'application/json',body:JSON.stringify({nodes:hierarchyNodes(mode==='hierarchy-before'?'lake':null)})});return;}
        if(url.pathname!=='/v1/catalog'){await route.fulfill({status:503,body:'{}'});return;}
        if(mode==='failure'){await route.fulfill({status:503,body:'{}'});return;}
        const rows=mode==='empty'?[]:mode.startsWith('hierarchy-')?[lakeProduct,promotedProduct,iceProduct]:products.filter(p=>p.id!==archived.id);
        if(mode==='published')rows.push(newProduct);
        await route.fulfill({contentType:'application/json',body:JSON.stringify({products:rows,nextCursor:null})});
      });
      const open=async pathname=>{
        await page.goto(base+pathname);
        await page.waitForFunction(()=>['ready','fallback'].includes(document.documentElement.dataset.commerceLive));
      };
      await open('/all-products.html');
      assert.equal(await page.locator('[data-product-slug="'+archived.slug+'"]').count(),0);
      assert.equal(await page.locator('[data-product-slug="new-qa-product"]').count(),1);
      assert.equal(await page.locator('.product-card[data-url="/products/'+archived.slug+'.html"]').count(),0);
      await open('/products/'+archived.slug+'.html');
      assert.equal(await page.getByRole('heading',{name:'Product no longer available'}).count(),1);
      assert.equal(await page.locator('.product-static .list-add,.product-static .list-detail-add').count(),0);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
      mode='empty';
      await open('/all-products.html');
      assert.equal(await page.locator('.product-card').count(),0);
      mode='failure';
      await open('/all-products.html');
      assert.equal(await page.locator('.product-card[data-url="/products/'+archived.slug+'.html"]').count(),1);
      await open('/gifts.html');
      assert.equal(await page.locator('#catalog .product-card').count(),0,'Legacy Gifts must not publish stale Product membership when the API is unavailable');
      assert.equal(await page.locator('.gift-shortcuts [data-filter]').count(),0,'Legacy Gifts must not publish stale child filters');
      assert.equal(await page.locator('#catalog a[href="/all-products.html"]').count(),1,'Gifts retains a general fallback destination');
      mode='no-structure';
      await open('/gifts.html');
      assert.equal(await page.locator('#catalog .product-card').count(),0,'A catalogue response without published Structure cannot infer Gifts membership from legacy taxonomy');
      assert.equal(await page.locator('#catalog a[href="/all-products.html"]').count(),1);
      await open('/gifts-highland-cows.html');
      assert.equal(await page.locator('#catalog .product-card').count(),0,'A promoted Section page must not infer Product membership without published Structure');
      assert.equal(await page.locator('#catalog a[href="/all-products.html"]').count(),1);
      await open('/gifts-mugs.html');
      assert.equal(await page.locator('#catalog .product-card').count(),0,'A legacy child Section page must not infer Product membership without published Structure');
      await open('/icecream.html');
      assert.equal(await page.locator('#catalog .product-card').count(),0,'Ice Cream must not infer Product membership without published Structure');
      assert.equal(await page.locator('#catalog a[href="/all-products.html"]').count(),1);
      mode='hierarchy-before';
      await open('/gifts.html');
      assert.equal(await page.locator('#catalog [data-product-slug="lake-qa-product"]').count(),1);
      assert.equal(await page.locator('#catalog [data-product-slug="promoted-qa-product"]').count(),1);
      await open('/gifts-mugs.html');
      assert.equal(await page.locator('#catalog [data-product-slug="lake-qa-product"]').count(),1,'Legacy child URL uses its published placement');
      assert.equal(await page.locator('#catalog [data-product-slug="promoted-qa-product"]').count(),0);
      await open('/icecream.html');
      assert.equal(await page.locator('#catalog [data-product-slug="ice-qa-product"]').count(),1,'Ice Cream URL uses its published placement');
      assert.equal(await page.locator('#catalog [data-product-slug="lake-qa-product"]').count(),0);
      mode='hierarchy-after';
      await open('/gifts.html');
      assert.equal(await page.locator('.gift-shortcuts [data-storefront-node="promoted"]').count(),0,'Promoted Section leaves its former parent shortcut');
      assert.equal(await page.locator('#catalog [data-product-slug="lake-qa-product"]').count(),1);
      assert.equal(await page.locator('#catalog [data-product-slug="promoted-qa-product"]').count(),0,'Published placement outside the current subtree must not reappear through static Gifts taxonomy');
      await open('/gifts-highland-cows.html');
      assert.equal(await page.locator('#catalog [data-product-slug="promoted-qa-product"]').count(),1,'Promoted Section shows its own placed Product');
      assert.equal(await page.locator('#catalog [data-product-slug="lake-qa-product"]').count(),0,'Former parent Product does not leak into the promoted Section');
      mode='published';
      await open('/index.html');
      await page.evaluate(()=>syncHomepageDestinationCards({
        COLLECTIONS:[{name:'Highland Cows',shortDescription:'New collection copy',imageUrl:'/media/section-image',destinationPath:'/gifts-highland-cows.html'}],
        LOCAL_FAVOURITES:[{name:"Romney's",shortDescription:'Local treats',imageUrl:null,destinationPath:'/romneys.html'}],
      }));
      assert.equal(await page.locator('#homeCollections .collection').count(),1);
      assert.equal(await page.locator('#homeCollections .collection h3').textContent(),'Highland Cows');
      assert.equal(await page.locator('#homeCollections .collection img').getAttribute('src'),'https://api.theblacksheepshop.co.uk/media/section-image');
      assert.equal(await page.locator('.home-discover-grid .feature').count(),1);
      assert.equal(await page.locator('.home-discover-grid .feature h3').textContent(),"Romney's");
      assert.equal(await page.locator('.home-discover-grid .feature img').count(),1);
      console.log(name+': archived catalogue, child-to-root hierarchy and Homepage destination cards passed');
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
