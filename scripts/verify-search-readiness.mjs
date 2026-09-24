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
const duplicateValues=(values)=>[...new Set(values.filter(Boolean).filter((x,i,a)=>a.indexOf(x)!==i))];
for(const [label,values] of [
  ['IDs',rows.map(x=>x.item.id)],
  ['slugs',rows.map(x=>x.item.slug)],
  ['SKUs',rows.map(x=>x.item.sku).filter(Boolean)]
]){
  const dup=duplicateValues(values);
  if(dup.length) fail.push('Duplicate catalogue '+label+': '+dup.join(', '));
}

const active=['index.html','gifts.html','gifts-peter-rabbit.html','gifts-highland-cows.html','gifts-mugs.html','gifts-soft-toys.html','gifts-cards.html','gifts-seasonal.html','gifts-keyrings-badges.html','gifts-home-art.html','gifts-toys-games.html','icecream.html','romneys.html','hawkshead-relish.html','all-products.html','about.html','visit.html'];
for(const p of active){
  if(!exists(p)){fail.push('Missing active page: '+p);continue}
  const h=read(p);
  if(!/rel=["']canonical["']/i.test(h)) fail.push('Missing canonical: '+p);
  if(!/name=["']robots["'][^>]*index,follow,max-image-preview:large/i.test(h)&&!/content=["']index,follow,max-image-preview:large["'][^>]*name=["']robots/i.test(h)) fail.push('Missing index robots policy: '+p);
  if(!/"@graph"/.test(h)||!/"@type":"WebSite"/.test(h)||!/"@type":"Store"/.test(h)) fail.push('Incomplete entity graph: '+p);
  const head=(h.match(/<head[\s\S]*?<\/head>/i)||[''])[0];
  const ogImages=head.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/gi)||[];
  const twitterCards=head.match(/<meta\b[^>]*name=["']twitter:card["'][^>]*>/gi)||[];
  if(ogImages.length!==1) fail.push('Expected exactly one og:image meta tag: '+p);
  if(ogImages[0]&&!ogImages[0].includes(base+'/images/1.png')) fail.push('og:image is not the production absolute URL: '+p);
  if(twitterCards.length!==1) fail.push('Expected exactly one twitter:card meta tag: '+p);
  if(/>\s*property=["']og:image["']\s+content=/i.test(head)) fail.push('Malformed visible og:image fragment: '+p);
  const jsonLd=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if(!jsonLd.length) fail.push('Missing JSON-LD: '+p);
  for(const block of jsonLd){try{JSON.parse(block[1])}catch(e){fail.push('Invalid JSON-LD in '+p+': '+e.message)}}
}

const giftsPage=read('gifts.html');
if(/id=["']search["']/i.test(giftsPage)) fail.push('Gifts page must use category filters, not duplicate search UI');
if(/giftSectionSelect/i.test(giftsPage)) fail.push('Obsolete Gifts section selector remains');
const romneysPage=read('romneys.html');
if(/id=["']search["']/i.test(romneysPage)) fail.push("Romney's page must use category filters, not search UI");
for(const filter of ['biscuits','fudge','mint-cake','sweets','gift-boxes']) if(!romneysPage.includes('data-filter="'+filter+'"')) fail.push("Missing Romney filter: "+filter);
if(rows.some(x=>x.item.slug==='rom-002-dubai-chocolate')) fail.push('Dubai Chocolate must not be in the active catalogue');

const sitemap=read('sitemap.xml');
if(/product\.html\?/i.test(sitemap)) fail.push('Legacy query product URLs remain in sitemap');
if((sitemap.match(/<url>/g)||[]).length!==active.length+rows.length) fail.push('Unexpected sitemap URL count');
const robots=read('robots.txt');
if(!robots.includes('Sitemap: '+base+'/sitemap.xml')) fail.push('robots.txt does not point at production sitemap');

const officialRomneys=(catalog.romneys||[]).filter(x=>x.official?.url);
const romneysSourceMap=exists('docs/ROMNEYS-SOURCE-MAP.md')?read('docs/ROMNEYS-SOURCE-MAP.md'):'';
if(!romneysSourceMap) fail.push('Missing docs/ROMNEYS-SOURCE-MAP.md');
for(const item of officialRomneys){
  if(!/^https:\/\//.test(item.official.url||'')) fail.push('Invalid official source URL for '+item.id);
  if(!item.official.name) fail.push('Missing official product name for '+item.id);
  if(!item.official.manufacturer) fail.push('Missing official manufacturer for '+item.id);
  if(romneysSourceMap&&!romneysSourceMap.includes(item.official.url)) fail.push('Romney source map missing '+item.id);
}
const hawksheadSourceMap=exists('docs/HAWKSHEAD-RELISH-SOURCE-MAP.md')?read('docs/HAWKSHEAD-RELISH-SOURCE-MAP.md'):'';
if(!hawksheadSourceMap) fail.push('Missing docs/HAWKSHEAD-RELISH-SOURCE-MAP.md');
for(const item of (catalog.hawkshead||[])){
  if(!item.official?.url || !/^https:\/\/www\.hawksheadrelish\.com\//.test(item.official.url)) fail.push('Missing/invalid Hawkshead official source for '+item.id);
  if(item.official?.url && hawksheadSourceMap && !hawksheadSourceMap.includes(item.official.url)) fail.push('Hawkshead source map missing '+item.id);
  if(typeof item.price==='number' && item.priceSource!=='owner-confirmed-2026-09-24') fail.push('Hawkshead price missing owner-confirmed source: '+item.id);
}

const romneyImageSources=new Map();
for(const item of (catalog.romneys||[])){
  const u=item.official?.imageUrl;
  if(!u) continue;
  if(romneyImageSources.has(u)) fail.push('Duplicate Romney official image provenance: '+romneyImageSources.get(u)+' and '+item.id);
  else romneyImageSources.set(u,item.id);
}

for(const {type,item} of rows){
  const p='products/'+item.slug+'.html';
  if(!exists(p)){fail.push('Missing static product page: '+p);continue}
  const h=read(p),canonical=base+'/'+p;
  if(!h.includes('<link rel="canonical" href="'+canonical+'">')) fail.push('Wrong canonical: '+p);
  if(!h.includes('<h1>'+esc(item.name)+'</h1>')) fail.push('Missing static H1: '+p);
  if(!h.includes('"@type":"Product"')||!h.includes('"@type":"BreadcrumbList"')) fail.push('Missing product/breadcrumb schema: '+p);
  if(!h.includes('name="robots" content="index,follow,max-image-preview:large"')) fail.push('Missing product robots policy: '+p);
  if(!sitemap.includes('<loc>'+canonical+'</loc>')) fail.push('Product absent from sitemap: '+p);
  if(!h.includes('../images/'+item.img)) fail.push('Primary image absent from static HTML: '+p);
  if(!exists('images/'+item.img)) fail.push('Missing primary image file: images/'+item.img);
  const detailTags=h.match(/<details\b[^>]*>/gi)||[];
  const closedDetails=detailTags.filter(tag=>!/\sopen(?:\s|=|>)/i.test(tag));
  if(closedDetails.length) fail.push('Product details must be open by default: '+p+' ('+closedDetails.length+' closed)');
  for(const image of (item.gallery||[])) if(!exists('images/'+image.src)) fail.push('Missing gallery image file: images/'+image.src);
  const productJson=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for(const block of productJson){try{JSON.parse(block[1])}catch(e){fail.push('Invalid product JSON-LD in '+p+': '+e.message)}}
  if((h.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/gi)||[]).length!==1) fail.push('Product must have exactly one og:image meta tag: '+p);
  if((h.match(/<meta\b[^>]*name=["']twitter:card["'][^>]*>/gi)||[]).length!==1) fail.push('Product must have exactly one twitter:card meta tag: '+p);
  if(type==='romneys'){
    const supplier=/mintcake\.co\.uk|walkers-nonsuch\.co\.uk|elit-chocolate\.com/i;
    if(/Manufacturer source|Buy from manufacturer/i.test(h)) fail.push('Public manufacturer-source UI leaked into '+p);
    if(supplier.test(h)) fail.push('Public supplier URL leaked into '+p);
    let parsed=null;
    try{parsed=JSON.parse(productJson[0]?.[1]||'null')}catch{}
    const productNode=parsed?.['@graph']?.find(x=>x['@type']==='Product');
    if(!productNode) fail.push('Product schema missing in '+p);
    if(productNode?.sameAs?.some?.(x=>supplier.test(String(x)))) fail.push('Supplier sameAs leaked into Product schema: '+p);
    if(productNode?.brand?.name!==(item.brand||"Romney's of Kendal")) fail.push('Product schema brand mismatch: '+p);
    if(item.official?.manufacturer && productNode?.manufacturer?.name!==item.official.manufacturer) fail.push('Product schema manufacturer mismatch: '+p);
  }
  if(type==='hawkshead'){
    if(/hawksheadrelish\.com\/shop\//i.test(h)) fail.push('Public Hawkshead supplier URL leaked into '+p);
    let parsed=null; try{parsed=JSON.parse(productJson[0]?.[1]||'null')}catch{}
    const productNode=parsed?.['@graph']?.find(x=>x['@type']==='Product');
    if(productNode?.brand?.name!==(item.brand||'Hawkshead Relish Company')) fail.push('Hawkshead Product schema brand mismatch: '+p);
    if(item.official?.manufacturer && productNode?.manufacturer?.name!==item.official.manufacturer) fail.push('Hawkshead Product schema manufacturer mismatch: '+p);
    const exactImage=/^HR-(?:00[1-7]|009|01[0-6])$/.test(item.id||'');
    if(exactImage){
      if(!String(item.img||'').startsWith('hawkshead-relish/')) fail.push('Hawkshead exact product image not wired: '+item.id);
      if(!h.includes('<meta property="og:image" content="'+base+'/images/'+item.img+'">')) fail.push('Hawkshead og:image mismatch: '+p);
      if(!productNode?.image?.includes?.(base+'/images/'+item.img)) fail.push('Hawkshead Product image schema mismatch: '+p);
      if(!read('hawkshead-relish.html').includes('src="images/'+item.img+'"')) fail.push('Hawkshead collection image mismatch: '+item.id);
      if(!read('all-products.html').includes('src="images/'+item.img+'"')) fail.push('Full range Hawkshead image mismatch: '+item.id);
    }
    if(item.stockStatus==='out-of-stock'){
      if(!h.includes('Out of stock')) fail.push('Hawkshead out-of-stock label missing: '+p);
      if(typeof item.price!=='number') fail.push('Hawkshead out-of-stock item missing price: '+item.id);
    }
    if(item.id==='HR-001'){
      if((item.gallery||[]).length!==2) fail.push('Hawkshead two-image gallery count mismatch: '+item.id);
      for(const g of (item.gallery||[])){
        if(!exists('images/'+g.src)) fail.push('Missing Hawkshead gallery image: images/'+g.src);
        if(!h.includes('../images/'+g.src)) fail.push('Hawkshead gallery image absent from page: '+g.src);
        if(!productNode?.image?.includes?.(base+'/images/'+g.src)) fail.push('Hawkshead gallery schema mismatch: '+g.src);
      }
      if(!h.includes('detail-gallery-track')) fail.push('Hawkshead gallery markup missing: '+p);
    }
  }
}

const expectedRawLinks={
 'gifts.html':catalog.gifts.length,
 'gifts-peter-rabbit.html':catalog.gifts.filter(x=>(x.categories||[]).includes('peter-rabbit')).length,
 'gifts-highland-cows.html':catalog.gifts.filter(x=>(x.categories||[]).includes('highland-cows')).length,
 'gifts-mugs.html':catalog.gifts.filter(x=>(x.categories||[]).includes('mugs')).length,
 'gifts-soft-toys.html':catalog.gifts.filter(x=>(x.categories||[]).includes('soft-toys')).length,
 'gifts-cards.html':catalog.gifts.filter(x=>(x.categories||[]).includes('cards')).length,
 'gifts-seasonal.html':catalog.gifts.filter(x=>(x.categories||[]).includes('seasonal')).length,
 'gifts-keyrings-badges.html':catalog.gifts.filter(x=>(x.categories||[]).includes('keyrings-badges')).length,
 'gifts-home-art.html':catalog.gifts.filter(x=>(x.categories||[]).includes('home-gifts')).length,
 'gifts-toys-games.html':catalog.gifts.filter(x=>(x.categories||[]).includes('toys-games')).length,
 'icecream.html':catalog.icecream.length,
 'romneys.html':catalog.romneys.length,
 'hawkshead-relish.html':catalog.hawkshead.length,
 'all-products.html':rows.length
};
const compactGiftGridPages=['gifts.html','gifts-peter-rabbit.html','gifts-highland-cows.html','gifts-mugs.html','gifts-soft-toys.html','gifts-cards.html','gifts-seasonal.html','gifts-keyrings-badges.html','gifts-home-art.html','gifts-toys-games.html'];
for(const p of compactGiftGridPages){const h=read(p);if(!h.includes('class="catalog shopping-catalog gift-grid"')) fail.push('Gift catalogue compact grid missing: '+p);if(!h.includes('class="catalog-body')) fail.push('Gift catalogue mobile body class missing: '+p);}

for(const [p,n] of Object.entries(expectedRawLinks)){
  const h=read(p);
  const got=(h.match(/href=["']\/products\//g)||[]).length;
  if(got<n) fail.push('Too few raw product links in '+p+': '+got+' < '+n);
  if(!h.includes('"@type":"ItemList"')) fail.push('Missing ItemList graph: '+p);
  if(p==='romneys.html' && (h.match(/<article class="product-card\b[^"]*"/g)||[]).length!==catalog.romneys.length) fail.push('Romney card count drift');
  if(p==='hawkshead-relish.html' && (h.match(/<article class="product-card\b[^"]*"/g)||[]).length!==catalog.hawkshead.length) fail.push('Hawkshead card count drift');
  if((p==='romneys.html'||p==='hawkshead-relish.html'||p==='all-products.html') && !h.includes('shopping-catalog')) fail.push('Product-first shopping grid missing: '+p);
  if((p==='romneys.html'||p==='hawkshead-relish.html'||p==='all-products.html') && /View →|Choose a type|Filter the range by product type\.|The full curated range\.|Everything we currently show online\./.test(h)) fail.push('Legacy catalogue friction copy/action returned: '+p);
  if((p==='romneys.html'||p==='hawkshead-relish.html'||p==='all-products.html') && !h.includes('class="catalog-intro"')) fail.push('Compact catalogue intro missing: '+p);
  if(p==='all-products.html' && (h.match(/<article class="product-card\b[^"]*"/g)||[]).length!==rows.length) fail.push('Full-range card count drift');
}

const legacy=read('product.html');
if(!/noindex,follow/.test(legacy)||!legacy.includes("location.replace('/products/'")) fail.push('Legacy product route is not safely retired');
for(const p of ['gifts-lake-district.html','lakeland-fragrances.html','gifts-local-food.html','gifts-maps-books-jigsaws.html','gifts-souvenirs.html','gifts-fridge-magnets.html']){
  if(!exists(p)){fail.push('Missing retired route shell: '+p);continue}
  const h=read(p);
  if(!/noindex,follow/.test(h)) fail.push('Retired route is indexable: '+p);
  if(!/rel=["']canonical["']/i.test(h)) fail.push('Retired route missing canonical: '+p);
}
if(!/noindex,follow/.test(read('404.html'))) fail.push('404 page must be noindex,follow');

if(fail.length){
  console.error('Search-readiness verification failed:');
  for(const x of fail) console.error('- '+x);
  process.exit(1);
}
console.log('Search-readiness verification passed:',{products:rows.length,activePages:active.length,sitemapUrls:active.length+rows.length});
