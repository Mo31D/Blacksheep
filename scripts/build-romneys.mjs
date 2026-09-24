import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const base = 'https://theblacksheepshop.co.uk';
const catalog = JSON.parse(read('assets/catalog.js').split('window.CATALOG=')[1].trim().replace(/;$/, ''));
const items = catalog.romneys || [];
const typed = [];
for (const [type, list] of Object.entries(catalog)) for (const item of list) typed.push({ type, item });
const all = typed.map(x => x.item);
const outputs = new Map();
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const xmlEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const money = n => '£' + Number(n).toFixed(2);
const getSku = i => i.sku || i.official?.sku || null;
const getPack = i => i.official?.pack || (/\b\d+\s?(?:g|kg|ml|l)\b/i.exec(i.name)?.[0] ?? null);
const supplierRe = /(?:https?:\/\/)?(?:www\.)?(?:mintcake\.co\.uk|walkers-nonsuch\.co\.uk|elit-chocolate\.com)(?:\/[^\\s<]*)?/ig;
const publicText = v => String(v ?? '').replace(supplierRe, '').replace(/\\s{2,}/g, ' ').trim();
const row = (label, value, cls = '') => value ? `<div class="info-row${cls ? ' ' + cls : ''}"><strong>${esc(label)}</strong><span>${esc(publicText(value))}</span></div>` : '';
const detail = (label, body) => body ? `<details open><summary>${esc(label)}</summary><p>${esc(publicText(body))}</p></details>` : '';

function graphFor(item, url) {
  const o = item.official || {};
  const image = base + '/images/' + item.img;
  const sku = getSku(item);
  const pack = getPack(item);
  const props = [];
  if (typeof item.price === 'number') props.push({ '@type': 'PropertyValue', name: 'Black Sheep shop price', value: money(item.price) });
  if (pack) props.push({ '@type': 'PropertyValue', name: 'Pack size', value: pack });
  if (o.allergens) props.push({ '@type': 'PropertyValue', name: 'Allergen information', value: o.allergens });
  if (o.dietary) props.push({ '@type': 'PropertyValue', name: 'Dietary information', value: o.dietary });
  if (o.awards) props.push({ '@type': 'PropertyValue', name: 'Awards', value: o.awards });
  const product = {
    '@type': 'Product', '@id': url + '#product', name: item.name, description: publicText(item.desc), url,
    image: [image], brand: { '@type': 'Brand', name: item.brand || "Romney's of Kendal" },
    category: "Romney's & confectionery", additionalProperty: props
  };
  if (sku) product.sku = String(sku);
  if (o.manufacturer) product.manufacturer = { '@type': 'Organization', name: o.manufacturer };
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Store', '@id': base + '/#store', name: 'The Black Sheep Shop', url: base + '/', telephone: '+447776185647', image: base + '/images/1.png', logo: base + '/assets/sheep-icon.png', sameAs: ['https://www.facebook.com/profile.php?id=61551509207855'], address: { '@type': 'PostalAddress', streetAddress: '2 Lancaster House, Lake Road', addressLocality: 'Ambleside', postalCode: 'LA22 0AD', addressCountry: 'GB' } },
    { '@type': 'WebSite', '@id': base + '/#website', url: base + '/', name: 'The Black Sheep Shop', publisher: { '@id': base + '/#store' } },
    { '@type': 'WebPage', '@id': url + '#webpage', url, name: item.name + ' | The Black Sheep Shop', description: item.desc, isPartOf: { '@id': base + '/#website' }, about: { '@id': url + '#product' }, primaryImageOfPage: { '@type': 'ImageObject', url: image } },
    { '@type': 'BreadcrumbList', '@id': url + '#breadcrumbs', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
      { '@type': 'ListItem', position: 2, name: "Romney's", item: base + '/romneys.html' },
      { '@type': 'ListItem', position: 3, name: item.name, item: url }
    ] }, product
  ] };
}

