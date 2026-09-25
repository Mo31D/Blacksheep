(function(){
  const config=window.BLACK_SHEEP_LIVE_COMMERCE||{};
  if(config.enabled!==true||!config.apiBase||!window.CATALOG)return;

  const apiBase=String(config.apiBase).replace(/\/$/,'');
  const normalizeReason=value=>String(value||'');
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
    if(typeof checkoutTurnstileChanged==='function')checkoutTurnstileChanged();
    if(ready&&window.__blackSheepCheckoutData&&typeof renderCheckoutReview==='function'){
      renderCheckoutReview(window.__blackSheepCheckoutData);
    }
  }

  function renderPreviewBanner(){
    if(config.preview!==true||document.getElementById('commercePreviewBanner'))return;
    const banner=document.createElement('div');
    banner.id='commercePreviewBanner';
    banner.className='commerce-preview-banner';
    banner.setAttribute('role','status');
    banner.innerHTML='<strong>Staging commerce preview</strong><span>Live D1 price and availability are overlaid on the static storefront.</span><a href="?commerce-preview=off">Exit preview</a>';
    document.body.prepend(banner);
  }

  function syncUi(){
    if(typeof syncCatalogCardState==='function')syncCatalogCardState();
    if(typeof sortProductCardsByAvailability==='function')sortProductCardsByAvailability();
    if(typeof polishListButtons==='function')polishListButtons();
    if(typeof syncStaticProductAvailability==='function')syncStaticProductAvailability();
    if(typeof renderBlackSheepList==='function')renderBlackSheepList();
    if(typeof renderBasketPage==='function')renderBasketPage();
    syncCheckoutGuard();
    renderPreviewBanner();
  }

  async function load(){
    document.documentElement.dataset.commerceLive='loading';
    try{
      const response=await fetch(apiBase+'/v1/catalog?limit=200',{
        method:'GET',
        headers:{accept:'application/json'},
        cache:'no-store'
      });
      if(!response.ok)throw new Error('catalog_http_'+response.status);
      const payload=await response.json();
      const products=Array.isArray(payload?.products)?payload.products:null;
      if(!products)throw new Error('catalog_payload_invalid');

      const byId=new Map();
      const bySlug=new Map();
      for(const product of products){
        if(product?.id)byId.set(String(product.id),product);
        if(product?.productId)byId.set(String(product.productId),product);
        if(product?.slug)bySlug.set(String(product.slug),product);
      }

      let applied=0;
      for(const {item} of catalogItems()){
        const product=byId.get(String(item.id||''))||bySlug.get(String(item.slug||''));
        if(!product)continue;
        applyLiveProduct(item,product);
        applied+=1;
      }

      if(!applied)throw new Error('catalog_overlay_no_matches');
      window.BLACK_SHEEP_LIVE_COMMERCE_STATE={
        mode:config.mode||'live',
        applied,
        received:products.length,
        loadedAt:new Date().toISOString()
      };
      document.documentElement.dataset.commerceLive='ready';
      syncUi();
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
      document.dispatchEvent(new CustomEvent('black-sheep:commerce-live-fallback',{
        detail:window.BLACK_SHEEP_LIVE_COMMERCE_STATE
      }));
    }
  }

  load();
})();