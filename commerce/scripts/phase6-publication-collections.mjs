import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const args=process.argv.slice(2);
const arg=(name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
const catalogPath=arg("--catalog");
const outDirArg=arg("--out-dir");
const reportPath=arg("--report-out");
if(!catalogPath||!outDirArg)throw new Error("Missing --catalog or --out-dir.");

const repoRoot=resolve(process.cwd(),"..");
const outDir=resolve(process.cwd(),outDirArg);
const base="https://theblacksheepshop.co.uk";

const esc=(v)=>String(v??"")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;")
  .replaceAll("'","&#39;");
const money=(n)=>typeof n==="number"?"£"+n.toFixed(2):null;

function parseCatalogue(file){
  const raw=readFileSync(resolve(process.cwd(),file),"utf8").trim();
  return JSON.parse(raw.replace(/^window\.CATALOG=/,"").replace(/;$/,""));
}

function imageSrc(item){
  if(!item.img)return null;
  if(/^https?:\/\//i.test(item.img)||String(item.img).startsWith("/"))return item.img;
  return "images/"+item.img;
}

function state(item){
  if(item.availabilityStatus==="arriving-soon")return{purchasable:false,label:"Arriving soon",reason:"arriving-soon"};
  if(item.stockStatus==="out-of-stock")return{purchasable:false,label:"Out of stock",reason:"out-of-stock"};
  if(item.sellStatus==="NOT_FOR_SALE")return{purchasable:false,label:"Not available online",reason:"not-for-sale"};
  if(item.onlineOrderingEnabled===false)return{purchasable:false,label:"Not available online",reason:"not-available-online"};
  if(typeof item.price!=="number"||!Number.isFinite(item.price))return{purchasable:false,label:null,reason:"price-unavailable"};
  return{purchasable:true,label:null,reason:null};
}

function card(item,type){
  const url="/products/"+encodeURIComponent(item.slug)+".html";
  const cats=[...(item.categories||[])];
  if(type&&!cats.includes(type))cats.push(type);
  const fit=item.imageFit==="contain"?" contain":"";
  const src=imageSrc(item);
  const alt=item.gallery?.[0]?.alt||item.official?.imageAlt||item.name;
  const media=src
    ?'<a class="product-img'+fit+'" href="'+url+'" aria-label="'+esc(item.name)+'"><img loading="lazy" decoding="async" src="'+esc(src)+'" alt="'+esc(alt)+'"></a>'
    :'<a class="product-img contain product-img--placeholder" href="'+url+'" aria-label="'+esc(item.name)+'"><span class="product-placeholder-media" aria-hidden="true"><strong>Product image being added</strong><small>'+esc(item.sku||"")+'</small></span></a>';
  const price=money(item.price);
  const priceHtml=price
    ?'<span class="product-price">'+esc(price)+'</span>'
    :'<span class="product-price product-price--ask">Ask in store</span>';
  const status=state(item);
  const statusHtml=status.label
    ?'<span class="stock-card-label'+(status.reason==="arriving-soon"?" arriving-soon":"")+'">'+esc(status.label)+'</span>'
    :"";
  const brand=item.brand?'<span class="brand-line">'+esc(item.brand)+'</span>':"";
  const dataName=[
    item.name,
    item.label,
    item.brand,
    item.sku,
  ].filter(Boolean).join(" ").toLowerCase();
  const disabled=status.purchasable?"":" disabled";
  const buttonLabel=status.purchasable
    ?"Add "+item.name+" to basket"
    :item.name+", "+(status.label||"Not available to order");
  const buttonText=status.purchasable?"Add to basket":(status.label||"Not available to order");

  return '<article class="product-card'+(status.reason==="out-of-stock"?' is-out-of-stock':'')+'" data-url="'+url+'" role="link" tabindex="0" data-categories="'+esc(cats.join(" "))+'" data-name="'+esc(dataName)+'">'+
    media+
    '<div class="product-info"><div class="kicker">'+esc(item.label||item.type||type)+'</div>'+
    '<a class="product-title" href="'+url+'">'+esc(item.name)+'</a>'+
    brand+
    '<p class="product-desc">'+esc(item.desc||"")+'</p>'+
    '<div class="product-buyline">'+priceHtml+statusHtml+'</div>'+
    '<div class="card-actions"><button class="list-add" type="button" aria-label="'+esc(buttonLabel)+'" onclick=\'addToBlackSheepList(event,'+JSON.stringify(type)+','+JSON.stringify(item.slug)+')\''+disabled+'>'+esc(buttonText)+'</button></div>'+
    '</div></article>';
}

function replaceDivInnerById(html,id,nextInner){
  const openRe=new RegExp('<div\\b[^>]*\\bid=["\\\']'+id+'["\\\'][^>]*>','i');
  const match=openRe.exec(html);
  if(!match)return null;
  const openStart=match.index;
  const innerStart=openStart+match[0].length;
  const tagRe=/<\/?div\b[^>]*>/gi;
  tagRe.lastIndex=innerStart;
  let depth=1;
  let tag;
  while((tag=tagRe.exec(html))){
    if(/^<\/div/i.test(tag[0]))depth-=1;
    else depth+=1;
    if(depth===0){
      return html.slice(0,innerStart)+nextInner+html.slice(tag.index);
    }
  }
  throw new Error("Could not find closing div for #"+id);
}

function patchItemList(html,file,items){
  return html.replace(
    /(<script[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (_,open,body,close)=>{
      let data;
      try{data=JSON.parse(body)}catch{return open+body+close}
      const graph=Array.isArray(data?.["@graph"])?data["@graph"]:[];
      const list=graph.find((node)=>node?.["@type"]==="ItemList");
      if(!list)return open+body+close;
      list.numberOfItems=items.length;
      list.itemListElement=items.map((item,index)=>({
        "@type":"ListItem",
        position:index+1,
        url:base+"/products/"+item.slug+".html",
        name:item.name,
      }));
      return open+JSON.stringify(data).replace(/</g,"\\u003c")+close;
    },
  );
}

function patchCount(html,count){
  return html.replace(
    /(<span class="catalog-count"[^>]*>)[\s\S]*?(<\/span>)/i,
    "$1"+count+" "+(count===1?"product":"products")+"$2",
  );
}

const catalog=parseCatalogue(catalogPath);
const all=Object.entries(catalog).flatMap(([type,list])=>(list||[]).map((item)=>({type,item})));

const definitions=[
  {file:"gifts.html",select:()=>catalog.gifts||[]},
  {file:"gifts-peter-rabbit.html",select:()=>(catalog.gifts||[]).filter((x)=>(x.categories||[]).includes("peter-rabbit"))},
  {file:"gifts-highland-cows.html",select:()=>(catalog.gifts||[]).filter((x)=>(x.categories||[]).includes("highland-cows"))},
  {file:"gifts-mugs.html",select:()=>(catalog.gifts||[]).filter((x)=>(x.categories||[]).includes("mugs"))},
  {file:"gifts-soft-toys.html",select:()=>(catalog.gifts||[]).filter((x)=>(x.categories||[]).includes("soft-toys"))},
  {file:"gifts-cards.html",select:()=>(catalog.gifts||[]).filter((x)=>(x.categories||[]).includes("cards"))},
  {file:"gifts-seasonal.html",select:()=>(catalog.gifts||[]).filter((x)=>(x.categories||[]).includes("seasonal"))},
  {file:"gifts-keyrings-badges.html",select:()=>(catalog.gifts||[]).filter((x)=>(x.categories||[]).includes("keyrings-badges"))},
  {file:"gifts-home-art.html",select:()=>(catalog.gifts||[]).filter((x)=>(x.categories||[]).includes("home-gifts"))},
  {file:"gifts-toys-games.html",select:()=>(catalog.gifts||[]).filter((x)=>(x.categories||[]).includes("toys-games"))},
  {file:"icecream.html",select:()=>catalog.icecream||[]},
  {file:"romneys.html",select:()=>catalog.romneys||[]},
  {file:"hawkshead-relish.html",select:()=>catalog.hawkshead||[]},
  {file:"all-products.html",select:()=>all.map((row)=>row.item)},
];

mkdirSync(outDir,{recursive:true});
const pages=[];
const problems=[];

for(const definition of definitions){
  const sourcePath=resolve(repoRoot,definition.file);
  if(!existsSync(sourcePath)){
    problems.push({file:definition.file,problem:"missing_source_page"});
    continue;
  }
  const selected=definition.select();
  const typeFor=(item)=>{
    const row=all.find((entry)=>entry.item.id===item.id);
    return row?.type||item.type||"gifts";
  };
  let html=readFileSync(sourcePath,"utf8");
  const cards=selected.map((item)=>card(item,typeFor(item))).join("");
  const patched=replaceDivInnerById(html,"catalog",cards);
  if(patched==null){
    problems.push({file:definition.file,problem:"catalog_container_missing"});
    continue;
  }
  html=patchCount(patched,selected.length);
  html=patchItemList(html,definition.file,selected);

  const cardCount=(html.match(/<article class="product-card\b/g)||[]).length;
  const rawLinks=(html.match(/href=["']\/products\//g)||[]).length;
  let itemListCount=null;
  for(const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const data=JSON.parse(match[1]);
      const node=(data?.["@graph"]||[]).find((x)=>x?.["@type"]==="ItemList");
      if(node)itemListCount=Number(node.numberOfItems);
    }catch{}
  }
  if(cardCount!==selected.length)problems.push({file:definition.file,problem:"card_count",expected:selected.length,actual:cardCount});
  if(rawLinks<selected.length)problems.push({file:definition.file,problem:"raw_link_count",expectedAtLeast:selected.length,actual:rawLinks});
  if(itemListCount!==selected.length)problems.push({file:definition.file,problem:"itemlist_count",expected:selected.length,actual:itemListCount});

  writeFileSync(resolve(outDir,definition.file),html,"utf8");
  pages.push({file:definition.file,products:selected.length,cardCount,itemListCount});
}

const report={
  ok:problems.length===0,
  collectionPages:pages.length,
  pages,
  problems,
};
if(reportPath)writeFileSync(resolve(process.cwd(),reportPath),JSON.stringify(report,null,2)+"\n","utf8");
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
