#!/usr/bin/env python3
"""Sync factual official product data + exact product imagery for Romney's-section records.

Safety:
- NEVER read or change retail price fields.
- Never import supplier/shop prices.
- Never copy source URLs into customer-facing fields.
- Only records that already have a verified official URL are processed.
"""
from __future__ import annotations
import io, json, re, html as htmlmod, pathlib, urllib.request
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from PIL import Image

CATALOG=pathlib.Path("assets/catalog.js")
UA="Mozilla/5.0 (compatible; BlackSheepCatalogVerifier/1.0; +https://theblacksheepshop.co.uk/)"

def load_catalog():
    text=CATALOG.read_text(encoding="utf-8")
    raw=text.split("window.CATALOG=",1)[1].rsplit(";",1)[0].strip()
    return json.loads(raw)

def save_catalog(data):
    CATALOG.write_text("window.CATALOG="+json.dumps(data,separators=(",",":"),ensure_ascii=False)+";\n",encoding="utf-8")

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept-Language":"en-GB,en;q=0.9"})
    with urllib.request.urlopen(req,timeout=45) as r:
        return r.read(), r.headers.get("Content-Type","")

def meta_image(soup,base_url):
    for attrs in (
        {"property":"og:image:secure_url"},{"property":"og:image"},
        {"name":"twitter:image"},{"name":"twitter:image:src"}
    ):
        tag=soup.find("meta",attrs=attrs)
        if tag and tag.get("content"):
            return urljoin(base_url,htmlmod.unescape(tag["content"]).strip())
    return None

def clean_text(s):
    s=re.sub(r"https?://\S+","",s or "")
    s=re.sub(r"\b\S+@\S+\.\S+\b","",s)
    s=re.sub(r"\s+"," ",s).strip(" •\t\n")
    return s

def safe_fact(s,maxlen=3000):
    s=clean_text(s)
    if not s or len(s)>maxlen: return ""
    if re.search(r"https?://|www\.|@\w",s,re.I): return ""
    return s

def parse_mintcake(lines):
    """Romney Shopify tabs render labels first, then description/ingredients/nutrition text."""
    out={}
    try:
        n=lines.index("Nutrition")
    except ValueError:
        return out
    tail=[]
    for s in lines[n+1:]:
        if s.startswith("Standard Customers") or s.startswith("You may also like") or s.startswith("Newsletter Signup"):
            break
        s=s.strip()
        if s and s not in ("VT","IN STOCK","Quantity"):
            tail.append(s)
    nutrition=next((x for x in tail if re.search(r"Typical values|Nutritional Info Per",x,re.I)), "")
    ingredient=next((x for x in tail if x!=nutrition and re.search(r"ALLERGEN ADVICE|For allergens|\bingredients?\b.*\bbold\b|^Sugar,|^White Sugar,|^Wheat flour",x,re.I)), "")
    if ingredient:
        out["ingredients"]=safe_fact(ingredient)
        allergy=re.search(r"(ALLERGEN ADVICE:.*?)(?=Free from|Suitable for|Contains no|$)",ingredient,re.I)
        if allergy: out["allergens"]=safe_fact(allergy.group(1),1200)
        dietary=[]
        for pat in [r"Suitable for [^.]+\.",r"Free from [^.]+\.",r"Contains no [^.]+\."]:
            dietary += re.findall(pat,ingredient,re.I)
        if dietary: out["dietary"]=safe_fact(" ".join(dict.fromkeys(dietary)),1200)
    if nutrition: out["nutrition"]=safe_fact(nutrition)
    return {k:v for k,v in out.items() if v}

def parse_walkers(lines):
    out={}
    ing=next((x for x in lines if x.startswith("Ingredients:")), "")
    if ing: out["ingredients"]=safe_fact(ing.removeprefix("Ingredients:").strip())
    try:
        a=next(i for i,x in enumerate(lines) if "ALLERGIES & DIETARY INFO" in x)
    except StopIteration:
        a=-1
    if a>=0:
        facts=[]
        for s in lines[a+1:]:
            if s.startswith("Ingredients:"): break
            if s and not s.startswith("Typical"):
                facts.append(s)
        if facts:
            joined=safe_fact(". ".join(facts),1400)
            if joined:
                out["dietary"]=joined
                out["allergens"]=joined
    extra=next((x for x in lines if x.startswith("Not suitable for sufferers")), "")
    if extra:
        out["allergens"]=safe_fact(((out.get("allergens","")+" "+extra).strip()),1600)
    # Store compact pack-level nutrition when the page provides a 50g table.
    try:
        p=lines.index("Per 50g")
        vals=lines[p+1:p+8]
        if len(vals)>=7:
            out["nutrition"]=safe_fact(
                f"Per 50g: Energy {vals[0]}; Fat {vals[1]} (saturates {vals[2]}); "
                f"Carbohydrate {vals[3]} (sugars {vals[4]}); Protein {vals[5]}; Salt {vals[6]}.",1200
            )
    except ValueError:
        pass
    return {k:v for k,v in out.items() if v}

def save_webp(data,target):
    im=Image.open(io.BytesIO(data))
    if im.mode not in ("RGB","RGBA"):
        im=im.convert("RGBA" if "A" in im.getbands() else "RGB")
    im.thumbnail((1800,1800),Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True,exist_ok=True)
    im.save(target,"WEBP",quality=88,method=6)

def main():
    catalog=load_catalog()
    synced=0; facts=0; failures=[]
    for item in catalog.get("romneys",[]):
        official=item.get("official") or {}
        url=official.get("url")
        if not url: continue
        try:
            page,_=fetch(url)
            soup=BeautifulSoup(page,"html.parser")
            lines=[s.strip() for s in soup.stripped_strings if s.strip()]
            host=urlparse(url).netloc.lower()
            parsed={}
            if "mintcake.co.uk" in host:
                parsed=parse_mintcake(lines)
            elif "walkers-nonsuch.co.uk" in host:
                parsed=parse_walkers(lines)
            # Elit's manufacturer page currently supplies identity/brand imagery, not pack nutrition.
            for k,v in parsed.items():
                if v: official[k]=v
            if parsed: facts+=1
            image_url=meta_image(soup,url)
            if image_url:
                img_bytes,_=fetch(image_url)
                target_rel=f"romneys/official/{item['slug']}.webp"
                save_webp(img_bytes,pathlib.Path("images")/target_rel)
                item["img"]=target_rel
                official["imageUrl"]=image_url
                official["imageLocal"]=target_rel
                synced+=1
            official["sourceSyncedAt"]="2026-09-24"
            item["official"]=official
        except Exception as e:
            failures.append(f"{item.get('id')}: {type(e).__name__}: {e}")
    save_catalog(catalog)
    print(json.dumps({"officialImagesSynced":synced,"productsWithFacts":facts,"failures":failures},indent=2))
    if synced < 20:
        raise SystemExit("Too few official images synced; refusing a likely network/parser regression")

if __name__=="__main__": main()
