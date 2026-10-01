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
    const raw=String(value);
    if(/^https?:\/\//i.test(raw))return raw;
    try{
      if(raw.startsWith('/media/'))return new URL(raw,apiBase+'/').href;
      if(raw.startsWith('/'))return new URL(raw,location.origin).href;
      return new URL(raw,apiBase+'/').href;
    }catch{return raw}
  };
  const catalogItems=()=>{
    const rows=[];
    for(const [type,list] of Object.entries(window.CATALOG||{})){
      for(const item of list||[])rows.push({type,item});
    }
    return rows;
  };

  function applyLiveProduct(item,product){
    // The published commerce catalogue is authoritative for customer-facing
    // product identity and taxonomy. Static data is only the resilient fallback.
    if(typeof product.name==='string'&&product.name.trim())item.name=product.name.trim();
    if(typeof product.shortDescription==='string')item.desc=product.shortDescription.trim();
    if(product.brand!==undefined)item.brand=product.brand||null;
    if(product.sku!==undefined)item.sku=product.sku||null;
    if(typeof product.slug==='string'&&product.slug.trim())item.slug=product.slug.trim();
    if(Array.isArray(product.categories))item.categories=product.categories.map(String).filter(Boolean);
    if(product.primaryCategory!==undefined)item.category=product.primaryCategory||null;
    if(product.primaryImageUrl)item.img=mediaUrl(product.primaryImageUrl);
    item.label=labelForProduct(product,normalizeType(product.type||item.type||item.section));
    item.commerceLive=true;
    item.commercePurchasable=product.purchasable===true;
    item.commerceUnavailableReason=normalizeReason(product.nonPurchasableReason);
    item.commerceInventoryTracked=product.inventory?.tracked===true;
    item.commerceAvailable=item.commerceInventoryTracked&&Number.isFinite(Number(product.inventory?.available))
      ?Number(product.inventory.available)
      :null;
    item.commercePublishedVersionId=product.publishedVersionId||null;
    item.commerceUpdatedAt=product.updatedAt||null;
    item.commercePrimaryStorefrontNodeId=product.primaryStorefrontNodeId||null;
    item.cleanUrl=product.cleanUrl||null;
    item.commerceStorefrontNodeIds=Array.isArray(product.storefrontNodeIds)
      ?product.storefrontNodeIds.map(String)
      :[];

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

  function syncUi(structureNodes,homepageMerchandising,websiteAppearance){
    // A published Section with a preserved static URL has one renderer: its
    // current hierarchy and Product placements. Taxonomy card paths below
    // must not repopulate that page after the Section renderer has run.
    const publishedCollectionRoute=!!document.querySelector('#catalog[data-published-section]')||Array.isArray(structureNodes)&&structureNodes.some(node=>node.legacyPath===location.pathname);
    if(!publishedCollectionRoute&&typeof reconcilePublishedCatalogDom==='function')reconcilePublishedCatalogDom();
    if(Array.isArray(structureNodes)&&typeof syncDynamicStorefrontStructure==='function'){
      syncDynamicStorefrontStructure(structureNodes);
    }
    if(homepageMerchandising&&typeof syncHomepageProductRail==='function'){
      syncHomepageProductRail(homepageMerchandising);
    }
    if(websiteAppearance&&typeof syncWebsiteAppearance==='function'){
      syncWebsiteAppearance(websiteAppearance);
    }
    const dynamicCards=!publishedCollectionRoute&&typeof syncDynamicCatalogCards==='function'?syncDynamicCatalogCards():0;
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
      const seenCursors=new Set();
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
        for(const product of pageProducts){
          if(!product||typeof product.id!=='string'||!product.id.trim()||typeof product.slug!=='string'||!product.slug.trim())throw new Error('catalog_product_invalid');
        }
        products.push(...pageProducts);
        const next=payload.nextCursor;
        if(next!==null&&next!==undefined){
          if(!Number.isSafeInteger(Number(next))||Number(next)<=Number(cursor||0)||seenCursors.has(Number(next)))throw new Error('catalog_cursor_invalid');
          seenCursors.add(Number(next));
        }
        cursor=next===null||next===undefined?null:Number(next);
        pages+=1;
        if(pages>25)throw new Error('catalog_pagination_guard');
      }while(cursor!==null&&Number.isFinite(cursor));

      const byId=new Map();
      const bySlug=new Map();
      for(const product of products){
        if(byId.has(product.id)||bySlug.has(product.slug))throw new Error('catalog_duplicate_product');
        if(product?.id)byId.set(String(product.id),product);
        if(product?.productId)byId.set(String(product.productId),product);
        if(product?.slug)bySlug.set(String(product.slug),product);
      }

      let applied=0;
      let removed=0;
      // Reconcile only after the complete feed is validated. A failed page must
      // never remove products. An empty successful feed is authoritative too.
      const nextCatalog={};
      for(const type of Object.keys(window.CATALOG))nextCatalog[type]=[];
      const matchedProducts=new Set();
      for(const {type,item:staticItem} of catalogItems()){
        const item={...staticItem};
        const product=byId.get(String(item.id||''))||bySlug.get(String(item.slug||''));
        if(!product){removed+=1;continue;}
        applyLiveProduct(item,product);
        nextCatalog[type].push(item);
        matchedProducts.add(String(product.productId||product.id||product.slug||''));
        applied+=1;
      }

      let added=0;
      for(const product of products){
        const key=String(product?.productId||product?.id||product?.slug||'');
        if(!key||matchedProducts.has(key))continue;
        const type=normalizeType(product.type);
        if(!Array.isArray(nextCatalog[type]))nextCatalog[type]=[];
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
          categories:Array.isArray(product.categories)&&product.categories.length?product.categories:[product.primaryCategory].filter(Boolean),
          category:product.primaryCategory||null,
          img:mediaUrl(product.primaryImageUrl),
          imageFit:'contain',
          commerceDynamic:true
        };
        if(!item.slug)continue;
        applyLiveProduct(item,product);
        nextCatalog[type].push(item);
        matchedProducts.add(key);
        applied+=1;
        added+=1;
      }

      window.CATALOG=nextCatalog;

      let structureNodes=null;
      let structureError=null;
      try{
        const structureResponse=await fetch(apiBase+'/v1/storefront-structure',{
          method:'GET',
          headers:{accept:'application/json'},
          cache:'no-store'
        });
        if(!structureResponse.ok)throw new Error('storefront_structure_http_'+structureResponse.status);
        const structurePayload=await structureResponse.json();
        if(!Array.isArray(structurePayload?.nodes))throw new Error('storefront_structure_payload_invalid');
        structureNodes=structurePayload.nodes;
      }catch(error){
        structureError=error instanceof Error?error.message:String(error);
      }

      let homepageMerchandising=null;
      let homepageMerchandisingError=null;
      try{
        const homepageResponse=await fetch(apiBase+'/v1/homepage-merchandising',{
          method:'GET',
          headers:{accept:'application/json'},
          cache:'no-store'
        });
        if(!homepageResponse.ok)throw new Error('homepage_merchandising_http_'+homepageResponse.status);
        const homepagePayload=await homepageResponse.json();
        if(!homepagePayload?.config||!Array.isArray(homepagePayload?.products))throw new Error('homepage_merchandising_payload_invalid');
        homepageMerchandising=homepagePayload;
      }catch(error){
        homepageMerchandisingError=error instanceof Error?error.message:String(error);
      }

      let websiteAppearance=null;
      let websiteAppearanceError=null;
      try{
        const appearanceResponse=await fetch(apiBase+'/v1/appearance',{
          method:'GET',
          headers:{accept:'application/json'},
          cache:'no-store'
        });
        if(!appearanceResponse.ok)throw new Error('appearance_http_'+appearanceResponse.status);
        const appearancePayload=await appearanceResponse.json();
        if(!appearancePayload?.config||appearancePayload?.contract!=='website-appearance-published-v1')throw new Error('appearance_payload_invalid');
        websiteAppearance=appearancePayload.config;
      }catch(error){
        websiteAppearanceError=error instanceof Error?error.message:String(error);
      }

      window.BLACK_SHEEP_LIVE_COMMERCE_STATE={
        mode:config.mode||'live',
        applied,
        covered:matchedProducts.size,
        received:products.length,
        added,
        removed,
        authoritative:true,
        pages,
        structureNodes:Array.isArray(structureNodes)?structureNodes.length:0,
        structureFallback:!Array.isArray(structureNodes),
        structureError,
        homepageMerchandising:homepageMerchandising?.config?.enabled===true,
        homepageMerchandisingMode:homepageMerchandising?.config?.mode||null,
        homepageMerchandisingProducts:Array.isArray(homepageMerchandising?.products)?homepageMerchandising.products.length:0,
        homepageMerchandisingFallback:!homepageMerchandising,
        homepageMerchandisingError,
        appearance:!!websiteAppearance,
        appearancePreset:websiteAppearance?.presetKey||null,
        appearanceFallback:!websiteAppearance,
        appearanceError:websiteAppearanceError,
        loadedAt:new Date().toISOString()
      };
      const dynamicCards=syncUi(structureNodes,homepageMerchandising,websiteAppearance);
      window.BLACK_SHEEP_LIVE_COMMERCE_STATE.dynamicCards=dynamicCards;
      document.documentElement.dataset.commerceLive='ready';
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
