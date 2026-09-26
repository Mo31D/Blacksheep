import fs from "node:fs";
import path from "node:path";

const args=process.argv.slice(2);
const arg=(name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
const catalogPath=arg("--catalog");
const manifestPath=arg("--manifest");
const siteDirArg=arg("--site-dir");
const reportPath=arg("--report-out");

if(!catalogPath||!manifestPath||!siteDirArg){
  throw new Error("Missing --catalog, --manifest or --site-dir.");
}

const base="https://theblacksheepshop.co.uk";
const siteDir=path.resolve(process.cwd(),siteDirArg);

function read(p){return fs.readFileSync(p,"utf8")}
function parseCatalog(p){
  const raw=read(path.resolve(process.cwd(),p)).trim();
  return JSON.parse(raw.replace(/^window\.CATALOG=/,"").replace(/;$/,""));
}
function parseJsonLd(html){
  const blocks=[];
  for(const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{blocks.push(JSON.parse(match[1]))}
    catch(error){blocks.push({__invalid:String(error)})}
  }
  return blocks;
}
function graphNodes(blocks){
  return blocks.flatMap(data=>Array.isArray(data?.["@graph"])?data["@graph"]:[]);
}
function offerExpected(item){
  if(typeof item.price!=="number"||!Number.isFinite(item.price))return null;
  if(item.sellStatus==="NOT_FOR_SALE")return null;
  if(item.onlineOrderingEnabled===false)return null;
  let availability="https://schema.org/InStock";
  if(item.availabilityStatus==="arriving-soon")availability="https://schema.org/PreOrder";
  else if(item.stockStatus==="out-of-stock")availability="https://schema.org/OutOfStock";
  return{
    price:item.price.toFixed(2),
    priceCurrency:"GBP",
    availability,
    url:base+"/products/"+item.slug+".html",
  };
}
function expectedOrderable(item){
  if(item.availabilityStatus==="arriving-soon")return false;
  if(item.stockStatus==="out-of-stock")return false;
  if(item.sellStatus==="NOT_FOR_SALE")return false;
  if(typeof item.price!=="number"||!Number.isFinite(item.price))return false;
  if(item.onlineOrderingEnabled===false)return false;
  return true;
}
function canonicalOf(html){
  return html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]
    ||html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i)?.[1]
    ||null;
}
function productSchema(html){
  return graphNodes(parseJsonLd(html)).find(x=>x?.["@type"]==="Product")||null;
}
function itemList(html){
  return graphNodes(parseJsonLd(html)).find(x=>x?.["@type"]==="ItemList")||null;
}
function duplicates(values){
  const seen=new Set(),dup=new Set();
  for(const value of values){if(seen.has(value))dup.add(value);else seen.add(value)}
  return[...dup];
}

const catalog=parseCatalog(catalogPath);
const manifest=JSON.parse(read(path.resolve(process.cwd(),manifestPath)));
const rows=Object.entries(catalog).flatMap(([type,list])=>(list||[]).map(item=>({type,item})));
const byId=new Map(rows.map(row=>[row.item.id,row]));
const failures=[];

const idDup=duplicates(rows.map(x=>x.item.id));
const slugDup=duplicates(rows.map(x=>x.item.slug));
if(idDup.length)failures.push({scope:"catalog",problem:"duplicate_ids",values:idDup});
if(slugDup.length)failures.push({scope:"catalog",problem:"duplicate_slugs",values:slugDup});
if(manifest.products.length!==rows.length)failures.push({scope:"manifest",problem:"count",catalog:rows.length,manifest:manifest.products.length});

