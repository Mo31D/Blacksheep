(function(){
  const config=window.BLACK_SHEEP_LIVE_COMMERCE||{};
  if(config.enabled!==true||!config.apiBase||!window.CATALOG)return;

  const apiBase=String(config.apiBase).replace(/\/$/,'');
  const normalizeReason=value=>String(value||'');
  const supportedTypes=new Set(['gifts','icecream','romneys','hawkshead','fragrances']);
  const normalizeType=value=>supportedTypes.has(String(value||'').toLowerCase())?String(value).toLowerCase():'gifts';
  const titleFromSlug=value=>String(value||'').split('-').filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');
  const labelForProduct=(product,type)=>{
    if(type==='hawkshead')return'Hawkshead Relish';
    if(type==='romneys')return"Romney's";
    if(type==='icecream')return'Ice Cream';
    if(type==='fragrances')return'Fragrances';
    return titleFromSlug(product.primaryCategory)||product.brand||'Gifts';
  };
  const mediaUrl=value=>{
    if(!value)return'';
    try{return new URL(String(value),apiBase+'/').href}catch{return String(value)}
  };
  const catalogItems=()=>{
    const rows=[];
    for(const [type,list] of Object.entries(window.CATALOG||{})){
      for(const item of list||[])rows.push({type,item});
    }
    return rows;
  };

  function applyLiveProduct(item,product){
    item.commerceLive=true;
    item.commercePurchasable=product.purchasable===true;
    item.commerceUnavailableReason=normalizeReason(product.nonPurchasableReason);
    item.commerceInventoryTracked=product.inventory?.tracked===true;
    item.commerceAvailable=item.commerceInventoryTracked&&Number.isFinite(Number(product.inventory?.available))
      ?Number(product.inventory.available)
      :null;
    item.commercePublishedVersionId=product.publishedVersionId||null;
    item.commerceUpdatedAt=product.updatedAt||null;

    item.price=Number.isInteger(product.priceMinor)
      ?product.priceMinor/100
      :null;

    if(product.status==='arriving-soon'){
      item.availabilityStatus='arriving-soon';
      delete item.stockStatus;
    }else if(product.status==='out-of-stock'){
      item.stockStatus='out-of-stock';
      delete item.availabilityStatus;
    }else{
      if(item.availabilityStatus==='arriving-soon')delete item.availabilityStatus;
      if(item.stockStatus==='out-of-stock')delete item.stockStatus;
    }
  }

  function syncCheckoutGuard(){
    const page=document.getElementById('checkoutPage');
    if(!page||typeof blackSheepCart==='undefined')return;
    const guard=document.getElementById('checkoutGuard');
    const flow=document.getElementById('checkoutFlow');
    const rows=blackSheepCart.resolvedItems();
    const ready=rows.length>0&&blackSheepCart.canCheckout();
    if(guard)guard.hidden=ready;
    if(flow)flow.hidden=!ready;
    const submitError=document.getElementById('checkoutSubmitError');
    if(config.preview===true&&submitError){
      submitError.hidden=false;
      submitError.textContent='Staging commerce preview is active. Order submission is disabled in preview mode.';
    }
    if(typeof checkoutTurnstileChanged==='function')checkoutTurnstileChanged();
    if(ready&&window.__blackSheepCheckoutData&&typeof renderCheckoutReview==='function'){
      renderCheckoutReview(window.__blackSheepCheckoutData);
    }
  }

  function renderPreviewBanner(state='ready'){
    if(config.preview!==true)return;
    let banner=document.getElementById('commercePreviewBanner');
    if(!banner){
      banner=document.createElement('div');
      banner.id='commercePreviewBanner';
      banner.className='commerce-preview-banner';
      banner.setAttribute('role','status');
      document.body.prepend(banner);
    }
    const fallback=state==='fallback';
    banner.classList.toggle('is-fallback',fallback);
    banner.innerHTML=fallback
      ?'<strong>Staging commerce preview unavailable</strong><span>The live D1 feed could not be loaded. Static catalogue fallback is being shown.</span><a href="?commerce-preview=off">Exit preview</a>'
      :'<strong>Staging commerce preview</strong><span>Live D1 price and availability are overlaid on the static storefront.</span><a href="?commerce-preview=off">Exit preview</a>';
  }

  function syncUi(){
    const dynamicCards=typeof syncDynamicCatalogCards==='function'?syncDynamicCatalogCards():0;
    if(typeof syncCatalogCardState==='function')syncCatalogCardState();
    if(typeof sortProductCardsByAvailability==='function')sortProductCardsByAvailability();
    if(typeof polishListButtons==='function')polishListButtons();
    if(typeof syncStaticProductAvailability==='function')syncStaticProductAvailability();
    if(typeof renderBlackSheepList==='function')renderBlackSheepList();
    if(typeof renderBasketPage==='function')renderBasketPage();
    syncCheckoutGuard();
    renderPreviewBanner();
    return dynamicCards;
  }

  async function load(){
    document.documentElement.dataset.commerceLive='loading';
    try{
      const products=[];
      let cursor=null;
      let pages=0;
      do{
        const suffix=cursor===null?'?limit=200':'?limit=200&cursor='+encodeURIComponent(cursor);
        const response=await fetch(apiBase+'/v1/catalog'+suffix,{
          method:'GET',
          headers:{accept:'application/json'},
          cache:'no-store'
        });
        if(!response.ok)throw new Error('catalog_http_'+response.status);
        const payload=await response.json();
        const pageProducts=Array.isArray(payload?.products)?payload.products:null;
        if(!pageProducts)throw new Error('catalog_payload_invalid');
        products.push(...pageProducts);
        cursor=payload?.nextCursor===null||payload?.nextCursor===undefined?null:Number(payload.nextCursor);
        pages+=1;
        if(pages>25)throw new Error('catalog_pagination_guard');
      }while(cursor!==null&&Number.isFinite(cursor));

      const byId=new Map();
      const bySlug=new Map();
      for(const product of products){
        if(product?.id)byId.set(String(product.id),product);
        if(product?.productId)byId.set(String(product.productId),product);
        if(product?.slug)bySlug.set(String(product.slug),product);
      }

      let applied=0;
      const matchedProducts=new Set();
      for(const {item} of catalogItems()){
        const product=byId.get(String(item.id||''))||bySlug.get(String(item.slug||''));
        if(!product)continue;
        applyLiveProduct(item,product);
        matchedProducts.add(String(product.productId||product.id||product.slug||''));
        applied+=1;
      }

      let added=0;
      for(const product of products){
        const key=String(product?.productId||product?.id||product?.slug||'');
        if(!key||matchedProducts.has(key))continue;
        const type=normalizeType(product.type);
        if(!Array.isArray(window.CATALOG[type]))window.CATALOG[type]=[];
        if(window.CATALOG[type].some(item=>String(item.id||'')===String(product.id||'')||String(item.slug||'')===String(product.slug||'')))continue;
        const item={
          section:type,
          id:product.id||product.productId,
          productId:product.productId||product.id,
          slug:String(product.slug||'').trim(),
          name:String(product.name||'').trim()||'Product',
          desc:String(product.shortDescription||'').trim(),
          brand:product.brand||null,
          label:labelForProduct(product,type),
          type,
          sku:product.sku||null,
          categories:[product.primaryCategory].filter(Boolean),
          category:product.primaryCategory||null,
          img:mediaUrl(product.primaryImageUrl),
          imageFit:'contain',
          commerceDynamic:true
        };
        if(!item.slug)continue;
        applyLiveProduct(item,product);
        window.CATALOG[type].push(item);
        matchedProducts.add(key);
        applied+=1;
        added+=1;
      }

      if(!applied)throw new Error('catalog_overlay_no_matches');
      window.BLACK_SHEEP_LIVE_COMMERCE_STATE={
        mode:config.mode||'live',
        applied,
        received:products.length,
        added,
        pages,
        loadedAt:new Date().toISOString()
      };
      document.documentElement.dataset.commerceLive='ready';
      const dynamicCards=syncUi();
      window.BLACK_SHEEP_LIVE_COMMERCE_STATE.dynamicCards=dynamicCards;
      document.dispatchEvent(new CustomEvent('black-sheep:commerce-live-ready',{
        detail:window.BLACK_SHEEP_LIVE_COMMERCE_STATE
      }));
    }catch(error){
      window.BLACK_SHEEP_LIVE_COMMERCE_STATE={
        mode:config.mode||'live',
        applied:0,
        fallback:true,
        error:error instanceof Error?error.message:String(error)
      };
      document.documentElement.dataset.commerceLive='fallback';
      renderPreviewBanner('fallback');
      document.dispatchEvent(new CustomEvent('black-sheep:commerce-live-fallback',{
        detail:window.BLACK_SHEEP_LIVE_COMMERCE_STATE
      }));
    }
  }

  load();
})();