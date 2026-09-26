import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args=process.argv.slice(2);
const arg=(name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};

const catalogPath=arg("--catalog");
const manifestPath=arg("--manifest");
const outDirArg=arg("--out-dir");
const reportPath=arg("--report-out");
const compareToArg=arg("--compare-to");
const check=args.includes("--check");

if(!catalogPath||!manifestPath||!outDirArg){
  throw new Error("Missing --catalog, --manifest or --out-dir.");
}

const outDir=resolve(process.cwd(),outDirArg);

function runNode(script,args){
  const result=spawnSync(process.execPath,[script,...args],{
    cwd:process.cwd(),
    encoding:"utf8",
    env:process.env,
    maxBuffer:60*1024*1024,
  });
  if(result.error)throw result.error;
  if(result.status!==0){
    throw new Error(
      "Publication package command failed: "+script+"\n"+
      String(result.stdout||"")+"\n"+String(result.stderr||"")
    );
  }
  return String(result.stdout||"");
}

function sha256Buffer(buffer){
  return createHash("sha256").update(buffer).digest("hex");
}

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

function packageFiles(root){
  return filesRecursive(root).filter((file)=>
    file==="assets/catalog.js"||
    file==="sitemap.xml"||
    /^products\/[^/]+\.html$/.test(file)||
    /^(?:gifts(?:-[a-z0-9-]+)?|icecream|romneys|hawkshead-relish|all-products)\.html$/.test(file)
  );
}

function inventory(root){
  return packageFiles(root).map((file)=>{
    const bytes=readFileSync(resolve(root,file));
    return{file,sha256:sha256Buffer(bytes),bytes:bytes.length};
  });
}

function packageHash(entries){
  const digest=createHash("sha256");
  for(const entry of entries){
    digest.update(entry.file+"\0"+entry.sha256+"\n");
  }
  return digest.digest("hex");
}

function parseCatalogFile(file){
  const source=readFileSync(file,"utf8").trim();
  return JSON.parse(source.replace(/^window\.CATALOG=/,"").replace(/;$/,""));
}

function catalogRows(catalog){
  return Object.values(catalog).flatMap((list)=>list||[]);
}

function build(targetDir){
  rmSync(targetDir,{recursive:true,force:true});
  mkdirSync(targetDir,{recursive:true});

  runNode("scripts/phase6-publication-render.mjs",[
    "--catalog",catalogPath,
    "--manifest",manifestPath,
    "--out-dir",relative(process.cwd(),targetDir),
  ]);

  runNode("scripts/phase6-publication-collections.mjs",[
    "--catalog",catalogPath,
    "--out-dir",relative(process.cwd(),targetDir),
  ]);

  runNode("scripts/phase6-publication-verify.mjs",[
    "--catalog",catalogPath,
    "--manifest",manifestPath,
    "--site-dir",relative(process.cwd(),targetDir),
  ]);

  return inventory(targetDir);
}

const primary=build(outDir);
let deterministic=true;
let deterministicDifferences=[];

if(check){
  const repeatDir=resolve(dirname(outDir),".phase6-publication-repeat-"+process.pid);
  try{
    const repeat=build(repeatDir);
    const first=new Map(primary.map((entry)=>[entry.file,entry]));
    const second=new Map(repeat.map((entry)=>[entry.file,entry]));
    const names=[...new Set([...first.keys(),...second.keys()])].sort();
    deterministicDifferences=names
      .filter((name)=>first.get(name)?.sha256!==second.get(name)?.sha256)
      .map((name)=>({
        file:name,
        first:first.get(name)?.sha256??null,
        second:second.get(name)?.sha256??null,
      }));
    deterministic=deterministicDifferences.length===0;
  }finally{
    rmSync(repeatDir,{recursive:true,force:true});
  }
}

let comparison=null;
if(compareToArg){
  const target=resolve(process.cwd(),compareToArg);
  const nextByFile=new Map(primary.map((entry)=>[entry.file,entry]));
  const changed=[];
  const added=[];
  const unchanged=[];

  for(const entry of primary){
    const targetPath=resolve(target,entry.file);
    if(!existsSync(targetPath)){
      added.push(entry.file);
      continue;
    }
    const oldHash=sha256Buffer(readFileSync(targetPath));
    if(oldHash===entry.sha256)unchanged.push(entry.file);
    else changed.push(entry.file);
  }

  const deletions=[];
  const unsafeSlugRemovals=[];
  const targetCatalogPath=resolve(target,"assets/catalog.js");
  if(existsSync(targetCatalogPath)){
    const targetCatalog=parseCatalogFile(targetCatalogPath);
    const candidateCatalog=parseCatalogFile(resolve(outDir,"assets/catalog.js"));
    const targetRows=catalogRows(targetCatalog);
    const candidateById=new Map(catalogRows(candidateCatalog).map((item)=>[item.id,item]));

    for(const oldItem of targetRows){
      const next=candidateById.get(oldItem.id);
      const oldFile="products/"+oldItem.slug+".html";
      if(!next){
        deletions.push(oldFile);
        continue;
      }
      if(next.slug!==oldItem.slug&&!nextByFile.has(oldFile)){
        unsafeSlugRemovals.push({
          id:oldItem.id,
          oldSlug:oldItem.slug,
          newSlug:next.slug,
          missingRedirect:oldFile,
        });
      }
    }
  }

  comparison={
    target,
    added:added.sort(),
    changed:changed.sort(),
    unchanged:unchanged.sort(),
    deletions:[...new Set(deletions)].sort(),
    unsafeSlugRemovals,
  };
}

const report={
  ok:deterministic&&(comparison?.unsafeSlugRemovals?.length??0)===0,
  deterministic,
  deterministicDifferences,
  files:primary.length,
  packageSha256:packageHash(primary),
  inventory:primary,
  comparison,
};

if(reportPath){
  const target=resolve(process.cwd(),reportPath);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,JSON.stringify(report,null,2)+"\n","utf8");
}

console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