function page(item) {
  const url = base + '/products/' + item.slug + '.html';
  const o = item.official || {};
  const pack = getPack(item), sku = getSku(item);
  const title = esc(item.name) + ' | The Black Sheep Shop Ambleside';
  const desc = esc(publicText(item.desc));
  const facts = [
    row('Brand', item.brand),
    row('Black Sheep price', typeof item.price === 'number' ? money(item.price) : null, 'price-row'),
    row('Pack size', pack), row('Product code', sku), row('Manufacturer', o.manufacturer),
    row('Availability', 'In-store stock changes regularly. Please ask us if you need a particular item.')
  ].join('');
  const details = [detail('Ingredients', o.ingredients), detail('Allergens', o.allergens), detail('Dietary information', o.dietary), detail('Nutrition', o.nutrition), detail('Awards', o.awards)].join('');
  const verified = o.url ? '<p class="romneys-verified-note">Product identity and available factual details have been checked against the current manufacturer listing. Black Sheep pricing and in-store availability are our own.</p>' : '';
  const info = details ? `<section class="wrap romneys-product-info" aria-label="Product information"><div class="romneys-info-heading"><div class="eyebrow">Product information</div><h2>Details for this product</h2></div><div class="romneys-details">${details}</div><div class="notice"><strong>Ingredients and allergens:</strong> recipes and packaging can change. Always check the current pack and ask staff if you have an allergy or intolerance.</div></section>` : '<section class="wrap romneys-product-info compact" aria-label="Product information"><div class="notice"><strong>Ingredients and allergens:</strong> product recipes and packaging can change. Please check the current pack and ask staff if you have an allergy or intolerance.</div></section>';
  const json = JSON.stringify(graphFor(item, url)).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${desc}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#151512"><link rel="canonical" href="${url}"><meta property="og:type" content="product"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${url}"><meta property="og:image" content="${base}/images/${esc(item.img)}"><meta property="og:image:alt" content="${esc(item.name)}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="../assets/sheep-icon.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="../assets/style.css"><script type="application/ld+json">${json}</script></head><body><div class="topbar"><div class="wrap"><span>Independent gift &amp; souvenir shop in Ambleside, Lake District</span><span class="right"><a href="/visit.html">Find us in Ambleside</a></span></div></div><header class="header"><div class="wrap nav"><a class="brand" href="/" aria-label="The Black Sheep Shop home"><img class="brand-mark" src="../assets/sheep-icon.png" alt=""><span class="brand-type"><strong>The Black Sheep</strong><small>Shop · Ambleside</small></span></a><nav class="menu"><a href="/">Home</a><a href="/gifts.html">Gifts &amp; Souvenirs</a><a href="/icecream.html">Ice Cream</a><a href="/romneys.html">Romney's</a><a href="/hawkshead-relish.html">Hawkshead Relish</a><a href="/all-products.html">Full range</a><a href="/about.html">About</a><a href="/visit.html">Visit</a></nav><a class="nav-cta" href="/gifts.html">Browse gifts</a><button class="hamb" onclick="toggleMenu()" aria-label="Open menu" aria-expanded="false">☰</button></div><nav class="mobile-menu" id="mobileMenu"><a href="/">Home</a><a href="/gifts.html">Gifts &amp; Souvenirs</a><a href="/icecream.html">Ice Cream</a><a href="/romneys.html">Romney's</a><a href="/hawkshead-relish.html">Hawkshead Relish</a><a href="/all-products.html">Full range</a><a href="/about.html">About</a><a href="/visit.html">Visit</a></nav></header><main><nav class="wrap breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span><a href="/romneys.html">Romney's</a><span aria-hidden="true">›</span><span aria-current="page">${esc(item.name)}</span></nav><article class="wrap detail-layout product-static romneys-detail"><div class="detail-media contain romneys-product-media"><img src="../images/${esc(item.img)}" alt="${esc(item.name)}" decoding="async" fetchpriority="high"></div><div class="detail-copy romneys-product-copy"><div class="eyebrow">Romney's &amp; confectionery</div><h1>${esc(item.name)}</h1><div class="romneys-price">${typeof item.price === 'number' ? money(item.price) : 'Ask in store'}</div><p class="romneys-intro">${desc}</p><div class="info-list">${facts}</div>${verified}<div class="actions"><button class="btn primary list-detail-add" type="button" onclick='addToBlackSheepList(event,"romneys","${item.slug}")'>Add to my list</button><a class="btn secondary" href="/visit.html">Visit the shop</a><a class="btn secondary" href="/romneys.html">Back to Romney's</a></div></div></article>${info}</main><div class="brand-strip" aria-hidden="true"></div><footer><div class="wrap"><div class="footer-grid"><div class="footer-brand"><a class="footer-wordmark" href="/" aria-label="The Black Sheep Shop home"><img class="footer-mark" src="../assets/sheep-icon.png" alt=""><span><strong>The Black Sheep</strong><small>Shop · Ambleside</small></span></a><p>Independent gift &amp; souvenir shop in Ambleside, Lake District.</p></div><div class="footer-col"><h4>Popular gifts</h4><a href="/gifts-peter-rabbit.html">Peter Rabbit</a><a href="/gifts-highland-cows.html">Highland Cows</a><a href="/gifts-mugs.html">Mugs &amp; Tableware</a><a href="/gifts-soft-toys.html">Soft Toys</a><a href="/gifts.html">All gifts</a></div><div class="footer-col"><h4>More in store</h4><a href="/all-products.html">Full range</a><a href="/icecream.html">Ice Cream</a><a href="/romneys.html">Romney's</a><a href="/hawkshead-relish.html">Hawkshead Relish</a></div><div class="footer-col"><h4>Find us</h4><a href="/visit.html">2 Lancaster House<br>Lake Road, Ambleside<br>LA22 0AD</a><a href="tel:+447776185647">07776 185647</a><a href="https://www.facebook.com/profile.php?id=61551509207855" target="_blank" rel="noopener">Facebook</a><a href="/visit.html">Plan your visit</a></div></div><div class="copyright">© 2026 The Black Sheep Shop. All rights reserved.</div></div></footer><script src="../assets/catalog.js"></script><script src="../assets/site.js"></script></body></html>`;
  supplierRe.lastIndex = 0;
  if (supplierRe.test(html)) throw Error('Public supplier URL leaked into ' + item.slug);
  return html;
}

