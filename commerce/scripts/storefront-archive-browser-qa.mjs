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
        if(url.pathname!=='/v1/catalog'){await route.fulfill({status:503,body:'{}'});return;}
        if(mode==='failure'){await route.fulfill({status:503,body:'{}'});return;}
        const rows=mode==='empty'?[]:products.filter(p=>p.id!==archived.id);
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
      console.log(name+': archived legacy cards, new cards, old detail, empty catalogue and outage fallback passed');
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
