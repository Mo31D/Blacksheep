
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
function card(item,type){const url=itemUrl(item,type);const brand=item.brand?`<span class="brand-line">${item.brand}</span>`:'';const cats=cardCategories(item,type);const fit=item.imageFit==='contain'?' contain':'';const ph=item.placeholder===true;const out=item.stockStatus==='out-of-stock'&&item.availabilityStatus!=='arriving-soon';const arrivingSoon=item.availabilityStatus==='arriving-soon';const media=ph||!item.img?`<a class="product-img contain product-img--placeholder" href="${url}" aria-label="${item.name}"><span class="product-placeholder-media" aria-hidden="true"><strong>${ph?'Image coming soon':'Product image being added'}</strong><small>${item.sku||''}</small></span></a>`:`<a class="product-img${fit}" href="${url}" aria-label="${item.name}"><img loading="lazy" src="images/${item.img}" alt="${item.name}"></a>`;const price=typeof item.price==='number'?`<span class="product-price">${formatPrice(item.price)}</span>`:'<span class="product-price product-price--ask">Ask in store</span>';const state=arrivingSoon?'<span class="stock-card-label arriving-soon">Arriving soon</span>':(out?'<span class="stock-card-label">Out of stock</span>':'');return `<article class="product-card${out?' is-out-of-stock':''}${ph?' is-placeholder':''}" data-url="${url}" role="link" tabindex="0" data-categories="${cats.join(' ')}" data-name="${(item.name+' '+item.label+' '+(item.brand||'')+' '+(item.sku||'')).toLowerCase()}">${media}<div class="product-info"><div class="kicker">${item.label}</div><a class="product-title" href="${url}">${item.name}</a>${brand}<p class="product-desc">${item.desc}</p><div class="product-buyline">${price}${state}</div><div class="card-actions"><button class="list-add" type="button" aria-label="Add ${item.name} to basket" onclick="addToBlackSheepList(event,'${type}','${item.slug}')">Add to basket</button></div></div></article>`}

