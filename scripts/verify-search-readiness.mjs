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

const sitemap=read('sitemap.xml');
if(/product\.html\?/i.test(sitemap)) fail.push('Legacy query product URLs remain in sitemap');
if((sitemap.match(/<url>/g)||[]).length!==active.length+rows.length) fail.push('Unexpected sitemap URL count');
const robots=read('robots.txt');
if(!robots.includes('Sitemap: '+base+'/sitemap.xml')) fail.push('robots.txt does not point at production sitemap');

const officialRomneys=(catalog.romneys||[]).filter(x=>x.official);
if(officialRomneys.length!==35) fail.push('Expected 35 verified Romney official-source matches, found '+officialRomneys.length);
const romneysSourceMap=exists('docs/ROMNEYS-SOURCE-MAP.md')?read('docs/ROMNEYS-SOURCE-MAP.md'):'';
if(!romneysSourceMap) fail.push('Missing docs/ROMNEYS-SOURCE-MAP.md');
for(const item of officialRomneys){
  if(!/^https:\/\//.test(item.official.url||'')) fail.push('Invalid official source URL for '+item.id);
  if(!item.official.name) fail.push('Missing official product name for '+item.id);
  if(!item.official.manufacturer) fail.push('Missing official manufacturer for '+item.id);
  if(romneysSourceMap&&!romneysSourceMap.includes(item.official.url)) fail.push('Romney source map missing '+item.id);
}

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
  if(!exists('images/'+item.img)) fail.push('Missing primary image file: images/'+item.img);
  for(const image of (item.gallery||[])) if(!exists('images/'+image.src)) fail.push('Missing gallery image file: images/'+image.src);
  const productJson=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for(const block of productJson){try{JSON.parse(block[1])}catch(e){fail.push('Invalid product JSON-LD in '+p+': '+e.message)}}
  if((h.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/gi)||[]).length!==1) fail.push('Product must have exactly one og:image meta tag: '+p);
  if((h.match(/<meta\b[^>]*name=["']twitter:card["'][^>]*>/gi)||[]).length!==1) fail.push('Product must have exactly one twitter:card meta tag: '+p);
  if(item.official){
    if(!h.includes(item.official.url)) fail.push('Official source missing from static product page: '+p);
    if(!h.includes(esc(item.official.name))&&!h.includes(item.official.name)) fail.push('Official product name missing from static product page: '+p);
    let parsed=null;
    try{parsed=JSON.parse([...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)][0]?.[1]||'null')}catch{}
    const productNode=parsed?.['@graph']?.find(x=>x['@type']==='Product');
    if(!productNode?.sameAs?.includes(item.official.url)) fail.push('Product schema sameAs missing official source: '+p);
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
