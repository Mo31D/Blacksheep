import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const catalog=JSON.parse(read('assets/catalog.js').split('window.CATALOG=')[1].trim().replace(/;$/,''));
const money=n=>'£'+Number(n).toFixed(2);
const safe=s=>String(s??'—').replace(/\|/g,'\\|').replace(/\n/g,' ');
const pack=i=>i.official?.pack||(/\b\d+\s?(?:g|kg|ml|l)\b/i.exec(i.name)?.[0]??'—');
const status=i=>{
  if(i.official?.url) return /^(Elit|Walker)/i.test(i.brand||'')?'VERIFIED THIRD-PARTY':'VERIFIED EXACT';
  return i.sourceStatus||'NO CURRENT OFFICIAL MATCH';
};
const facts=i=>{
  const o=i.official||{},x=[];
  if(o.url)x.push('identity');
  if(o.pack)x.push('weight/format');
  if(o.sku||i.sku)x.push('SKU');
  if(o.ingredients)x.push('ingredients');
  if(o.allergens)x.push('allergens');
  if(o.dietary)x.push('dietary');
  if(o.nutrition)x.push('nutrition');
  if(o.awards)x.push('awards');
  return x.length?x.join(', '):'Black Sheep catalogue information only';
};
let out=`# Romney's / confectionery — internal source map

Verified: 24 September 2026

**Internal provenance only.** Manufacturer/supplier URLs in this document must not be exposed on customer-facing product pages, product names, product images or Product JSON-LD. Black Sheep owner pricing is authoritative and supplier retail prices must never be imported.

## Status legend

- **VERIFIED EXACT** — exact current official manufacturer/product page identified.
- **VERIFIED THIRD-PARTY** — exact product identified and the true manufacturer is not Romney's.
- **PARTIAL MATCH** — a related official listing exists but is not safe to merge.
- **NO CURRENT OFFICIAL MATCH** — no exact current official page verified.
- **NEEDS OWNER CONFIRMATION** — identity/size/format is ambiguous and must not be guessed.

## Current confectionery catalogue

| Black Sheep ID | Product | Slug | Black Sheep price | Actual brand | Official product | Official source URL | Official image source | Local image | Weight / format | Facts verified | Source status | Notes |
|---|---|---|---:|---|---|---|---|---|---|---|---|---|
`;
for(const i of catalog.romneys||[]){
 const o=i.official||{};
 out+=`| ${safe(i.id)} | ${safe(i.name)} | \`${safe(i.slug)}\` | ${typeof i.price==='number'?money(i.price):'—'} | ${safe(i.brand)} | ${safe(o.name)} | ${safe(o.url)} | ${safe(o.imageUrl)} | \`${safe(o.imageLocal||i.img)}\` | ${safe(pack(i))} | ${safe(facts(i))} | **${status(i)}** | ${safe(i.sourceNotes)} |\n`;
}
out+=`
## Owner-confirmed products still pending exact identity

### Twin Biscuit Sachets — £6.90
**NEEDS OWNER CONFIRMATION.** The current official Romney's biscuit range contains a **400g Biscuit Selection** (SKU 5022259601642), but its official page does not identify the product as “Twin” or “Sachets”. The matching £6.90 manufacturer price is not identity evidence and is deliberately ignored for Black Sheep pricing.

Candidate: https://mintcake.co.uk/products/400g-biscuit-selection

### Boxed Fudge 150g — £4.90
**NEEDS OWNER CONFIRMATION.** Current official Romney's listings include multiple distinct 150g boxed fudge products/flavours. The owner description does not identify which exact box is stocked, so no new catalogue record has been invented.

### Chocolate Covered Kendal Mint Cake — Small / Medium / Large
**NEEDS OWNER CONFIRMATION for the size labels.** Current Black Sheep catalogue has an exact 113g chocolate-covered product. Current official Romney's listings also include other chocolate-covered formats (including 55g and pocket-tin formats). The owner labels Small / Medium / Large must be mapped from the actual Black Sheep packaging/weight before applying £1.40 / £2.50 / £4.70. Triple Pack is independently identified and set to £4.90.

### Rock — Small / Large
**NEEDS OWNER CONFIRMATION.** Current ROM-001 does not state a weight/size. It remains £1.50. Do not create or price a Large Rock at £2.80 without an exact product record or packaging match.

### Postcard Boxes — £4.95
**NEEDS OWNER CONFIRMATION.** The four older 200g gift-box records (ROM-043–ROM-046) currently lack exact official matches proving that they are the owner-described “Postcard Boxes”. Their existing Black Sheep prices remain unchanged until exact packaging is confirmed.

## Customer-page source-link rule

The public site must not contain:
- “Manufacturer source”
- “Buy from manufacturer”
- manufacturer/supplier product URLs
- supplier-shop links from product images or product names
- supplier retail prices

The actual brand/manufacturer name may be shown as factual product information.
`;
fs.writeFileSync('docs/ROMNEYS-SOURCE-MAP.md',out);
console.log('Wrote docs/ROMNEYS-SOURCE-MAP.md for',catalog.romneys.length,'products');
