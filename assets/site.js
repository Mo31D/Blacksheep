
window.GIFT_COLLECTIONS = [{"slug":"peter-rabbit","name":"Peter Rabbit","desc":"A curated Peter Rabbit collection with soft toys, tableware, stationery, keyrings and seasonal gifts.","img":"peter-rabbit/peter-rabbit-medium.webp","url":"gifts-peter-rabbit.html"},{"slug":"highland-cows","name":"Highland Cows","desc":"A focused selection of verified Highland Cow ornaments from The Leonardo Collection.","img":"highland-cows/highland-cow-flowers-lp73651.webp","url":"gifts-highland-cows.html"},{"slug":"mugs","name":"Mugs & Tableware","desc":"Selected Peter Rabbit tableware and kitchen gifts from the curated catalogue.","img":"peter-rabbit/peter-rabbit-english-garden-mug.webp","url":"gifts-mugs.html"},{"slug":"soft-toys","name":"Soft Toys","desc":"Selected Peter Rabbit and Beatrix Potter soft toys from the curated catalogue.","img":"peter-rabbit/peter-rabbit-medium.webp","url":"gifts-soft-toys.html"},{"slug":"cards","name":"Cards & Stationery","desc":"Selected Peter Rabbit stationery from the curated catalogue.","img":"peter-rabbit/beatrix-potter-stationery-set.webp","url":"gifts-cards.html"},{"slug":"seasonal","name":"Christmas","desc":"Selected Peter Rabbit festive gifts and ornaments.","img":"peter-rabbit/peter-rabbit-christmas-bauble.webp","url":"gifts-seasonal.html"}];
window.EXTRA_COLLECTIONS = [{"slug":"keyrings-badges","name":"Keyrings & Badges","desc":"Selected Peter Rabbit character keyrings.","img":"peter-rabbit/peter-rabbit-keyring.webp","url":"gifts-keyrings-badges.html"},{"slug":"home-gifts","name":"Home Gifts & Art","desc":"Selected Peter Rabbit kitchen gifts and Highland Cow ornaments.","img":"highland-cows/highland-cow-flowers-lp73651.webp","url":"gifts-home-art.html"},{"slug":"toys-games","name":"Toys & Games","desc":"Selected Peter Rabbit games from the curated catalogue.","img":"peter-rabbit/peter-rabbit-playing-cards.webp","url":"gifts-toys-games.html"}];
function collectionCard(x){return `<a class="collection" href="${x.url}"><div class="collection-media"><img loading="lazy" src="images/${x.img}" alt="${x.name}"></div><div class="collection-copy"><h3>${x.name}</h3><p>${x.desc}</p><span class="text-link">Browse collection</span></div></a>`}
function renderGiftCollections(rootId, mode='primary'){const root=document.getElementById(rootId);if(!root)return;const list=mode==='extra'?window.EXTRA_COLLECTIONS:window.GIFT_COLLECTIONS;root.innerHTML=list.map(collectionCard).join('')}
function toggleMenu(){const menu=document.getElementById('mobileMenu');if(!menu)return;const open=menu.classList.toggle('open');document.querySelector('.hamb')?.setAttribute('aria-expanded',open?'true':'false')}
function simplifyGiftNavigation(){document.querySelector('.hamb')?.setAttribute('aria-expanded','false');document.querySelectorAll('.mobile-submenu,.dropdown-panel').forEach(el=>el.remove());document.querySelectorAll('.dropdown-trigger > span').forEach(el=>el.remove());const emptyGiftPages=new Set(['gifts-fridge-magnets.html','gifts-souvenirs.html','gifts-maps-books-jigsaws.html','lakeland-fragrances.html']);document.querySelectorAll('a[href]').forEach(a=>{const href=a.getAttribute('href');if(emptyGiftPages.has(href))a.remove()});const addFullRange=(nav)=>{if(!nav||nav.querySelector('a[href$="all-products.html"]'))return;const link=document.createElement('a');link.href='/all-products.html';link.textContent='Full range';if(/all-products\.html$/.test(location.pathname))link.classList.add('active');const before=[...nav.children].find(el=>el.matches?.('a[href$="about.html"]'));nav.insertBefore(link,before||null)};addFullRange(document.querySelector('.menu'));addFullRange(document.getElementById('mobileMenu'))}
document.addEventListener('DOMContentLoaded',simplifyGiftNavigation);
function itemUrl(item,type){return '/products/'+encodeURIComponent(item.slug)+'.html'}
function cardCategories(item,type){const cats=[...(item.categories||[])];if(type==='gifts'&&cats.includes('local-food')){if(!cats.includes('romneys'))cats.push('romneys')}else if(type&&!cats.includes(type))cats.push(type);return cats}
function formatPrice(value){return typeof value==='number'?'£'+value.toFixed(2):''}
function card(item,type){const url=itemUrl(item,type);const brand=item.brand?`<span class="brand-line">${item.brand}</span>`:'';const cats=cardCategories(item,type);const fit=item.imageFit==='contain'?' contain':'';const ph=item.placeholder===true;const out=item.stockStatus==='out-of-stock'&&item.availabilityStatus!=='arriving-soon';const arrivingSoon=item.availabilityStatus==='arriving-soon';const media=ph||!item.img?`<a class="product-img contain product-img--placeholder" href="${url}" aria-label="${item.name}"><span class="product-placeholder-media" aria-hidden="true"><strong>${ph?'Image coming soon':'Product image being added'}</strong><small>${item.sku||''}</small></span></a>`:`<a class="product-img${fit}" href="${url}" aria-label="${item.name}"><img loading="lazy" src="images/${item.img}" alt="${item.name}"></a>`;const price=typeof item.price==='number'?`<span class="product-price">${formatPrice(item.price)}</span>`:'<span class="product-price product-price--ask">Ask in store</span>';const state=arrivingSoon?'<span class="stock-card-label arriving-soon">Arriving soon</span>':(out?'<span class="stock-card-label">Out of stock</span>':'');return `<article class="product-card${out?' is-out-of-stock':''}${ph?' is-placeholder':''}" data-url="${url}" role="link" tabindex="0" data-categories="${cats.join(' ')}" data-name="${(item.name+' '+item.label+' '+(item.brand||'')+' '+(item.sku||'')).toLowerCase()}">${media}<div class="product-info"><div class="kicker">${item.label}</div><a class="product-title" href="${url}">${item.name}</a>${brand}<p class="product-desc">${item.desc}</p><div class="product-buyline">${price}${state}</div><div class="card-actions"><button class="list-add" type="button" aria-label="Add ${item.name} to basket" onclick="addToBlackSheepList(event,'${type}','${item.slug}')" >Add to basket</button></div></div></article>`}