const card = (i, type) => { const url='/products/'+i.slug+'.html', stock=i.stockStatus==='out-of-stock', cats=[...new Set([...(i.categories || []), type])], fit=i.imageFit==='contain'?' contain':''; return `<article class="product-card${stock?' is-out-of-stock':''}" data-url="${esc(url)}" role="link" tabindex="0" data-categories="${esc(cats.join(' '))}" data-name="${esc((i.name + ' ' + (i.label || '') + ' ' + (i.brand || '')).toLowerCase())}"><a class="product-img${fit}" href="${url}" aria-label="${esc(i.name)}"><img loading="lazy" decoding="async" src="images/${esc(i.img)}" alt="${esc(i.name)}"></a><div class="product-info"><div class="kicker">${esc(i.label || type)}</div><a class="product-title" href="${url}">${esc(i.name)}</a>${i.brand ? `<span class="brand-line">${esc(i.brand)}</span>` : ''}<p class="product-desc">${esc(i.desc)}</p><div class="product-buyline">${typeof i.price === 'number' ? `<span class="product-price">${money(i.price)}</span>` : '<span class="product-price product-price--ask">Ask in store</span>'}${stock?'<span class="stock-card-label">Out of stock</span>':''}</div><div class="card-actions"><button class="list-add" type="button" aria-label="Add ${esc(i.name)} to my list" onclick='addToBlackSheepList(event,"${type}","${i.slug}")'>+ My list</button></div></div></article>`; };

function cleanHtmlDocument(html) {
  const i = html.toLowerCase().indexOf('</html');
  if (i < 0) return html;
  return html.slice(0, i) + '</html>';
}

function oneDocument(html) {
  const bodyClose = html.indexOf('</body>');
  if (bodyClose < 0) return html;
  return html.slice(0, bodyClose + '</body>'.length) + '</html>';
}

