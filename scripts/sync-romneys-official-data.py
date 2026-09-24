#!/usr/bin/env python3
"""Sync factual official product data + exact product imagery for Romney's-section records.

Safety: this script NEVER reads or changes retail price fields. Black Sheep prices
remain owner-controlled in assets/catalog.js. It imports only factual product data
and official imagery from an already-verified product URL.
"""
from __future__ import annotations
import io, json, re, html as htmlmod, pathlib, urllib.request
from urllib.parse import urljoin
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

def clean_segment(lines,start,end=None):
    try: i=lines.index(start)+1
    except ValueError: return ""
    j=len(lines)
    if end:
        try: j=lines.index(end,i)
        except ValueError: pass
    seg=[]
    stop=("Standard Customers","Wholesale Customers","Add to Cart","You may also like","Newsletter Signup")
    for s in lines[i:j]:
        if any(s.startswith(x) for x in stop): break
        if s not in ("VT","IN STOCK","Quantity") and not re.fullmatch(r"£[\d.,]+",s):
            seg.append(s)
    return " ".join(seg).strip()

def exact_sentences(text,needles):
    if not text: return ""
    bits=re.split(r"(?<=[.!?])\s+",text)
    picked=[]
    for b in bits:
        low=b.lower()
        if any(n in low for n in needles): picked.append(b.strip())
    return " ".join(dict.fromkeys(picked))

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
            ingredients=clean_segment(lines,"Ingredients","Nutrition")
            nutrition=clean_segment(lines,"Nutrition")
            if ingredients:
                official["ingredients"]=ingredients
                allergen=exact_sentences(ingredients,["allergen","contains milk","contains soya","contains wheat","contains peanut","may contain"])
                if allergen: official["allergens"]=allergen
                dietary=exact_sentences(ingredients,["suitable for","free from","gluten free","gluten-free","gelatine free","vegan","vegetarian"])
                if dietary: official["dietary"]=dietary
                facts+=1
            if nutrition: official["nutrition"]=nutrition
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
    print(json.dumps({"officialImagesSynced":synced,"productsWithIngredients":facts,"failures":failures},indent=2))
    if synced < 20:
        raise SystemExit("Too few official images synced; refusing a likely network/parser regression")

if __name__=="__main__": main()