const manifestById=new Map(manifest.products.map(x=>[x.id,x]));
for(const {item} of rows){
  const manifestItem=manifestById.get(item.id);
  if(!manifestItem)failures.push({id:item.id,problem:"manifest_missing"});
  else if(manifestItem.slug!==item.slug)failures.push({id:item.id,problem:"manifest_slug",catalog:item.slug,manifest:manifestItem.slug});

  const file=path.join(siteDir,"products",item.slug+".html");
  if(!fs.existsSync(file)){
    failures.push({id:item.id,problem:"product_page_missing"});
    continue;
  }
  const html=read(file);
  const url=base+"/products/"+item.slug+".html";
  if(canonicalOf(html)!==url)failures.push({id:item.id,problem:"canonical",actual:canonicalOf(html),expected:url});
  if(!html.includes("<h1>"+String(item.name).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")+"</h1>")){
    failures.push({id:item.id,problem:"h1"});
  }
  if(!/name=["']robots["'][^>]*index,follow,max-image-preview:large/i.test(html)&&!/content=["']index,follow,max-image-preview:large["'][^>]*name=["']robots/i.test(html)){
    failures.push({id:item.id,problem:"robots"});
  }
  const schema=productSchema(html);
  if(!schema){
    failures.push({id:item.id,problem:"product_schema_missing"});
  }else{
    if(schema.name!==item.name)failures.push({id:item.id,problem:"schema_name",actual:schema.name,expected:item.name});
    if(schema.url!==url)failures.push({id:item.id,problem:"schema_url",actual:schema.url,expected:url});
    if((schema.sku??null)!==(item.sku??null))failures.push({id:item.id,problem:"schema_sku",actual:schema.sku??null,expected:item.sku??null});
    const expected=offerExpected(item);
    const actual=Array.isArray(schema.offers)?schema.offers[0]:schema.offers;
    if(!expected){
      if(actual!=null)failures.push({id:item.id,problem:"schema_offer_should_be_absent",actual});
    }else if(!actual){
      failures.push({id:item.id,problem:"schema_offer_missing"});
    }else{
      for(const key of ["price","priceCurrency","availability","url"]){
        if(String(actual[key]??"")!==String(expected[key]))failures.push({id:item.id,problem:"schema_offer_"+key,actual:actual[key],expected:expected[key]});
      }
    }
  }
  const button=html.match(/<button\b[^>]*\blist-detail-add\b[^>]*>/i)?.[0]||"";
  const disabled=/\sdisabled(?:\s|=|>)/i.test(button);
  if(disabled===expectedOrderable(item)){
    failures.push({id:item.id,problem:"product_button_state",disabled,expectedOrderable:expectedOrderable(item)});
  }
}

const sitemapPath=path.join(siteDir,"sitemap.xml");
if(!fs.existsSync(sitemapPath))failures.push({scope:"sitemap",problem:"missing"});
else{
  const sitemap=read(sitemapPath);
  const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  const productLocs=locs.filter(x=>x.includes("/products/"));
  const expectedLocs=rows.map(({item})=>base+"/products/"+item.slug+".html");
  if(productLocs.length!==expectedLocs.length)failures.push({scope:"sitemap",problem:"product_count",actual:productLocs.length,expected:expectedLocs.length});
  for(const loc of expectedLocs)if(!productLocs.includes(loc))failures.push({scope:"sitemap",problem:"missing_product",loc});
  for(const loc of productLocs)if(!expectedLocs.includes(loc))failures.push({scope:"sitemap",problem:"extra_product",loc});
}

const definitions=[
  {file:"gifts.html",select:()=>catalog.gifts||[]},
  {file:"gifts-peter-rabbit.html",select:()=>(catalog.gifts||[]).filter(x=>(x.categories||[]).includes("peter-rabbit"))},
  {file:"gifts-highland-cows.html",select:()=>(catalog.gifts||[]).filter(x=>(x.categories||[]).includes("highland-cows"))},
  {file:"gifts-mugs.html",select:()=>(catalog.gifts||[]).filter(x=>(x.categories||[]).includes("mugs"))},
  {file:"gifts-soft-toys.html",select:()=>(catalog.gifts||[]).filter(x=>(x.categories||[]).includes("soft-toys"))},
  {file:"gifts-cards.html",select:()=>(catalog.gifts||[]).filter(x=>(x.categories||[]).includes("cards"))},
  {file:"gifts-seasonal.html",select:()=>(catalog.gifts||[]).filter(x=>(x.categories||[]).includes("seasonal"))},
  {file:"gifts-keyrings-badges.html",select:()=>(catalog.gifts||[]).filter(x=>(x.categories||[]).includes("keyrings-badges"))},
  {file:"gifts-home-art.html",select:()=>(catalog.gifts||[]).filter(x=>(x.categories||[]).includes("home-gifts"))},
  {file:"gifts-toys-games.html",select:()=>(catalog.gifts||[]).filter(x=>(x.categories||[]).includes("toys-games"))},
  {file:"icecream.html",select:()=>catalog.icecream||[]},
  {file:"romneys.html",select:()=>catalog.romneys||[]},
  {file:"hawkshead-relish.html",select:()=>catalog.hawkshead||[]},
  {file:"all-products.html",select:()=>rows.map(x=>x.item)},
];

for(const def of definitions){
  const file=path.join(siteDir,def.file);
  if(!fs.existsSync(file)){
    failures.push({scope:def.file,problem:"collection_page_missing"});
    continue;
  }
  const html=read(file);
  const selected=def.select();
  const expectedCanonical=base+"/"+def.file;
  if(canonicalOf(html)!==expectedCanonical)failures.push({scope:def.file,problem:"canonical",actual:canonicalOf(html),expected:expectedCanonical});
  const cards=(html.match(/<article class="product-card\b/g)||[]).length;
  if(cards!==selected.length)failures.push({scope:def.file,problem:"card_count",actual:cards,expected:selected.length});
  const list=itemList(html);
  if(!list)failures.push({scope:def.file,problem:"itemlist_missing"});
  else{
    if(Number(list.numberOfItems)!==selected.length)failures.push({scope:def.file,problem:"itemlist_count",actual:list.numberOfItems,expected:selected.length});
    const urls=(list.itemListElement||[]).map(x=>x?.url).filter(Boolean);
    for(const item of selected){
      const url=base+"/products/"+item.slug+".html";
      if(!urls.includes(url))failures.push({scope:def.file,problem:"itemlist_missing_product",id:item.id});
      if(!html.includes('data-url="/products/'+item.slug+'.html"'))failures.push({scope:def.file,problem:"card_missing_product",id:item.id});
    }
  }
}

const generatedCatalogPath=path.join(siteDir,"assets","catalog.js");
if(!fs.existsSync(generatedCatalogPath))failures.push({scope:"assets/catalog.js",problem:"missing"});
else{
  const generated=parseCatalog(path.relative(process.cwd(),generatedCatalogPath));
  if(JSON.stringify(generated)!==JSON.stringify(catalog))failures.push({scope:"assets/catalog.js",problem:"candidate_drift"});
}

const report={
  ok:failures.length===0,
  products:rows.length,
  manifestProducts:manifest.products.length,
  collectionPages:definitions.length,
  failures,
};
if(reportPath)fs.writeFileSync(path.resolve(process.cwd(),reportPath),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