function syncCatalogCardState(root=document){if(!window.CATALOG)return;const bySlug=new Map();Object.values(window.CATALOG).forEach(list=>(list||[]).forEach(item=>bySlug.set(item.slug,item)));root.querySelectorAll('.product-card').forEach(card=>{const href=card.dataset.url||card.querySelector('.product-title,.product-img')?.getAttribute('href')||'';const m=href.match(/\/products\/([^/?#]+)\.html/);const item=m?bySlug.get(decodeURIComponent(m[1])):null;if(!item)return;const buy=card.querySelector('.product-buyline');const meta=card.querySelector('.product-meta');let priceEl=card.querySelector('.product-price');if(typeof item.price==='number'){const val=formatPrice(item.price);if(priceEl){priceEl.className='product-price';priceEl.textContent=val}else if(buy)buy.insertAdjacentHTML('afterbegin','<span class="product-price">'+val+'</span>');else if(meta)meta.insertAdjacentHTML('afterbegin','<span class="product-price">'+val+'</span>')}card.querySelectorAll('.stock-card-label,.availability-card-label').forEach(el=>el.remove());const arrivingSoon=item.availabilityStatus==='arriving-soon';const out=item.stockStatus==='out-of-stock'&&!arrivingSoon;card.classList.toggle('is-out-of-stock',out);if(buy&&arrivingSoon)buy.insertAdjacentHTML('beforeend','<span class="stock-card-label arriving-soon">Arriving soon</span>');else if(buy&&out)buy.insertAdjacentHTML('beforeend','<span class="stock-card-label">Out of stock</span>')})}

function productAvailabilityRank(item){if(!item)return 0;if(item.availabilityStatus==='arriving-soon')return 1;if(item.stockStatus==='out-of-stock')return 2;return 0}
function sortProductCardsByAvailability(root=document){if(!window.CATALOG)return;const bySlug=new Map();Object.values(window.CATALOG).forEach(list=>(list||[]).forEach(item=>bySlug.set(item.slug,item)));const parents=new Set();root.querySelectorAll('.product-card').forEach(card=>{if(card.parentElement)parents.add(card.parentElement)});parents.forEach(parent=>{const cards=[...parent.children].filter(el=>el.classList?.contains('product-card'));if(cards.length<2)return;const ranked=cards.map((card,index)=>{const href=card.dataset.url||card.querySelector('.product-title,.product-img')?.getAttribute('href')||'';const m=href.match(/\/products\/([^/?#]+)\.html/);const item=m?bySlug.get(decodeURIComponent(m[1])):null;return{card,index,rank:productAvailabilityRank(item)}});ranked.sort((a,b)=>a.rank-b.rank||a.index-b.index);if(ranked.every((x,i)=>x.card===cards[i]))return;const marker=document.createComment('availability-order');parent.insertBefore(marker,cards[0]);const frag=document.createDocumentFragment();ranked.forEach(x=>frag.appendChild(x.card));marker.after(frag);marker.remove()})}
function wireProductCards(root=document){root.querySelectorAll('.product-card').forEach(card=>{const href=card.dataset.url||card.querySelector('.product-title,.product-img')?.getAttribute('href');if(!href)return;card.dataset.url=href;card.setAttribute('role','link');if(!card.hasAttribute('tabindex'))card.tabIndex=0;if(card.dataset.cardWired==='1')return;card.dataset.cardWired='1';card.addEventListener('click',e=>{if(e.target.closest('a,button,input,select,textarea,label'))return;location.href=href});card.addEventListener('keydown',e=>{if(e.target!==card)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();location.href=href}})})}
function polishListButtons(root=document){root.querySelectorAll('.list-add,.list-detail-add').forEach(btn=>{if(btn.dataset.listButtonReady==='1')return;btn.dataset.listButtonReady='1';btn.textContent='Add to basket';const name=btn.closest('.product-card')?.querySelector('.product-title')?.textContent?.trim()||btn.closest('.detail-copy')?.querySelector('h1')?.textContent?.trim();btn.setAttribute('aria-label',name?'Add '+name+' to basket':'Add product to basket')})}
function polishProductDetails(){document.querySelectorAll('.romneys-detail .info-row').forEach(row=>{const label=row.querySelector('strong')?.textContent.trim().toLowerCase();const value=row.querySelector('span');if(!label)return;if(label==='black sheep price'||label==='price'){if(document.querySelector('.romneys-price'))row.remove();return}if(label==='availability'&&value)value.textContent=row.classList.contains('stock-row')?'Out of stock':'Check in store'});const rows=[...document.querySelectorAll('.romneys-detail .info-row')];const brand=rows.find(r=>r.querySelector('strong')?.textContent.trim().toLowerCase()==='brand')?.querySelector('span')?.textContent.trim();const manufacturer=rows.find(r=>r.querySelector('strong')?.textContent.trim().toLowerCase()==='manufacturer');if(brand&&manufacturer?.querySelector('span')?.textContent.trim()===brand)manufacturer.remove();document.querySelectorAll('.romneys-verified-note').forEach(el=>el.remove())}
document.addEventListener('DOMContentLoaded',()=>{wireProductCards();syncCatalogCardState();sortProductCardsByAvailability();polishListButtons();polishProductDetails()});
function renderRomneysRange(rootId='catalog'){const root=document.getElementById(rootId);if(!root||!window.CATALOG)return;if(root.querySelector('.product-card')){initFilters();return}const romneys=(window.CATALOG.romneys||[]).map(x=>({item:x,type:'romneys'}));const own=(window.CATALOG.gifts||[]).filter(x=>(x.categories||[]).includes('local-food')).map(x=>({item:x,type:'gifts'}));root.innerHTML=[...romneys,...own].map(x=>card(x.item,x.type)).join('');initFilters()}
function renderAllProducts(rootId='catalog'){const root=document.getElementById(rootId);if(!root||!window.CATALOG)return;if(root.querySelector('.product-card')){initFilters();return}const rows=[];for(const type of ['gifts','icecream','romneys','hawkshead','fragrances'])for(const item of (window.CATALOG[type]||[]))rows.push({item,type});root.innerHTML=rows.map(x=>card(x.item,x.type)).join('');initFilters()}
function normalizeFoodNavigation(){document.querySelectorAll('a[href="gifts-local-food.html"]').forEach(a=>a.remove());document.querySelectorAll('a[href="gifts-seasonal.html"]').forEach(a=>{const strong=a.querySelector('strong');if(strong){strong.textContent='Christmas';const sub=a.querySelector('span');if(sub)sub.textContent='Baubles, Peter Rabbit & festive Highland Cows'}else if(!a.classList.contains('card-link'))a.textContent='Christmas'});if(/(^|\/)gifts-local-food\.html$/.test(location.pathname))location.replace('romneys.html')}
document.addEventListener('DOMContentLoaded',normalizeFoodNavigation);
function renderCatalog(type,category){const root=document.getElementById('catalog');if(!root||!window.CATALOG)return;if(root.querySelector('.product-card')){initFilters();return}const items=window.CATALOG[type]||[];root.innerHTML=items.filter(x=>!category||(x.categories||[]).includes(category)).map(x=>card(x,type)).join('');initFilters()}
function renderFeatured(rootId, type, slugs){const root=document.getElementById(rootId);if(!root)return;const items=window.CATALOG[type]||[];let list=[];if(slugs&&slugs.length) list=slugs.map(s=>items.find(x=>x.slug===s)).filter(Boolean);else list=items.slice(0,4);root.innerHTML=list.map(x=>card(x,type)).join('');wireProductCards(root);syncCatalogCardState(root);sortProductCardsByAvailability(root);polishListButtons(root)}
function initFilters(){wireProductCards();syncCatalogCardState();sortProductCardsByAvailability();polishListButtons();const search=document.getElementById('search');const chips=[...document.querySelectorAll('.chip[data-filter]')];const cards=[...document.querySelectorAll('.product-card')];const empty=document.getElementById('empty');const count=document.getElementById('giftCount');let active='all';function apply(){const q=(search?.value||'').trim().toLowerCase();let n=0;cards.forEach(c=>{const okCat=active==='all'||c.dataset.categories.split(' ').includes(active);const okQ=!q||c.dataset.name.includes(q);const show=okCat&&okQ;c.style.display=show?'flex':'none';if(show)n++});if(empty)empty.style.display=n?'none':'block';if(count)count.textContent=n+' '+(n===1?'product':'products')}search?.addEventListener('input',apply);chips.forEach(ch=>ch.addEventListener('click',()=>{chips.forEach(x=>x.classList.remove('active'));ch.classList.add('active');active=ch.dataset.filter;apply()}));apply()}
function findItem(type,slug){return (window.CATALOG[type]||[]).find(x=>x.slug===slug)}
function backFor(item,type){if(type==='icecream')return 'icecream.html';if(type==='romneys')return 'romneys.html';if(type==='hawkshead')return 'hawkshead-relish.html';if(type==='fragrances')return 'lakeland-fragrances.html';const map={'peter-rabbit':'gifts-peter-rabbit.html','highland-cows':'gifts-highland-cows.html','fridge-magnets':'gifts-fridge-magnets.html','mugs':'gifts-mugs.html','souvenirs':'gifts-souvenirs.html','soft-toys':'gifts-soft-toys.html','cards':'gifts-cards.html','seasonal':'gifts-seasonal.html','keyrings-badges':'gifts-keyrings-badges.html','maps-books-jigsaws':'gifts-maps-books-jigsaws.html','local-food':'romneys.html','home-gifts':'gifts-home-art.html','toys-games':'gifts-toys-games.html'};for(const c of (item.categories||[])){if(map[c])return map[c]}return 'gifts.html'}
function detailMedia(item){const images=(item.gallery&&item.gallery.length?item.gallery:[{src:item.img,alt:item.name}]);const fit=item.imageFit==='contain'?' contain':'';if(images.length===1)return `<div class="detail-media${fit}"><img src="images/${images[0].src}" alt="${images[0].alt||item.name}"></div>`;return `<div class="detail-media detail-gallery${fit}" aria-label="${item.name} product images"><div class="detail-gallery-track">${images.map(x=>`<div class="detail-gallery-slide ${x.fit==='cover'?'cover':'contain'}"><img src="images/${x.src}" alt="${x.alt||item.name}"></div>`).join('')}</div></div>`}
function renderDetail(){const root=document.getElementById('detail');if(!root||!window.CATALOG)return;const p=new URLSearchParams(location.search),type=p.get('type')||'gifts',slug=p.get('slug');const item=findItem(type,slug);if(!item){root.innerHTML='<div class="wrap"><div class="notice"><strong>Product not found.</strong> Return to the catalogue.</div></div>';return}document.title=item.name+' | The Black Sheep Shop';const metaDescription=(item.desc||'Product details from The Black Sheep Shop in Ambleside.').replace(/\s+/g,' ').trim().slice(0,160);document.querySelector('meta[name="description"]')?.setAttribute('content',metaDescription);document.querySelector('meta[property="og:title"]')?.setAttribute('content',item.name+' | The Black Sheep Shop');document.querySelector('meta[property="og:description"]')?.setAttribute('content',metaDescription);document.querySelector('meta[property="og:image"]')?.setAttribute('content',new URL('images/'+item.img,location.href).href);let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=location.href.split('#')[0];const rows=[];if(item.brand)rows.push(`<div class="info-row"><strong>Brand</strong><span>${item.brand}</span></div>`);if(typeof item.price==='number')rows.push(`<div class="info-row"><strong>Price</strong><span class="detail-price">${formatPrice(item.price)}</span></div>`);if(item.sku)rows.push(`<div class="info-row"><strong>Product code</strong><span>${item.sku}</span></div>`);if(item.range)rows.push(`<div class="info-row"><strong>Range</strong><span>${item.range}</span></div>`);if(item.dimensions)rows.push(`<div class="info-row"><strong>Dimensions</strong><span>${item.dimensions}</span></div>`);if(item.material)rows.push(`<div class="info-row"><strong>Material</strong><span>${item.material}</span></div>`);if(item.packaging)rows.push(`<div class="info-row"><strong>Packaging</strong><span>${item.packaging}</span></div>`);if(item.suitability)rows.push(`<div class="info-row"><strong>Suitable for</strong><span>${item.suitability}</span></div>`);if(item.care)rows.push(`<div class="info-row"><strong>Care</strong><span>${item.care}</span></div>`);root.innerHTML=`<div class="wrap detail-layout">${detailMedia(item)}<div class="detail-copy"><div class="eyebrow">${item.label}</div><h1>${item.name}</h1><p>${item.desc}</p><div class="info-list">${rows.join('')}<div class="info-row"><strong>Availability</strong><span>In-store stock changes regularly. Please visit or contact us to check availability.</span></div>${item.range?'':`<div class="info-row"><strong>Collection</strong><span>${item.label}</span></div>`}${item.note?'<div class="info-row"><strong>Range note</strong><span>'+item.note+'</span></div>':''}</div>${type==='icecream'?'<div class="notice"><strong>Allergies and intolerances:</strong> recipes and supplier information can change. Please ask us for current product and allergen information before ordering.</div>':''}<div class="actions"><button class="btn primary list-detail-add" type="button" onclick="addToBlackSheepList(event,'${type}','${item.slug}')">Add to basket</button><a class="btn secondary" href="visit.html">Visit the shop</a><a class="btn secondary" href="${backFor(item,type)}">Back to collection</a></div></div></div>`}


/* CART CORE FACTORY START */
function createBlackSheepCartCore(storage,resolveProduct){
  const cartKey='black-sheep-cart-v1';
  const legacyKey='black-sheep-previsit-list-v1';
  const maxQuantity=99;

  function safeParse(value,fallback){
    try{return JSON.parse(value)}catch{return fallback}
  }

  function productState(item){
    if(!item)return{purchasable:false,reason:'missing-product'};
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
      const state=productState(item);
      const unitPrice=typeof item.price==='number'&&Number.isFinite(item.price)?item.price:null;
      return{...row,item,purchasable:state.purchasable,unavailableReason:state.reason,unitPrice,lineTotal:unitPrice===null?null:unitPrice*row.quantity};
    }).filter(Boolean);
  }

  function add(type,slug,quantity=1){
    const item=resolveProduct(type,slug);
    const state=productState(item);
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
    row.quantity=Math.min(maxQuantity,Math.max(1,q));
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
  return'Not available to order';
}
function basketEscape(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function basketItemCountLabel(count){return count+' '+(count===1?'item':'items')}
function basketProductImageMarkup(item,type){
  const href=itemUrl(item,type);
  if(item?.img&&!item.imagePending&&!item.placeholder){
    return '<a class="bs-list-media" href="'+href+'" aria-label="View '+basketEscape(item.name)+'"><img data-basket-image src="/images/'+basketEscape(item.img)+'" alt=""><span class="bs-list-image-placeholder" hidden aria-hidden="true">Image unavailable</span></a>';
  }
  return '<a class="bs-list-media" href="'+href+'" aria-label="View '+basketEscape(item?.name||'product')+'"><span class="bs-list-image-placeholder" aria-hidden="true">Image coming soon</span></a>';
}
function wireBasketImages(root=document){
  root.querySelectorAll('img[data-basket-image]').forEach(img=>{
    if(img.dataset.basketImageReady==='1')return;
    img.dataset.basketImageReady='1';
    img.addEventListener('error',()=>{
      img.hidden=true;
      const fallback=img.nextElementSibling;
      if(fallback)fallback.hidden=false;
    },{once:true});
  });
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
  renderBlackSheepBasketPage();
  const btn=event?.currentTarget;
  if(btn?.classList?.contains('list-add')||btn?.classList?.contains('list-detail-add')){
    const original='Add to basket';
    btn.classList.add('is-added');
    btn.textContent='Added';
    clearTimeout(btn.__bsAddedTimer);
    btn.__bsAddedTimer=setTimeout(()=>{btn.classList.remove('is-added');btn.textContent=original},1100);
  }
  showBlackSheepListToast(result.item.name+' added to basket');
}
function changeBlackSheepList(type,slug,delta){
  blackSheepCart.change(type,slug,delta);
  updateBlackSheepListUI();
  renderBlackSheepList();
  renderBlackSheepBasketPage();
}
function removeFromBlackSheepList(type,slug){
  blackSheepCart.remove(type,slug);
  updateBlackSheepListUI();
  renderBlackSheepList();
  renderBlackSheepBasketPage();
  showBlackSheepListToast('Removed from basket');
}
function clearBlackSheepList(force=false){
  if(!force&&blackSheepCart.count()>0&&!window.confirm('Clear your basket?'))return false;
  blackSheepCart.clear();
  updateBlackSheepListUI();
  renderBlackSheepList();
  renderBlackSheepBasketPage();
  showBlackSheepListToast('Basket cleared');
  return true;
}
function blackSheepBasketFocusable(panel){
  if(!panel)return[];
  return [...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(el=>!el.hidden&&el.getAttribute('aria-hidden')!=='true');
}
function blackSheepBasketKeydown(event){
  const backdrop=document.getElementById('bsListBackdrop');
  if(!backdrop?.classList.contains('open'))return;
  if(event.key==='Escape'){event.preventDefault();closeBlackSheepList();return}
  if(event.key!=='Tab')return;
  const panel=backdrop.querySelector('.bs-list-panel');
  const focusable=blackSheepBasketFocusable(panel);
  if(!focusable.length){event.preventDefault();panel?.focus();return}
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
function openBlackSheepList(){
  window.__bsListReturnFocus=document.activeElement;
  const backdrop=document.getElementById('bsListBackdrop');
  backdrop?.classList.add('open');
  backdrop?.setAttribute('aria-hidden','false');
  document.body.classList.add('bs-list-open');
  renderBlackSheepList();
  setTimeout(()=>document.querySelector('.bs-list-close')?.focus(),0);
}
function closeBlackSheepList(){
  const backdrop=document.getElementById('bsListBackdrop');
  if(!backdrop?.classList.contains('open'))return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden','true');
  document.body.classList.remove('bs-list-open');
  window.__bsListReturnFocus?.focus?.();
}
function updateBlackSheepListUI(){
  const n=blackSheepListCount();
  document.querySelectorAll('.header-list-count').forEach(el=>el.textContent=String(n));
  document.querySelectorAll('.header-list-button').forEach(el=>{
    el.setAttribute('aria-label','Basket, '+basketItemCountLabel(n));
    el.setAttribute('title','Basket');
  });
  const live=document.getElementById('bsBasketLive');
  if(live)live.textContent='Basket updated. '+basketItemCountLabel(n)+'.';
}
function renderBlackSheepList(){
  const root=document.getElementById('bsListItems');
  if(!root)return;
  const rows=blackSheepCart.resolvedItems();
  const count=rows.reduce((n,x)=>n+x.quantity,0);
  const total=document.getElementById('bsListTotal');
  const subtotal=document.getElementById('bsBasketSubtotal');
  const note=document.getElementById('bsBasketNote');
  const view=document.getElementById('bsViewBasket');
  if(total)total.textContent=basketItemCountLabel(count);
  if(subtotal)subtotal.textContent=formatPrice(blackSheepCart.subtotal());
  if(view){
    view.setAttribute('aria-disabled',rows.length?'false':'true');
    view.classList.toggle('is-disabled',!rows.length);
    view.tabIndex=rows.length?0:-1;
  }
  if(!rows.length){
    root.innerHTML='<div class="bs-list-empty"><strong>Your basket is empty.</strong><span>Add something from the shop range to get started.</span><a href="/all-products.html">Browse the full range →</a></div>';
    if(note)note.textContent='No payment is taken from the basket.';
    return;
  }
  const blocked=rows.filter(row=>!row.purchasable).length;
  if(note)note.textContent=blocked?blocked+' '+(blocked===1?'item needs':'items need')+' attention before checkout.':'Delivery or collection will be confirmed before payment.';
  root.innerHTML=rows.map(({type,slug,quantity,item,purchasable,unavailableReason,unitPrice,lineTotal})=>{
    const unit=unitPrice===null?'Price not confirmed':formatPrice(unitPrice);
    const line=lineTotal===null?'—':formatPrice(lineTotal);
    const state=purchasable?'':'<span class="bs-list-unavailable">'+blackSheepUnavailableMessage(unavailableReason)+'</span>';
    return '<article class="bs-list-row">'+basketProductImageMarkup(item,type)+'<div class="bs-list-copy"><a href="'+itemUrl(item,type)+'">'+basketEscape(item.name)+'</a><div class="bs-list-pricing"><span>'+unit+' each</span><strong>'+line+'</strong></div>'+state+'<div class="bs-list-qty"><button type="button" onclick="changeBlackSheepList(\''+type+'\',\''+slug+'\',-1)" aria-label="Decrease '+basketEscape(item.name)+' quantity">−</button><strong aria-label="Quantity">'+quantity+'</strong><button type="button" onclick="changeBlackSheepList(\''+type+'\',\''+slug+'\',1)" aria-label="Increase '+basketEscape(item.name)+' quantity">+</button><button class="bs-list-remove" type="button" onclick="removeFromBlackSheepList(\''+type+'\',\''+slug+'\')" aria-label="Remove '+basketEscape(item.name)+' from basket">Remove</button></div></div></article>';
  }).join('');
  wireBasketImages(root);
}
function showBlackSheepListToast(message){
  let toast=document.getElementById('bsListToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='bsListToast';
    toast.className='bs-list-toast';
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    document.body.appendChild(toast);
  }
  toast.textContent=message;
  toast.classList.add('show');
  clearTimeout(window.__bsListToast);
  window.__bsListToast=setTimeout(()=>toast.classList.remove('show'),1800);
}
function basketPageRowMarkup(row){
  const {type,slug,quantity,item,purchasable,unavailableReason,unitPrice,lineTotal}=row;
  const unit=unitPrice===null?'Price not confirmed':formatPrice(unitPrice);
  const line=lineTotal===null?'—':formatPrice(lineTotal);
  const state=purchasable?'':'<span class="basket-page-warning">'+blackSheepUnavailableMessage(unavailableReason)+'</span>';
  return '<article class="basket-page-row">'+basketProductImageMarkup(item,type)+'<div class="basket-page-product"><div><a class="basket-page-name" href="'+itemUrl(item,type)+'">'+basketEscape(item.name)+'</a><span class="basket-page-unit">'+unit+' each</span>'+state+'</div><div class="basket-page-controls"><div class="bs-list-qty"><button type="button" onclick="changeBlackSheepList(\''+type+'\',\''+slug+'\',-1)" aria-label="Decrease '+basketEscape(item.name)+' quantity">−</button><strong aria-label="Quantity">'+quantity+'</strong><button type="button" onclick="changeBlackSheepList(\''+type+'\',\''+slug+'\',1)" aria-label="Increase '+basketEscape(item.name)+' quantity">+</button></div><button class="basket-page-remove" type="button" onclick="removeFromBlackSheepList(\''+type+'\',\''+slug+'\')">Remove</button></div></div><strong class="basket-page-line-total">'+line+'</strong></article>';
}
function renderBlackSheepBasketPage(){
  const root=document.getElementById('basketPageItems');
  if(!root)return;
  const rows=blackSheepCart.resolvedItems();
  const count=rows.reduce((n,x)=>n+x.quantity,0);
  const countEl=document.getElementById('basketPageCount');
  const subtotalEl=document.getElementById('basketPageSubtotal');
  const statusEl=document.getElementById('basketPageStatus');
  if(countEl)countEl.textContent=basketItemCountLabel(count);
  if(subtotalEl)subtotalEl.textContent=formatPrice(blackSheepCart.subtotal());
  if(!rows.length){
    root.innerHTML='<div class="basket-page-empty"><div class="eyebrow">Your basket</div><h2>Nothing here yet.</h2><p>Browse the range and add products you would like to order.</p><a class="btn primary" href="/all-products.html">Browse products</a></div>';
    if(statusEl)statusEl.textContent='Add products to see your basket summary.';
    return;
  }
  root.innerHTML=rows.map(basketPageRowMarkup).join('');
  const blocked=rows.filter(row=>!row.purchasable).length;
  if(statusEl)statusEl.textContent=blocked?'Please remove or update unavailable items before checkout.':'Delivery or collection is selected at checkout. No payment is taken from this page.';
  wireBasketImages(root);
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
    document.body.insertAdjacentHTML('beforeend','<div class="bs-list-backdrop" id="bsListBackdrop" aria-hidden="true" onclick="if(event.target===this)closeBlackSheepList()"><aside class="bs-list-panel" role="dialog" aria-modal="true" aria-labelledby="bsListTitle" tabindex="-1"><div class="bs-list-head"><div><div class="eyebrow">Your order</div><h2 id="bsListTitle">Basket</h2><p>Review quantities and prices before continuing.</p></div><button type="button" class="bs-list-close" onclick="closeBlackSheepList()" aria-label="Close basket">×</button></div><div class="bs-list-summary"><strong id="bsListTotal">0 items</strong><a href="/all-products.html">Continue shopping</a></div><div class="bs-list-items" id="bsListItems"></div><div class="bs-list-bill"><div><span>Subtotal</span><strong id="bsBasketSubtotal">£0.00</strong></div><p id="bsBasketNote">No payment is taken from the basket.</p></div><div class="bs-list-footer"><a class="btn primary bs-view-basket" id="bsViewBasket" href="/basket.html">View basket</a><button type="button" class="btn secondary" onclick="clearBlackSheepList()">Clear basket</button></div><div class="sr-only" id="bsBasketLive" aria-live="polite"></div></aside></div>');
  }
  updateBlackSheepListUI();
  renderBlackSheepBasketPage();
  document.addEventListener('keydown',blackSheepBasketKeydown);
  window.addEventListener('storage',event=>{
    if(event.key===blackSheepCart.cartKey){
      updateBlackSheepListUI();
      renderBlackSheepList();
      renderBlackSheepBasketPage();
    }
  });
}
document.addEventListener('DOMContentLoaded',initBlackSheepList);
