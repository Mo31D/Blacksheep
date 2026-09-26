import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";

const args=process.argv.slice(2);
const arg=(name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};

const packageDirArg=arg("--package-dir");
const packageSha=arg("--package-sha");
const r2Bucket=arg("--r2-bucket")||"black-sheep-product-media-prod";
const reportPath=arg("--report-out");
const dryRun=args.includes("--dry-run");

if(!packageDirArg||!packageSha){
  throw new Error("Missing --package-dir or --package-sha.");
}

const commerceRoot=process.cwd();
const repoRoot=resolve(commerceRoot,"..");
const packageDir=resolve(commerceRoot,packageDirArg);
const wranglerPath=resolve(commerceRoot,"wrangler.jsonc");
const siteJsPath=resolve(repoRoot,"assets/site.js");

function filesRecursive(root,current=root){
  if(!existsSync(current))return[];
  const result=[];
  for(const name of readdirSync(current)){
    const full=resolve(current,name);
    const st=statSync(full);
    if(st.isDirectory())result.push(...filesRecursive(root,full));
    else result.push(relative(root,full).replaceAll("\\","/"));
  }
  return result.sort();
}

function packageFiles(){
  return filesRecursive(packageDir).filter((file)=>
    file==="assets/catalog.js"||
    file==="sitemap.xml"||
    /^products\/[^/]+\.html$/.test(file)||
    /^(?:gifts(?:-[a-z0-9-]+)?|icecream|romneys|hawkshead-relish|all-products)\.html$/.test(file)
  );
}

function sha256Buffer(buffer){
  return createHash("sha256").update(buffer).digest("hex");
}

function packageHash(files){
  const digest=createHash("sha256");
  for(const file of files){
    const bytes=readFileSync(resolve(packageDir,file));
    digest.update(file+"\0"+sha256Buffer(bytes)+"\n");
  }
  return digest.digest("hex");
}

const files=packageFiles();
if(files.length!==162){
  throw new Error("Expected exactly 162 publication-owned files, found "+files.length+".");
}
const actualPackageSha=packageHash(files);
if(actualPackageSha!==packageSha){
  throw new Error(
    "Publication package SHA mismatch. Expected "+packageSha+", got "+actualPackageSha+"."
  );
}

const wrangler=JSON.parse(readFileSync(wranglerPath,"utf8"));
const vars=wrangler.vars||{};
const topR2=Array.isArray(wrangler.r2_buckets)?wrangler.r2_buckets:[];
const liveSource=readFileSync(siteJsPath,"utf8");

if(vars.D1_PUBLIC_CATALOG_ENABLED==="true"||
   vars.D1_COMMERCE_AUTHORITY_ENABLED==="true"||
   vars.ORDER_RESERVATIONS_ENABLED==="true"){
  throw new Error("Production Worker source is already authority-enabled.");
}
if(topR2.some((entry)=>entry.binding==="PRODUCT_MEDIA")){
  throw new Error("Production PRODUCT_MEDIA binding already exists.");
}
if(!liveSource.includes("const BLACK_SHEEP_PRODUCTION_LIVE_COMMERCE=false;")){
  throw new Error("Expected disabled Production live-commerce marker is missing.");
}

const nextWrangler={
  ...wrangler,
  triggers:{crons:["*/30 * * * *"]},
  r2_buckets:[
    ...topR2,
    {binding:"PRODUCT_MEDIA",bucket_name:r2Bucket},
  ],
  vars:{
    ...vars,
    ORDER_RESERVATIONS_ENABLED:"true",
    D1_PUBLIC_CATALOG_ENABLED:"true",
    D1_COMMERCE_AUTHORITY_ENABLED:"true",
  },
};

const nextSiteJs=liveSource.replace(
  "const BLACK_SHEEP_PRODUCTION_LIVE_COMMERCE=false;",
  "const BLACK_SHEEP_PRODUCTION_LIVE_COMMERCE=true;",
);

const planned=[
  ...files,
  "assets/site.js",
  "commerce/wrangler.jsonc",
].sort();

if(!dryRun){
  for(const file of files){
    const source=resolve(packageDir,file);
    const target=resolve(repoRoot,file);
    mkdirSync(dirname(target),{recursive:true});
    copyFileSync(source,target);
  }
  writeFileSync(wranglerPath,JSON.stringify(nextWrangler,null,2)+"\n","utf8");
  writeFileSync(siteJsPath,nextSiteJs,"utf8");
}

const report={
  ok:true,
  dryRun,
  packageSha256:actualPackageSha,
  publicationFiles:files.length,
  productionR2Bucket:r2Bucket,
  productionFlags:{
    ORDER_RESERVATIONS_ENABLED:"true",
    D1_PUBLIC_CATALOG_ENABLED:"true",
    D1_COMMERCE_AUTHORITY_ENABLED:"true",
  },
  cron:"*/30 * * * *",
  productionLiveCommerce:true,
  plannedFiles:planned,
};

if(reportPath){
  const target=resolve(commerceRoot,reportPath);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,JSON.stringify(report,null,2)+"\n","utf8");
}
console.log(JSON.stringify(report,null,2));