function replaceDivContentsById(html, id, newInner) {
  const at = html.indexOf(`id="${id}"`);
  if (at < 0) throw Error('Missing #' + id);
  const start = html.lastIndexOf('<div', at), openEnd = html.indexOf('>', at) + 1;
  const re = /<div\b[^>]*>|<\/div>/gi;
  if (start < 0 || openEnd <= 0) throw Error('Bad #' + id);
  re.lastIndex = openEnd;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[0].toLowerCase().startsWith('<div')) depth++; else depth--;
    if (depth === 0) return html.slice(0, openEnd) + newInner + html.slice(m.index);
  }
  throw Error('Unclosed #' + id);
}

function updateItemList(html, list) {
  return html.replace(/(<script[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, a, b, c) => {
    let data; try { data = JSON.parse(b); } catch { return whole; }
    let changed = false;
    for (const n of data?.['@graph'] || []) if (n?.['@type'] === 'ItemList') {
      n.numberOfItems = list.length;
      n.itemListElement = list.map((i, k) => ({ '@type': 'ListItem', position: k + 1, url: base + '/products/' + i.slug + '.html', name: i.name }));
      changed = true;
    }
    return changed ? a + JSON.stringify(data) + c : whole;
  });
}

for (const item of items) outputs.set('products/' + item.slug + '.html', page(item));
let r = replaceDivContentsById(cleanHtmlDocument(read('romneys.html')), 'catalog', items.map(i => card(i, 'romneys')).join(''));
r = updateItemList(r, items); outputs.set('romneys.html', r);
let a = cleanHtmlDocument(read('all-products.html'));
let romneyCardIndex = 0;
a = a.replace(/<article class="product-card"[^>]*data-categories="[^"]*\bromneys\b[^"]*"[\s\S]*?<\/article>/g, () => card(items[romneyCardIndex++], 'romneys'));
if (romneyCardIndex !== items.length) throw Error('Expected ' + items.length + ' Romney cards in all-products.html, found ' + romneyCardIndex);
a = updateItemList(a, all);
a = a.replace(/\b\d+ products currently listed online\b/g, all.length + ' products currently listed online').replace(/(<span id="giftCount">)\d+ products(<\/span>)/, '$1' + all.length + ' products$2');
outputs.set('all-products.html', a);

const sitemapSource = read('sitemap.xml');
const firstUrl = sitemapSource.indexOf('<url>');
const close = '</urlset>';
if (firstUrl < 0 || !sitemapSource.includes(close)) throw Error('Bad sitemap');
const prefix = sitemapSource.slice(0, firstUrl).trimEnd() + '\n';
const nonProductBlocks = [...sitemapSource.matchAll(/<url>[\s\S]*?<\/url>/g)]
  .map(m => m[0].trim())
  .filter(block => !block.includes(base + '/products/'));
const productBlocks = all.filter(i => !i.placeholder).map(i => {
  let entries;
  if (/^HR-/.test(i.id || '') && i.gallery?.length) {
    const seen = new Set();
    entries = i.gallery.filter(g => g?.src && !seen.has(g.src) && seen.add(g.src)).map(g => ({ src: g.src, title: g.alt || i.name }));
  } else {
    entries = [{ src: i.img, title: i.name }, ...(i.gallery || []).map(g => ({ src: g.src, title: g.alt || i.name }))].filter(x => x.src);
  }
  return `<url><loc>${xmlEsc(base + '/products/' + i.slug + '.html')}</loc><lastmod>2026-09-24</lastmod>${entries.map(x => `<image:image><image:loc>${xmlEsc(base + '/images/' + x.src)}</image:loc><image:title>${xmlEsc(x.title)}</image:title></image:image>`).join('')}</url>`;
});
const s = prefix + [...nonProductBlocks, ...productBlocks].map(block => '  ' + block).join('\n') + '\n' + close + '\n';
outputs.set('sitemap.xml', s);

const changed = [];
for (const [p, h] of outputs) if (!fs.existsSync(p) || read(p) !== h) {
  changed.push(p);
  if (!process.argv.includes('--check')) fs.writeFileSync(p, h);
}
if (process.argv.includes('--check') && changed.length) {
  console.error("Romney's static output drift:", changed);
  process.exit(1);
}
console.log("Romney's static reconciliation:", changed.length ? 'updated ' + changed.length + ' files' : 'all outputs match');