function syncCatalogCardState(root=document){if(!window.CATALOG)return;const bySlug=new Map();Object.values(window.CATALOG).forEach(list=>(list||[]).forEach(item=>bySlug.set(item.slug,item)));root.querySelectorAll('.product-card').forEach(card=>{const href=card.dataset.url||card.querySelector('.product-title,.product-img')?.getAttribute('href')||'';const m=href.match(/\/products\/([^/?#]+)\.html/);const item=m?bySlug.get(decodeURIComponent(m[1])):null;if(!item)return;const buy=card.querySelector('.product-buyline');const meta=card.querySelector('.product-meta');let priceEl=card.querySelector('.product-price');if(typeof item.price==='number'){const val=formatPrice(item.price);if(priceEl){priceEl.className='product-price';priceEl.textContent=val}else if(buy)buy.insertAdjacentHTML('afterbegin','<span class="product-price">'+val+'</span>');else if(meta)meta.insertAdjacentHTML('afterbegin','<span class="product-price">'+val+'</span>')}else if(priceEl){priceEl.className='product-price product-price--ask';priceEl.textContent='Ask in store'}card.querySelectorAll('.stock-card-label,.availability-card-label').forEach(el=>el.remove());const arrivingSoon=item.availabilityStatus==='arriving-soon';const out=item.stockStatus==='out-of-stock'&&!arrivingSoon;const liveBlocked=item.commercePurchasable===false&&!arrivingSoon&&!out&&item.commerceUnavailableReason!=='price_unavailable';card.classList.toggle('is-out-of-stock',out);if(buy&&arrivingSoon)buy.insertAdjacentHTML('beforeend','<span class="stock-card-label arriving-soon">Arriving soon</span>');else if(buy&&out)buy.insertAdjacentHTML('beforeend','<span class="stock-card-label">Out of stock</span>');else if(buy&&liveBlocked)buy.insertAdjacentHTML('beforeend','<span class="stock-card-label">Not available online</span>')})}

function productAvailabilityRank(item){if(!item)return 0;if(item.availabilityStatus==='arriving-soon')return 1;if(item.stockStatus==='out-of-stock')return 2;return 0}
function sortProductCardsByAvailability(root=document){if(!window.CATALOG)return;const bySlug=new Map();Object.values(window.CATALOG).forEach(list=>(list||[]).forEach(item=>bySlug.set(item.slug,item)));const parents=new Set();root.querySelectorAll('.product-card').forEach(card=>{if(card.parentElement)parents.add(card.parentElement)});parents.forEach(parent=>{const cards=[...parent.children].filter(el=>el.classList?.contains('product-card'));if(cards.length<2)return;const ranked=cards.map((card,index)=>{const href=card.dataset.url||card.querySelector('.product-title,.product-img')?.getAttribute('href')||'';const m=href.match(/\/products\/([^/?#]+)\.html/);const item=m?bySlug.get(decodeURIComponent(m[1])):null;return{card,index,rank:productAvailabilityRank(item)}});ranked.sort((a,b)=>a.rank-b.rank||a.index-b.index);if(ranked.every((x,i)=>x.card===cards[i]))return;const marker=document.createComment('availability-order');parent.insertBefore(marker,cards[0]);const frag=document.createDocumentFragment();ranked.forEach(x=>frag.appendChild(x.card));marker.after(frag);marker.remove()})}
function wireProductCards(root=document){root.querySelectorAll('.product-card').forEach(card=>{const href=card.dataset.url||card.querySelector('.product-title,.product-img')?.getAttribute('href');if(!href)return;card.dataset.url=href;card.setAttribute('role','link');if(!card.hasAttribute('tabindex'))card.tabIndex=0;if(card.dataset.cardWired==='1')return;card.dataset.cardWired='1';card.addEventListener('click',e=>{if(e.target.closest('a,button,input,select,textarea,label'))return;location.href=href});card.addEventListener('keydown',e=>{if(e.target!==card)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();location.href=href}})})}
function productForBasketButton(btn){
  const onclick=btn.getAttribute('onclick')||'';
  const match=onclick.match(/addToBlackSheepList\(event,\s*['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/);
  return match?{type:match[1],slug:match[2],item:findItem(match[1],match[2])}:null;
}
function polishListButtons(root=document){
  root.querySelectorAll('.list-add,.list-detail-add').forEach(btn=>{
    const data=productForBasketButton(btn);
    const state=data?.item&&window.BlackSheepCart?blackSheepCart.productState(data.item):{purchasable:true,reason:null};
    btn.dataset.listButtonReady='1';
    if(state.purchasable){
      btn.disabled=false;
      btn.textContent='Add to basket';
      if(data?.item)btn.setAttribute('aria-label','Add '+data.item.name+' to basket');
    }else{
      btn.disabled=true;
      btn.textContent=blackSheepUnavailableMessage(state.reason);
      if(data?.item)btn.setAttribute('aria-label',data.item.name+', '+blackSheepUnavailableMessage(state.reason));
    }
  });
}
function polishProductDetails(){document.querySelectorAll('.romneys-detail .info-row').forEach(row=>{const label=row.querySelector('strong')?.textContent.trim().toLowerCase();const value=row.querySelector('span');if(!label)return;if(label==='black sheep price'||label==='price'){if(document.querySelector('.romneys-price'))row.remove();return}if(label==='availability'&&value)value.textContent=row.classList.contains('stock-row')?'Out of stock':'Check in store'});const rows=[...document.querySelectorAll('.romneys-detail .info-row')];const brand=rows.find(r=>r.querySelector('strong')?.textContent.trim().toLowerCase()==='brand')?.querySelector('span')?.textContent.trim();const manufacturer=rows.find(r=>r.querySelector('strong')?.textContent.trim().toLowerCase()==='manufacturer');if(brand&&manufacturer?.querySelector('span')?.textContent.trim()===brand)manufacturer.remove();document.querySelectorAll('.romneys-verified-note').forEach(el=>el.remove())}
function syncStaticProductAvailability(){if(!window.CATALOG||!document.querySelector('.product-static'))return;const match=location.pathname.match(/\/products\/([^/]+)\.html$/);if(!match)return;const slug=decodeURIComponent(match[1]);let item=null;for(const list of Object.values(window.CATALOG)){item=(list||[]).find(x=>x.slug===slug);if(item)break}if(!item)return;const rows=[...document.querySelectorAll('.product-static .info-row')];const priceRow=rows.find(x=>{const l=x.querySelector('strong')?.textContent.trim().toLowerCase();return l==='shop price'||l==='price'});if(priceRow?.querySelector('span')&&item.commerceLive===true)priceRow.querySelector('span').textContent=typeof item.price==='number'?formatPrice(item.price):'Ask in store';const row=rows.find(x=>x.querySelector('strong')?.textContent.trim().toLowerCase()==='availability');const value=row?.querySelector('span');if(!row||!value)return;const arriving=item.availabilityStatus==='arriving-soon';const out=item.stockStatus==='out-of-stock'&&!arriving;const reason=String(item.commerceUnavailableReason||'');if(item.commerceLive===true){row.classList.toggle('stock-row',arriving||out||item.commercePurchasable===false);if(arriving)value.textContent='Arriving soon';else if(out)value.textContent='Out of stock';else if(reason==='online_ordering_disabled'||reason==='not_for_sale')value.textContent='Not available to order online';else if(item.commerceInventoryTracked===true&&Number.isFinite(item.commerceAvailable))value.textContent=item.commerceAvailable>0?'Available to order · '+item.commerceAvailable+' available':'Out of stock';else value.textContent='Available to order';return}if(arriving||out){row.classList.add('stock-row');value.textContent=arriving?'Arriving soon':'Out of stock'}}
document.addEventListener('DOMContentLoaded',()=>{wireProductCards();syncCatalogCardState();sortProductCardsByAvailability();polishListButtons();polishProductDetails();syncStaticProductAvailability()});
function renderRomneysRange(rootId='catalog'){const root=document.getElementById(rootId);if(!root||!window.CATALOG)return;if(root.querySelector('.product-card')){initFilters();return}const romneys=(window.CATALOG.romneys||[]).map(x=>({item:x,type:'romneys'}));const own=(window.CATALOG.gifts||[]).filter(x=>(x.categories||[]).includes('local-food')).map(x=>({item:x,type:'gifts'}));root.innerHTML=[...romneys,...own].map(x=>card(x.item,x.type)).join('');initFilters()}
function renderAllProducts(rootId='catalog'){const root=document.getElementById(rootId);if(!root||!window.CATALOG)return;if(root.querySelector('.product-card')){initFilters();return}const rows=[];for(const type of ['gifts','icecream','romneys','hawkshead','fragrances'])for(const item of (window.CATALOG[type]||[]))rows.push({item,type});root.innerHTML=rows.map(x=>card(x.item,x.type)).join('');initFilters()}
function normalizeFoodNavigation(){document.querySelectorAll('a[href="gifts-local-food.html"]').forEach(a=>a.remove());document.querySelectorAll('a[href="gifts-seasonal.html"]').forEach(a=>{if(a.classList.contains('collection'))return;const strong=a.querySelector('strong');if(strong){strong.textContent='Christmas';const sub=a.querySelector('span');if(sub)sub.textContent='Baubles, Peter Rabbit & festive Highland Cows'}else if(!a.classList.contains('card-link'))a.textContent='Christmas'});if(/(^|\/)gifts-local-food\.html$/.test(location.pathname))location.replace('romneys.html')}
document.addEventListener('DOMContentLoaded',normalizeFoodNavigation);
function renderCatalog(type,category){const root=document.getElementById('catalog');if(!root||!window.CATALOG)return;if(root.querySelector('.product-card')){initFilters();return}const items=window.CATALOG[type]||[];root.innerHTML=items.filter(x=>!category||(x.categories||[]).includes(category)).map(x=>card(x,type)).join('');initFilters()}
function renderFeatured(rootId, type, slugs){const root=document.getElementById(rootId);if(!root)return;const items=window.CATALOG[type]||[];let list=[];if(slugs&&slugs.length) list=slugs.map(s=>items.find(x=>x.slug===s)).filter(Boolean);else list=items.slice(0,4);root.innerHTML=list.map(x=>card(x,type)).join('');wireProductCards(root);syncCatalogCardState(root);sortProductCardsByAvailability(root);polishListButtons(root)}
function initFilters(){wireProductCards();syncCatalogCardState();sortProductCardsByAvailability();polishListButtons();const search=document.getElementById('search');const chips=[...document.querySelectorAll('.chip[data-filter]')];const cards=[...document.querySelectorAll('.product-card')];const empty=document.getElementById('empty');const count=document.getElementById('giftCount');let active='all';function apply(){const q=(search?.value||'').trim().toLowerCase();let n=0;cards.forEach(c=>{const okCat=active==='all'||c.dataset.categories.split(' ').includes(active);const okQ=!q||c.dataset.name.includes(q);const show=okCat&&okQ;c.style.display=show?'flex':'none';if(show)n++});if(empty)empty.style.display=n?'none':'block';if(count)count.textContent=n+' '+(n===1?'product':'products')}search?.addEventListener('input',apply);chips.forEach(ch=>ch.addEventListener('click',()=>{chips.forEach(x=>x.classList.remove('active'));ch.classList.add('active');active=ch.dataset.filter;apply()}));apply()}
function findItem(type,slug){return (window.CATALOG[type]||[]).find(x=>x.slug===slug)}
function backFor(item,type){if(type==='icecream')return 'icecream.html';if(type==='romneys')return 'romneys.html';if(type==='hawkshead')return 'hawkshead-relish.html';if(type==='fragrances')return 'lakeland-fragrances.html';const map={'peter-rabbit':'gifts-peter-rabbit.html','highland-cows':'gifts-highland-cows.html','fridge-magnets':'gifts-fridge-magnets.html','mugs':'gifts-mugs.html','souvenirs':'gifts-souvenirs.html','soft-toys':'gifts-soft-toys.html','cards':'gifts-cards.html','seasonal':'gifts-seasonal.html','keyrings-badges':'gifts-keyrings-badges.html','maps-books-jigsaws':'gifts-maps-books-jigsaws.html','local-food':'romneys.html','home-gifts':'gifts-home-art.html','toys-games':'gifts-toys-games.html'};for(const c of (item.categories||[])){if(map[c])return map[c]}return 'gifts.html'}
function detailMedia(item){const images=(item.gallery&&item.gallery.length?item.gallery:[{src:item.img,alt:item.name}]);const fit=item.imageFit==='contain'?' contain':'';if(images.length===1)return `<div class="detail-media${fit}"><img src="images/${images[0].src}" alt="${images[0].alt||item.name}"></div>`;return `<div class="detail-media detail-gallery${fit}" aria-label="${item.name} product images"><div class="detail-gallery-track">${images.map(x=>`<div class="detail-gallery-slide ${x.fit==='cover'?'cover':'contain'}"><img src="images/${x.src}" alt="${x.alt||item.name}"></div>`).join('')}</div></div>`}
function renderDetail(){const root=document.getElementById('detail');if(!root||!window.CATALOG)return;const p=new URLSearchParams(location.search),type=p.get('type')||'gifts',slug=p.get('slug');const item=findItem(type,slug);if(!item){root.innerHTML='<div class="wrap"><div class="notice"><strong>Product not found.</strong> Return to the catalogue.</div></div>';return}document.title=item.name+' | The Black Sheep Shop';const metaDescription=(item.desc||'Product details from The Black Sheep Shop in Ambleside.').replace(/\s+/g,' ').trim().slice(0,160);document.querySelector('meta[name="description"]')?.setAttribute('content',metaDescription);document.querySelector('meta[property="og:title"]')?.setAttribute('content',item.name+' | The Black Sheep Shop');document.querySelector('meta[property="og:description"]')?.setAttribute('content',metaDescription);document.querySelector('meta[property="og:image"]')?.setAttribute('content',new URL('images/'+item.img,location.href).href);let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=location.href.split('#')[0];const rows=[];if(item.brand)rows.push(`<div class="info-row"><strong>Brand</strong><span>${item.brand}</span></div>`);if(typeof item.price==='number')rows.push(`<div class="info-row"><strong>Price</strong><span class="detail-price">${formatPrice(item.price)}</span></div>`);if(item.sku)rows.push(`<div class="info-row"><strong>Product code</strong><span>${item.sku}</span></div>`);if(item.range)rows.push(`<div class="info-row"><strong>Range</strong><span>${item.range}</span></div>`);if(item.dimensions)rows.push(`<div class="info-row"><strong>Dimensions</strong><span>${item.dimensions}</span></div>`);if(item.material)rows.push(`<div class="info-row"><strong>Material</strong><span>${item.material}</span></div>`);if(item.packaging)rows.push(`<div class="info-row"><strong>Packaging</strong><span>${item.packaging}</span></div>`);if(item.suitability)rows.push(`<div class="info-row"><strong>Suitable for</strong><span>${item.suitability}</span></div>`);if(item.care)rows.push(`<div class="info-row"><strong>Care</strong><span>${item.care}</span></div>`);root.innerHTML=`<div class="wrap detail-layout">${detailMedia(item)}<div class="detail-copy"><div class="eyebrow">${item.label}</div><h1>${item.name}</h1><p>${item.desc}</p><div class="info-list">${rows.join('')}<div class="info-row"><strong>Availability</strong><span>In-store stock changes regularly. Please visit or contact us to check availability.</span></div>${item.range?'':`<div class="info-row"><strong>Collection</strong><span>${item.label}</span></div>`}${item.note?'<div class="info-row"><strong>Range note</strong><span>'+item.note+'</span></div>':''}</div>${type==='icecream'?'<div class="notice"><strong>Allergies and intolerances:</strong> recipes and supplier information can change. Please ask us for current product and allergen information before ordering.</div>':''}<div class="actions"><button class="btn primary list-detail-add" type="button" onclick="addToBlackSheepList(event,'${type}','${item.slug}')" >Add to basket</button><a class="btn secondary" href="visit.html">Visit the shop</a><a class="btn secondary" href="${backFor(item,type)}">Back to collection</a></div></div></div>`}


/* CART CORE FACTORY START */
function createBlackSheepCartCore(storage,resolveProduct){
  const cartKey='black-sheep-cart-v1';
  const legacyKey='black-sheep-previsit-list-v1';
  const maxQuantity=99;

  function safeParse(value,fallback){
    try{return JSON.parse(value)}catch{return fallback}
  }

  function productState(item,quantity=1){
    if(!item)return{purchasable:false,reason:'missing-product'};
    const liveReason=String(item.commerceUnavailableReason||'');
    if(item.commercePurchasable===false){
      if(liveReason==='arriving_soon')return{purchasable:false,reason:'arriving-soon'};
      if(liveReason==='out_of_stock')return{purchasable:false,reason:'out-of-stock'};
      if(liveReason==='price_unavailable')return{purchasable:false,reason:'price-unavailable'};
      if(liveReason==='online_ordering_disabled')return{purchasable:false,reason:'not-available-online'};
      if(liveReason==='not_for_sale')return{purchasable:false,reason:'not-for-sale'};
      return{purchasable:false,reason:'not-available'};
    }
    if(item.commerceInventoryTracked===true&&Number.isFinite(item.commerceAvailable)&&Number(quantity)>item.commerceAvailable)return{purchasable:false,reason:'out-of-stock'};
    if(item.availabilityStatus==='arriving-soon')return{purchasable:false,reason:'arriving-soon'};
    if(item.stockStatus==='out-of-stock')return{purchasable:false,reason:'out-of-stock'};
    if(typeof item.price!=='number'||!Number.isFinite(item.price))return{purchasable:false,reason:'price-unavailable'};
    return{purchasable:true,reason:null};
  }

  function normalizeRows(rows){
    if(!Array.isArray(rows))return[];
    const merged=new Map();
    for(const raw of rows){
      if(!raw||typeof raw!=='object')continue;
      const type=String(raw.type||'').trim();
      const slug=String(raw.slug||'').trim();
      if(!type||!slug)continue;
      const item=resolveProduct(type,slug,raw.productId);
      if(!item)continue;
      const quantity=Math.min(maxQuantity,Math.max(1,Math.floor(Number(raw.quantity)||1)));
      const key=String(item.id||type+':'+slug);
      const existing=merged.get(key);
      if(existing)existing.quantity=Math.min(maxQuantity,existing.quantity+quantity);
      else merged.set(key,{productId:item.id||null,type,slug,quantity});
    }
    return[...merged.values()];
  }

  function readEnvelope(){
    const raw=safeParse(storage.getItem(cartKey)||'',null);
    if(raw&&raw.version===1&&Array.isArray(raw.items)){
      const clean=normalizeRows(raw.items);
      if(JSON.stringify(clean)!==JSON.stringify(raw.items))writeItems(clean);
      return{version:1,items:clean};
    }
    return{version:1,items:[]};
  }

  function writeItems(items){
    const clean=normalizeRows(items);
    storage.setItem(cartKey,JSON.stringify({version:1,items:clean}));
    return clean;
  }

  function migrateLegacy(){
    if(storage.getItem(cartKey))return false;
    const legacy=safeParse(storage.getItem(legacyKey)||'[]',[]);
    const clean=normalizeRows(legacy);
    if(!clean.length)return false;
    writeItems(clean);
    try{storage.removeItem(legacyKey)}catch{}
    return true;
  }

  function getItems(){
    migrateLegacy();
    return readEnvelope().items;
  }

  function resolvedItems(){
    return getItems().map(row=>{
      const item=resolveProduct(row.type,row.slug,row.productId);
      if(!item)return null;
      const state=productState(item,row.quantity);
      const unitPrice=typeof item.price==='number'&&Number.isFinite(item.price)?item.price:null;
      return{...row,item,purchasable:state.purchasable,unavailableReason:state.reason,unitPrice,lineTotal:unitPrice===null?null:unitPrice*row.quantity};
    }).filter(Boolean);
  }

  function add(type,slug,quantity=1){
    const item=resolveProduct(type,slug);
    const state=productState(item,quantity);
    if(!item||!state.purchasable)return{ok:false,reason:state.reason,item:item||null};
    const rows=getItems();
    const key=String(item.id||type+':'+slug);
    const existing=rows.find(row=>String(row.productId||row.type+':'+row.slug)===key);
    const addQty=Math.min(maxQuantity,Math.max(1,Math.floor(Number(quantity)||1)));
    if(existing)existing.quantity=Math.min(maxQuantity,existing.quantity+addQty);
    else rows.push({productId:item.id||null,type,slug,quantity:addQty});
    writeItems(rows);
    return{ok:true,item,quantity:(existing?.quantity)||addQty};
  }

  function setQuantity(type,slug,quantity){
    const q=Math.floor(Number(quantity));
    const rows=getItems();
    const row=rows.find(x=>x.type===type&&x.slug===slug);
    if(!row)return false;
    if(!Number.isFinite(q)||q<=0)return remove(type,slug);
    const next=Math.min(maxQuantity,Math.max(1,q));
    const item=resolveProduct(type,slug,row.productId);
    const state=productState(item,next);
    if(!state.purchasable)return false;
    row.quantity=next;
    writeItems(rows);
    return true;
  }

  function change(type,slug,delta){
    const row=getItems().find(x=>x.type===type&&x.slug===slug);
    if(!row)return false;
    return setQuantity(type,slug,row.quantity+Number(delta||0));
  }

  function remove(type,slug){
    const before=getItems();
    const after=before.filter(x=>!(x.type===type&&x.slug===slug));
    writeItems(after);
    return after.length!==before.length;
  }

  function clear(){
    writeItems([]);
  }

  function count(){
    return getItems().reduce((sum,row)=>sum+row.quantity,0);
  }

  function subtotal(){
    return resolvedItems().reduce((sum,row)=>sum+(row.purchasable&&row.lineTotal!==null?row.lineTotal:0),0);
  }

  function canCheckout(){
    const rows=resolvedItems();
    return rows.length>0&&rows.every(row=>row.purchasable);
  }

  return{
    cartKey,
    legacyKey,
    maxQuantity,
    productState,
    migrateLegacy,
    getItems,
    resolvedItems,
    add,
    setQuantity,
    change,
    remove,
    clear,
    count,
    subtotal,
    canCheckout
  };
}
/* CART CORE FACTORY END */

function createLocalCartStore(storage=localStorage){
  return{
    getItem:key=>storage.getItem(key),
    setItem:(key,value)=>storage.setItem(key,value),
    removeItem:key=>storage.removeItem(key)
  };
}
const blackSheepLocalCartStore=createLocalCartStore();
const blackSheepCart=createBlackSheepCartCore(blackSheepLocalCartStore,(type,slug,productId)=>{
  const item=findItem(type,slug);
  if(item&&(!productId||!item.id||item.id===productId))return item;
  if(productId&&window.CATALOG){
    for(const list of Object.values(window.CATALOG)){
      const found=(list||[]).find(x=>x.id===productId);
      if(found)return found;
    }
  }
  return item||null;
});
window.BlackSheepCart=blackSheepCart;

function getBlackSheepList(){return blackSheepCart.getItems()}
function blackSheepListCount(){return blackSheepCart.count()}
function blackSheepUnavailableMessage(reason){
  if(reason==='arriving-soon')return'Awaiting delivery';
  if(reason==='out-of-stock')return'Currently out of stock';
  if(reason==='price-unavailable')return'Price not confirmed';
  if(reason==='not-available-online')return'Not available to order online';
  if(reason==='not-for-sale')return'Not available to order';
  return'Not available to order';
}
function addToBlackSheepList(event,type,slug){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const result=blackSheepCart.add(type,slug,1);
  if(!result.ok){
    showBlackSheepListToast(blackSheepUnavailableMessage(result.reason));
    return;
  }
  updateBlackSheepListUI();
  renderBlackSheepList();
  renderBasketPage();
  const btn=event?.currentTarget;
  if(btn){
    const original='Add to basket';
    btn.classList.add('is-added');
    btn.textContent='Added';
    clearTimeout(btn.__bsAddedTimer);
    btn.__bsAddedTimer=setTimeout(()=>{btn.classList.remove('is-added');btn.textContent=original},1100);
  }
  showBlackSheepListToast(result.item.name+' added to basket');
}
function changeBlackSheepList(type,slug,delta){blackSheepCart.change(type,slug,delta);updateBlackSheepListUI();renderBlackSheepList();renderBasketPage()}
function removeFromBlackSheepList(type,slug){blackSheepCart.remove(type,slug);updateBlackSheepListUI();renderBlackSheepList();renderBasketPage()}
function clearBlackSheepList(){if(blackSheepCart.count()&&!confirm('Clear all items from your basket?'))return;blackSheepCart.clear();updateBlackSheepListUI();renderBlackSheepList();renderBasketPage()}
function openBlackSheepList(){window.__bsListReturnFocus=document.activeElement;const backdrop=document.getElementById('bsListBackdrop');backdrop?.classList.add('open');backdrop?.setAttribute('aria-hidden','false');document.body.classList.add('bs-list-open');renderBlackSheepList();setTimeout(()=>document.querySelector('.bs-list-close')?.focus(),0)}
function closeBlackSheepList(){const backdrop=document.getElementById('bsListBackdrop');backdrop?.classList.remove('open');backdrop?.setAttribute('aria-hidden','true');document.body.classList.remove('bs-list-open');window.__bsListReturnFocus?.focus?.()}
function updateBlackSheepListUI(){const n=blackSheepListCount();document.querySelectorAll('.header-list-count').forEach(el=>el.textContent=String(n));document.querySelectorAll('.header-list-button').forEach(el=>el.setAttribute('aria-label','Basket, '+n+' '+(n===1?'item':'items')))}
function listImageMarkup(item){
  if(item?.img&&!item.imagePending&&!item.placeholder)return'<img src="/images/'+item.img+'" alt="">';
  return'<div class="bs-list-image-placeholder" aria-hidden="true"><span>Image coming soon</span></div>';
}
function renderBlackSheepList(){
  const root=document.getElementById('bsListItems');
  if(!root)return;
  const rows=blackSheepCart.resolvedItems();
  const total=document.getElementById('bsListTotal');
  const subtotal=document.getElementById('bsListSubtotal');
  const note=document.getElementById('bsListCheckoutNote');
  const viewBasket=document.getElementById('bsViewBasket');
  const itemCount=rows.reduce((n,x)=>n+x.quantity,0);
  if(total)total.textContent=itemCount+' '+(itemCount===1?'item':'items');
  if(subtotal)subtotal.textContent=formatPrice(blackSheepCart.subtotal());
  if(note){
    const unavailable=rows.filter(row=>!row.purchasable).length;
    note.textContent=unavailable?unavailable+' '+(unavailable===1?'item needs':'items need')+' attention before checkout.':'Delivery is confirmed before payment.';
  }
  if(viewBasket)viewBasket.classList.toggle('is-disabled',!rows.length);
  if(!rows.length){
    root.innerHTML='<div class="bs-list-empty"><strong>Your basket is empty.</strong><span>Add products while you browse the shop.</span><a href="/all-products.html">Browse the full range →</a></div>';
    return;
  }
  root.innerHTML=rows.map(({type,slug,quantity,item,purchasable,unavailableReason,lineTotal})=>{
    const price=typeof item.price==='number'?formatPrice(item.price):'Price not confirmed';
    const state=purchasable?'':'<span class="bs-list-unavailable">'+blackSheepUnavailableMessage(unavailableReason)+'</span>';
    const line=purchasable&&lineTotal!==null?'<strong class="bs-list-line-total">'+formatPrice(lineTotal)+'</strong>':'';
    return'<article class="bs-list-row">'+listImageMarkup(item)+'<div class="bs-list-copy"><a href="'+itemUrl(item,type)+'">'+item.name+'</a><span>'+price+' each</span>'+state+line+'<div class="bs-list-qty"><button type="button" onclick="changeBlackSheepList(\''+type+'\',\''+slug+'\',-1)" aria-label="Decrease quantity">−</button><strong>'+quantity+'</strong><button type="button" onclick="changeBlackSheepList(\''+type+'\',\''+slug+'\',1)" aria-label="Increase quantity">+</button><button class="bs-list-remove" type="button" onclick="removeFromBlackSheepList(\''+type+'\',\''+slug+'\')">Remove</button></div></div></article>';
  }).join('');
}
function showBlackSheepListToast(message){let toast=document.getElementById('bsListToast');if(!toast){toast=document.createElement('div');toast.id='bsListToast';toast.className='bs-list-toast';document.body.appendChild(toast)}toast.textContent=message;toast.classList.add('show');clearTimeout(window.__bsListToast);window.__bsListToast=setTimeout(()=>toast.classList.remove('show'),1800)}
function trapBlackSheepListFocus(event){
  const backdrop=document.getElementById('bsListBackdrop');
  if(!backdrop?.classList.contains('open'))return;
  if(event.key==='Escape'){event.preventDefault();closeBlackSheepList();return}
  if(event.key!=='Tab')return;
  const focusable=[...backdrop.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hasAttribute('hidden'));
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
function initBlackSheepList(){
  blackSheepCart.migrateLegacy();
  const nav=document.querySelector('.nav');
  if(nav&&!nav.querySelector('.header-list-button')){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='header-list-button';
    btn.onclick=openBlackSheepList;
    btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="header-list-label">Basket</span><span class="header-list-count">0</span>';
    const hamb=nav.querySelector('.hamb');
    nav.insertBefore(btn,hamb||null);
  }
  if(!document.getElementById('bsListBackdrop')){
    document.body.insertAdjacentHTML('beforeend',`<div class="bs-list-backdrop" id="bsListBackdrop" aria-hidden="true" onclick="if(event.target===this)closeBlackSheepList()"><aside class="bs-list-panel" role="dialog" aria-modal="true" aria-labelledby="bsListTitle"><div class="bs-list-head"><div><div class="eyebrow">Shopping basket</div><h2 id="bsListTitle">Your basket</h2><p>Review quantities here. Availability and delivery are confirmed before payment.</p></div><button type="button" class="bs-list-close" onclick="closeBlackSheepList()" aria-label="Close basket">×</button></div><div class="bs-list-summary"><strong id="bsListTotal">0 items</strong><a href="/all-products.html">Continue shopping</a></div><div class="bs-list-items" id="bsListItems"></div><div class="bs-list-order-summary"><span>Subtotal</span><strong id="bsListSubtotal">£0.00</strong><small id="bsListCheckoutNote">Delivery is confirmed before payment.</small></div><div class="bs-list-footer"><a class="btn primary" id="bsViewBasket" href="/basket.html">View basket</a><button type="button" class="btn secondary" onclick="clearBlackSheepList()">Clear basket</button></div></aside></div>`);
  }
  updateBlackSheepListUI();
  renderBlackSheepList();
  document.addEventListener('keydown',trapBlackSheepListFocus);
}
document.addEventListener('DOMContentLoaded',initBlackSheepList);


function basketPageRow(row){
  const {type,slug,quantity,item,purchasable,unavailableReason,lineTotal}=row;
  const state=purchasable?'':'<div class="basket-row-state">'+blackSheepUnavailableMessage(unavailableReason)+'</div>';
  const unit=typeof item.price==='number'?formatPrice(item.price):'Price not confirmed';
  const total=purchasable&&lineTotal!==null?formatPrice(lineTotal):'—';
  return '<article class="basket-page-row">'+
    '<div class="basket-page-media">'+listImageMarkup(item)+'</div>'+
    '<div class="basket-page-product"><a href="'+itemUrl(item,type)+'">'+item.name+'</a><span>'+unit+' each</span>'+state+'</div>'+
    '<div class="basket-page-qty"><button type="button" onclick="changeBlackSheepList(\''+type+'\',\''+slug+'\',-1)" aria-label="Decrease '+item.name+' quantity">−</button><strong>'+quantity+'</strong><button type="button" onclick="changeBlackSheepList(\''+type+'\',\''+slug+'\',1)" aria-label="Increase '+item.name+' quantity">+</button></div>'+
    '<strong class="basket-page-line-total"><span>Line total</span>'+total+'</strong>'+
    '<button class="basket-page-remove" type="button" onclick="removeFromBlackSheepList(\''+type+'\',\''+slug+'\')">Remove</button>'+
  '</article>';
}
function renderBasketPage(){
  const page=document.getElementById('basketPage');
  if(!page)return;
  const root=document.getElementById('basketPageItems');
  const count=document.getElementById('basketPageCount');
  const subtotal=document.getElementById('basketPageSubtotal');
  const continueLink=document.getElementById('basketContinue');
  const attention=document.getElementById('basketAttention');
  const rows=blackSheepCart.resolvedItems();
  const itemCount=rows.reduce((sum,row)=>sum+row.quantity,0);
  if(count)count.textContent=itemCount+' '+(itemCount===1?'item':'items');
  if(subtotal)subtotal.textContent=formatPrice(blackSheepCart.subtotal());
  const unavailable=rows.filter(row=>!row.purchasable);
  if(attention){
    attention.hidden=!unavailable.length;
    attention.textContent=unavailable.length?unavailable.length+' '+(unavailable.length===1?'item needs':'items need')+' attention before you can continue.':'';
  }
  const checkoutReady=document.documentElement.dataset.checkoutReady==='true';
  const canContinue=checkoutReady&&rows.length>0&&blackSheepCart.canCheckout();
  if(continueLink){
    continueLink.classList.toggle('is-disabled',!canContinue);
    continueLink.setAttribute('aria-disabled',canContinue?'false':'true');
    continueLink.tabIndex=canContinue?0:-1;
  }
  if(!rows.length){
    root.innerHTML='<div class="basket-page-empty"><div class="eyebrow">Your basket</div><h2>Nothing here yet.</h2><p>Browse the shop and add the products you would like us to prepare.</p><a class="btn primary" href="/all-products.html">Browse products</a></div>';
    return;
  }
  root.innerHTML=rows.map(basketPageRow).join('');
}
document.addEventListener('DOMContentLoaded',renderBasketPage);


const blackSheepCheckoutDraftKey='black-sheep-checkout-draft-v1';
function checkoutEscape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function getCheckoutDraft(){try{const data=JSON.parse(localStorage.getItem(blackSheepCheckoutDraftKey)||'{}');return data&&typeof data==='object'?data:{}}catch{return{}}}
function saveCheckoutDraft(data){try{localStorage.setItem(blackSheepCheckoutDraftKey,JSON.stringify({fulfilmentMethod:data.fulfilmentMethod==='collection'?'collection':'delivery'}))}catch{}}
function setCheckoutFulfilment(method){
  const delivery=method==='delivery';
  document.getElementById('checkoutDeliveryFields')?.toggleAttribute('hidden',!delivery);
  document.querySelectorAll('#checkoutDeliveryFields input[data-delivery-required]').forEach(input=>input.required=delivery);
}
function checkoutFormData(){
  const form=document.getElementById('checkoutForm');
  if(!form)return null;
  const fd=new FormData(form);
  const fulfilmentMethod=fd.get('fulfilmentMethod')==='collection'?'collection':'delivery';
  const data={
    fulfilmentMethod,
    customerName:String(fd.get('customerName')||'').trim(),
    customerEmail:String(fd.get('customerEmail')||'').trim(),
    customerPhone:String(fd.get('customerPhone')||'').trim(),
    note:String(fd.get('note')||'').trim(),
    deliveryAddress:null
  };
  if(fulfilmentMethod==='delivery'){
    data.deliveryAddress={
      line1:String(fd.get('line1')||'').trim(),
      line2:String(fd.get('line2')||'').trim(),
      town:String(fd.get('town')||'').trim(),
      county:String(fd.get('county')||'').trim(),
      postcode:String(fd.get('postcode')||'').trim().toUpperCase(),
      country:'GB'
    };
  }
  return data;
}
function checkoutReviewItem(row){
  const total=row.purchasable&&row.lineTotal!==null?formatPrice(row.lineTotal):'—';
  return '<div class="checkout-review-item"><span>'+checkoutEscape(row.quantity+' × '+row.item.name)+'</span><strong>'+total+'</strong></div>';
}
function renderCheckoutReview(data){
  const rows=blackSheepCart.resolvedItems();
  document.getElementById('checkoutReviewItems').innerHTML=rows.map(checkoutReviewItem).join('');
  document.getElementById('checkoutReviewSubtotal').textContent=formatPrice(blackSheepCart.subtotal());
  const contact=document.getElementById('checkoutReviewContact');
  contact.innerHTML='<strong>'+checkoutEscape(data.customerName)+'</strong><span>'+checkoutEscape(data.customerEmail)+'</span>'+(data.customerPhone?'<span>'+checkoutEscape(data.customerPhone)+'</span>':'');
  const fulfilment=document.getElementById('checkoutReviewFulfilment');
  if(data.fulfilmentMethod==='collection'){
    fulfilment.innerHTML='<strong>Collection from Ambleside</strong><span>We will confirm when your order is ready.</span>';
  }else{
    const a=data.deliveryAddress;
    fulfilment.innerHTML='<strong>Delivery</strong><span>'+checkoutEscape(a.line1)+'</span>'+(a.line2?'<span>'+checkoutEscape(a.line2)+'</span>':'')+'<span>'+checkoutEscape(a.town)+(a.county?', '+checkoutEscape(a.county):'')+'</span><span>'+checkoutEscape(a.postcode)+'</span><span>United Kingdom</span>';
  }
  const note=document.getElementById('checkoutReviewNote');
  note.hidden=!data.note;
  if(data.note)note.textContent=data.note;
}
function showCheckoutStep(step){
  const details=document.getElementById('checkoutDetailsStep');
  const review=document.getElementById('checkoutReviewStep');
  const isReview=step==='review';
  details.hidden=isReview;
  review.hidden=!isReview;
  document.querySelectorAll('.checkout-progress-step').forEach(el=>el.classList.toggle('active',el.dataset.step===step));
  window.scrollTo({top:0,behavior:'smooth'});
  if(isReview)initCheckoutTurnstile();
}
function reviewCheckout(event){
  event?.preventDefault?.();
  const form=document.getElementById('checkoutForm');
  if(!form?.reportValidity())return;
  const data=checkoutFormData();
  if(!data)return;
  if(!blackSheepCart.canCheckout()){
    const error=document.getElementById('checkoutFormError');
    error.hidden=false;
    error.textContent='Your basket contains an item that cannot currently be ordered. Return to the basket and review it.';
    return;
  }
  document.getElementById('checkoutFormError').hidden=true;
  window.__blackSheepCheckoutData=data;
  saveCheckoutDraft(data);
  renderCheckoutReview(data);
  showCheckoutStep('review');
}
function editCheckout(){showCheckoutStep('details')}
function checkoutTurnstileToken(){
  return document.querySelector('#checkoutTurnstile input[name="cf-turnstile-response"]')?.value||'';
}
function checkoutTurnstileChanged(){
  const submit=document.getElementById('checkoutSubmitRequest');
  if(!submit)return;
  const config=window.BLACK_SHEEP_COMMERCE_CONFIG||{};
  const ready=document.documentElement.dataset.orderSubmitReady==='true'&&config.enabled===true&&Boolean(config.apiBase);
  submit.disabled=!(ready&&checkoutTurnstileToken()&&blackSheepCart.canCheckout());
}
function onCheckoutTurnstileSuccess(){checkoutTurnstileChanged()}
function onCheckoutTurnstileExpired(){checkoutTurnstileChanged()}
function initCheckoutTurnstile(){
  const root=document.getElementById('checkoutTurnstile');
  const config=window.BLACK_SHEEP_COMMERCE_CONFIG||{};
  if(!root)return;
  if(config.enabled!==true||!config.apiBase){
    root.innerHTML='<p class="checkout-security-note">Online ordering is being prepared. No order can be submitted yet.</p>';
    return;
  }
  if(root.dataset.rendered==='1'||!window.turnstile)return;
  const siteKey=root.dataset.sitekey;
  if(!siteKey)return;
  const allowed=['theblacksheepshop.co.uk','www.theblacksheepshop.co.uk','localhost','127.0.0.1'];
  if(!allowed.includes(location.hostname)){
    root.innerHTML='<p class="checkout-security-note">Security verification is enabled on the production shop domain.</p>';
    return;
  }
  window.turnstile.render(root,{
    sitekey:siteKey,
    action:'order_request',
    callback:onCheckoutTurnstileSuccess,
    'expired-callback':onCheckoutTurnstileExpired,
    'error-callback':onCheckoutTurnstileExpired
  });
  root.dataset.rendered='1';
}
const blackSheepOrderIdempotencyKey='black-sheep-order-idempotency-v1';
const blackSheepOrderResultKey='black-sheep-order-result-v1';
function checkoutIdempotencyKey(){
  let key='';
  try{key=sessionStorage.getItem(blackSheepOrderIdempotencyKey)||''}catch{}
  if(!key){
    key=crypto.randomUUID();
    try{sessionStorage.setItem(blackSheepOrderIdempotencyKey,key)}catch{}
  }
  return key;
}
function resetCheckoutTurnstile(){
  try{if(window.turnstile)window.turnstile.reset(document.getElementById('checkoutTurnstile'))}catch{}
  checkoutTurnstileChanged();
}
async function submitCheckoutOrder(){
  const button=document.getElementById('checkoutSubmitRequest');
  const error=document.getElementById('checkoutSubmitError');
  const config=window.BLACK_SHEEP_COMMERCE_CONFIG||{};
  if(!button||button.disabled)return;
  const data=window.__blackSheepCheckoutData||checkoutFormData();
  const token=checkoutTurnstileToken();
  if(!data||!token||!config.apiBase)return;
  const rows=blackSheepCart.resolvedItems();
  if(!rows.length||!blackSheepCart.canCheckout())return;
  const payload={
    turnstileToken:token,
    fulfilmentMethod:data.fulfilmentMethod,
    customer:{name:data.customerName,email:data.customerEmail,phone:data.customerPhone||undefined},
    deliveryAddress:data.deliveryAddress||undefined,
    note:data.note||undefined,
    items:rows.map(row=>({productId:row.item.id,quantity:row.quantity}))
  };
  const original=button.textContent;
  button.disabled=true;
  button.textContent='Sending…';
  button.setAttribute('aria-busy','true');
  if(error){error.hidden=true;error.textContent=''}
  try{
    const response=await fetch(String(config.apiBase).replace(/\/$/,'')+'/v1/orders',{
      method:'POST',
      headers:{'content-type':'application/json','idempotency-key':checkoutIdempotencyKey()},
      body:JSON.stringify(payload)
    });
    let result={};
    try{result=await response.json()}catch{}
    if(!response.ok){
      const message=result?.error?.message||'We could not send your order request. Please try again.';
      if(error){error.hidden=false;error.textContent=message}
      resetCheckoutTurnstile();
      return;
    }
    const snapshot={
      reference:result?.order?.reference||'',
      status:result?.order?.status||'SUBMITTED',
      createdAt:result?.order?.createdAt||new Date().toISOString(),
      currency:result?.order?.currency||'GBP',
      itemsSubtotalMinor:result?.order?.itemsSubtotalMinor??Math.round(blackSheepCart.subtotal()*100),
      fulfilmentMethod:result?.order?.fulfilmentMethod||data.fulfilmentMethod,
      items:result?.order?.items||rows.map(row=>({productId:row.item.id,name:row.item.name,quantity:row.quantity,unitPriceMinor:Math.round((row.item.price||0)*100),lineTotalMinor:Math.round((row.lineTotal||0)*100)}))
    };
    try{sessionStorage.setItem(blackSheepOrderResultKey,JSON.stringify(snapshot));sessionStorage.removeItem(blackSheepOrderIdempotencyKey)}catch{}
    try{localStorage.removeItem(blackSheepCheckoutDraftKey)}catch{}
    blackSheepCart.clear();
    updateBlackSheepListUI();
    location.href='/order-requested.html?ref='+encodeURIComponent(snapshot.reference);
  }catch{
    if(error){error.hidden=false;error.textContent='We could not reach the order service. Your basket is safe — please try again.'}
    resetCheckoutTurnstile();
  }finally{
    button.removeAttribute('aria-busy');
    if(document.contains(button)){button.textContent=original;checkoutTurnstileChanged()}
  }
}
function initCheckoutPage(){
  const page=document.getElementById('checkoutPage');
  if(!page)return;
  const guard=document.getElementById('checkoutGuard');
  const flow=document.getElementById('checkoutFlow');
  if(!blackSheepCart.resolvedItems().length||!blackSheepCart.canCheckout()){
    guard.hidden=false;
    flow.hidden=true;
    return;
  }
  guard.hidden=true;
  flow.hidden=false;
  const draft=getCheckoutDraft();
  const method=draft.fulfilmentMethod==='collection'?'collection':'delivery';
  const input=document.querySelector('input[name="fulfilmentMethod"][value="'+method+'"]');
  if(input)input.checked=true;
  setCheckoutFulfilment(method);
  document.querySelectorAll('input[name="fulfilmentMethod"]').forEach(el=>el.addEventListener('change',()=>{setCheckoutFulfilment(el.value);saveCheckoutDraft({fulfilmentMethod:el.value})}));
  document.getElementById('checkoutForm')?.addEventListener('submit',reviewCheckout);
  document.getElementById('checkoutSubmitRequest')?.addEventListener('click',submitCheckoutOrder);
  checkoutTurnstileChanged();
}
document.addEventListener('DOMContentLoaded',initCheckoutPage);

function initOrderRequestedPage(){
  const root=document.getElementById('orderRequestedPage');
  if(!root)return;
  let snapshot=null;
  try{snapshot=JSON.parse(sessionStorage.getItem(blackSheepOrderResultKey)||'null')}catch{}
  const queryRef=new URLSearchParams(location.search).get('ref')||'';
  const reference=snapshot?.reference||queryRef;
  document.getElementById('orderRequestedReference').textContent=reference||'Request received';
  if(snapshot){
    document.getElementById('orderRequestedSubtotal').textContent='£'+(Number(snapshot.itemsSubtotalMinor||0)/100).toFixed(2);
    document.getElementById('orderRequestedMethod').textContent=snapshot.fulfilmentMethod==='collection'?'Collection':'Delivery';
    document.getElementById('orderRequestedItems').innerHTML=(snapshot.items||[]).map(item=>'<div class="order-requested-item"><span>'+checkoutEscape(item.quantity+' × '+item.name)+'</span><strong>£'+(Number(item.lineTotalMinor||0)/100).toFixed(2)+'</strong></div>').join('');
  }
}
document.addEventListener('DOMContentLoaded',initOrderRequestedPage);


function initCommerceLegalFooter(){
  document.querySelectorAll('footer .wrap').forEach(wrap=>{
    if(wrap.querySelector('.footer-legal'))return;
    const legal=document.createElement('nav');
    legal.className='footer-legal';
    legal.setAttribute('aria-label','Legal and customer information');
    legal.innerHTML='<a href="/privacy.html">Privacy</a><a href="/delivery-returns.html">Delivery & returns</a><a href="/terms.html">Terms</a>';
    const copyright=wrap.querySelector('.copyright');
    wrap.insertBefore(legal,copyright||null);
  });
}
document.addEventListener('DOMContentLoaded',initCommerceLegalFooter);


/* PHASE 6 LIVE COMMERCE OVERLAY LOADER START */
const blackSheepCommercePreviewKey='black-sheep-commerce-preview-v1';
function blackSheepLiveCommerceConfig(){
  const params=new URLSearchParams(location.search);
  const requested=params.get('commerce-preview');
  try{
    if(requested==='staging')sessionStorage.setItem(blackSheepCommercePreviewKey,'staging');
    else if(requested==='off')sessionStorage.removeItem(blackSheepCommercePreviewKey);
  }catch{}
  let preview='';
  try{preview=sessionStorage.getItem(blackSheepCommercePreviewKey)||''}catch{}
  if(preview==='staging'){
    return{
      enabled:true,
      preview:true,
      mode:'staging',
      apiBase:'https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev'
    };
  }
  const config=window.BLACK_SHEEP_COMMERCE_CONFIG||{};
  if(config.liveCatalog===true&&config.apiBase){
    return{
      enabled:true,
      preview:false,
      mode:'live',
      apiBase:String(config.apiBase)
    };
  }
  return{enabled:false,preview:false,mode:'static',apiBase:''};
}
function loadBlackSheepLiveCommerceOverlay(){
  const config=blackSheepLiveCommerceConfig();
  window.BLACK_SHEEP_LIVE_COMMERCE=config;
  if(!config.enabled||!config.apiBase)return;
  if(document.querySelector('script[data-black-sheep-live-commerce]'))return;
  const script=document.createElement('script');
  script.src='/assets/commerce-live.js';
  script.async=true;
  script.dataset.blackSheepLiveCommerce='1';
  document.head.appendChild(script);
}
document.addEventListener('DOMContentLoaded',loadBlackSheepLiveCommerceOverlay);
/* PHASE 6 LIVE COMMERCE OVERLAY LOADER END */
