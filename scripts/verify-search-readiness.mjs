import fs from 'node:fs';

const base='https://theblacksheepshop.co.uk';
const fail=[];
const read=p=>fs.readFileSync(p,'utf8');
const exists=p=>fs.existsSync(p);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const catalogSource=read('assets/catalog.js');
const raw=catalogSource.slice(catalogSource.indexOf('window.CATALOG=')+'window.CATALOG='.length,catalogSource.lastIndexOf(';')).trim();
const catalog=JSON.parse(raw);
const rows=[];
for(const [type,items] of Object.entries(catalog)) for(const item of items) rows.push({type,item});

const active=['index.html','gifts.html','gifts-peter-rabbit.html','gifts-highland-cows.html','gifts-mugs.html','gifts-soft-toys.html','gifts-cards.html','gifts-seasonal.html','gifts-keyrings-badges.html','gifts-home-art.html','gifts-toys-games.html','icecream.html','romneys.html','hawkshead-relish.html','all-products.html','about.html','visit.html'];
for(const p of active){
  if(!exists(p)){fail.push('Missing active page: '+p);continue}
  const h=read(p);
  if(!/rel=["']canonical["']/i.test(h)) fail.push('Missing canonical: '+p);
  if(!/name=["']robots["'][^>]*index,follow,max-image-preview:large/i.test(h)&&!/content=["']index,follow,max-image-preview:large["'][^>]*name=["']robots/i.test(h)) fail.push('Missing index robots policy: '+p);
  if(!/"@graph"/.test(h)||!/"@type":"WebSite"/.test(h)||!/"@type":"Store"/.test(h)) fail.push('Incomplete entity graph: '+p);
}

const sitemap=read('sitemap.xml');
if(/product\.html\?/i.test(sitemap)) fail.push('Legacy query product URLs remain in sitemap');
if((sitemap.match(/<url>/g)||[]).length!==active.length+rows.length) fail.push('Unexpected sitemap URL count');
const robots=read('robots.txt');
if(!robots.includes('Sitemap: '+base+'/sitemap.xml')) fail.push('robots.txt does not point at production sitemap');

for(const {item} of rows){
  const p='products/'+item.slug+'.html';
  if(!exists(p)){fail.push('Missing static product page: '+p);continue}
  const h=read(p),canonical=base+'/'+p;
  if(!h.includes('<link rel="canonical" href="'+canonical+'">')) fail.push('Wrong canonical: '+p);
  if(!h.includes('<h1>'+esc(item.name)+'</h1>')) fail.push('Missing static H1: '+p);
  if(!h.includes('"@type":"Product"')||!h.includes('"@type":"BreadcrumbList"')) fail.push('Missing product/breadcrumb schema: '+p);
  if(!h.includes('name="robots" content="index,follow,max-image-preview:large"')) fail.push('Missing product robots policy: '+p);
  if(!sitemap.includes('<loc>'+canonical+'</loc>')) fail.push('Product absent from sitemap: '+p);
  if(!h.includes('../images/'+item.img)) fail.push('Primary image absent from static HTML: '+p);
}

const expectedRawLinks={
 'gifts.html':catalog.gifts.length,
 'gifts-peter-rabbit.html':catalog.gifts.filter(x=>(x.categories||[]).includes('peter-rabbit')).length,
 'gifts-highland-cows.html':catalog.gifts.filter(x=>(x.categories||[]).includes('highland-cows')).length,
 'icecream.html':catalog.icecream.length,
 'romneys.html':catalog.romneys.length,
 'all-products.html':rows.length
};
for(const [p,n] of Object.entries(expectedRawLinks)){
  const h=read(p);
  const got=(h.match(/href=["']\/products\//g)||[]).length;
  if(got<n) fail.push('Too few raw product links in '+p+': '+got+' < '+n);
  if(!h.includes('"@type":"ItemList"')) fail.push('Missing ItemList graph: '+p);
}

const legacy=read('product.html');
if(!/noindex,follow/.test(legacy)||!legacy.includes("location.replace('/products/'")) fail.push('Legacy product route is not safely retired');

if(fail.length){
  console.error('Search-readiness verification failed:');
  for(const x of fail) console.error('- '+x);
  process.exit(1);
}
console.log('Search-readiness verification passed:',{products:rows.length,activePages:active.length,sitemapUrls:active.length+rows.length});
