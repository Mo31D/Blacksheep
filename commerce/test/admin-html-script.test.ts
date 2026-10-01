import { describe, expect, it } from "vitest";
import { adminHtml, adminLoginHtml } from "../src/admin/ui";

function inlineScripts(html: string): string[] {
  return Array.from(
    html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi),
    (match) => match[1],
  );
}

function compileInlineScripts(html: string): void {
  const scripts = inlineScripts(html);
  expect(scripts.length).toBeGreaterThan(0);

  for (const script of scripts) {
    // Parse/compile exactly the JavaScript emitted into the browser.
    // This catches template-string escaping mistakes that TypeScript
    // cannot see because they only exist after adminHtml() renders.
    // eslint-disable-next-line no-new-func
    new Function(script);
  }
}

describe("generated Admin HTML scripts", () => {
  it("resolves storefront-relative images in Worker-hosted Admin previews", () => {
    const script = inlineScripts(adminHtml("owner@example.com", "staging"))[0];
    const helper = script.match(/function storefrontImageUrl\(url\)\{[^}]+\}/)?.[0];
    expect(helper).toBeTruthy();
    const resolve = new Function(`${helper};return storefrontImageUrl`)() as (
      url: string,
    ) => string;

    expect(resolve("/images/1.png")).toBe(
      "https://theblacksheepshop.co.uk/images/1.png",
    );
    expect(resolve("/media/staging-upload")).toBe("/media/staging-upload");
    expect(resolve("https://example.com/image.webp")).toBe(
      "https://example.com/image.webp",
    );
    expect(resolve("//example.com/image.webp")).toBe(
      "//example.com/image.webp",
    );
    expect(script).toContain("esc(storefrontImageUrl(h.imageUrl))");
    expect(script).toContain("esc(storefrontImageUrl(url))");
  });

  it("emits syntactically valid authenticated Admin JavaScript", () => {
    const html = adminHtml("owner@example.com");
    compileInlineScripts(html);
    expect(html).toContain("URLSearchParams(location.search).get('order')");
    expect(html).toContain("openOrder(requestedOrder)");
  });

  it("gives each owner job one navigation home while preserving Website deep links", () => {
    const html = adminHtml("owner@example.com");
    compileInlineScripts(html);
    expect(html.match(/data-nav="website"/g)).toHaveLength(2); // Sidebar and mobile More.
    expect(html).not.toContain('data-nav="catalogue"');
    expect(html).not.toContain('data-nav="appearance"');
    expect(html).not.toContain('data-nav="media"');
    expect(html).toContain('data-website-tab="sections"');
    expect(html).toContain('data-website-tab="appearance"');
    expect(html).toContain('data-website-tab="media"');
    expect(html).toContain('data-nav="dashboard"');
    expect(html).toContain('<h1>Overview</h1>');
    expect(html).toContain('<span>Overview</span>');
    expect(html).toContain('id="view-website"');
    expect(html).not.toContain('id="view-appearance"');
    expect(html).not.toContain('id="view-media"');
    expect(html).toContain("view==='appearance'?'appearance':view==='media'?'media':null");
    expect(html).toContain("if(target==='sections')setView('catalogue')");
    expect(html).toContain("activeView==='catalogue'?'website'");
    expect(html).toContain("'#'+(websiteTab==='homepage'?'website':websiteTab)");
    expect(html).toContain("'website','appearance','media','stock'");
    expect(html).toContain('class="nav-group-label">Operations');
    expect(html).toContain('class="nav-group-label">Website');
    expect(html).toContain('Orders &amp; reservations');
    expect(html).toContain('Inventory &amp; stocktake');
  });

  it("renders owner-ready production copy and staging-only test controls", () => {
    const production = adminHtml("owner@example.com", "production");
    const staging = adminHtml("owner@example.com", "staging");

    compileInlineScripts(production);
    compileInlineScripts(staging);

    expect(production).not.toContain("Phase 2 · Editing");
    expect(production).not.toContain("Phase 4 · Staging");
    expect(production).not.toContain("Staging Product Core");
    expect(production).not.toContain("before storefront cutover");
    expect(production).not.toContain("dedicated Media phase");
    expect(production).not.toContain('id="resetTestOrders"');
    expect(production).not.toContain('data-order-class="TEST"');
    expect(production).toContain('id="view-catalogue"');
    expect(production).toContain('data-website-tab="sections"');
    expect(production).toContain('id="view-website"');
    expect(production).toContain('data-nav="website"');
    expect(production).toContain("Homepage product strip");
    expect(production).toContain("Homepage sections");
    expect(production).toContain("Appearance");
    expect(production).toContain('data-website-tab="appearance"');
    expect(production).toContain('data-website-tab="media"');
    expect(production).toContain('id="websiteMediaPanel"');
    expect(production).toContain("Media Library");
    expect(production).toContain("Add to Image Library");
    expect(production).toContain("View usage");
    expect(production).toContain("Retained by saved content");
    expect(production).toContain("sharedMediaUsage");
    expect(production).toContain("appearanceHeroPicker");
    expect(production).toContain("data-appearance-image-choice");
    expect(production).not.toContain("openSharedMediaPicker('hero')");
    expect(production).toContain("Reuse existing");
    expect(production).toContain("Upload separately");
    expect(production).toContain("Organise in library · optional");
    expect(production).toContain("It does not place the image on the website.");
    expect(production).toContain("All categories");
    expect(production).toContain('id="appearanceHeroChooseMedia"');
    expect(production).toContain('id="appearanceHeroUploadButton"');
    expect(production).toContain('id="appearanceHeroUpload"');
    expect(production).toContain('id="appearanceHeroClear"');
    expect(production).toContain('id="structureImageUploadButton"');
    expect(production).toContain('id="structureImageChoose"');
    expect(production).toContain('id="structureImagePicker"');
    expect(production).toContain('function loadStructureImageChoices');
    expect(production).toContain("function uploadSharedImageFile");
    expect(production).toContain("function uploadAppearanceHeroImage");
    expect(production).not.toContain("function uploadAppearanceSectionImage");
    expect(production).not.toContain('id="appearanceSectionImages"');
    expect(production).toContain("function uploadStructureImage");
    expect(production).not.toContain('placeholder="/images/1.png"');
    expect(production).not.toContain('placeholder="Image address"');
    expect(production).not.toContain('placeholder="Optional image address"');
    expect(production).toContain('id="productMediaPicker"');
    expect(production).toContain('data-product-media-choice');
    expect(production).not.toContain("openSharedMediaPicker('product'");
    expect(production).toContain("/admin/api/media");
    expect(production).toContain("/media/from-library");
    expect(production).toContain("function attachExistingProductImage");
    expect(production).toContain("Image added to Product draft");
    expect(production).toContain("context:'PRODUCT'");
    expect(production).not.toContain(
      "fetch('/admin/api/products/'+encodeURIComponent(productCurrent.id)+'/media',{method:'POST'",
    );
    expect(production).toContain("function archiveSharedMediaAsset");
    expect(production).toContain("Homepage hero");
    expect(production).not.toContain("<h2>Section images</h2>");
    expect(production).toContain("Change approved colours and homepage hero content.");
    expect(production).not.toContain("hero content and section imagery");
    expect(production).toContain('id="appearancePresetGrid"');
    expect(production).toContain('id="appearanceResetPreset"');
    expect(production).toContain("Reset colours to preset");
    expect(production).toContain("function applyAppearancePreset");
    expect(production).toContain("function resetAppearanceToPreset");
    expect(production).toContain("Presets and manual colour changes are checked for readable contrast");
    expect(production).toContain('id="appearanceSaveDraft"');
    expect(production).toContain('id="appearancePreview"');
    expect(production).toContain('id="appearancePublish"');
    expect(production).toContain("/admin/api/appearance");
    expect(production).toContain("function restoreWebsiteAppearance");
    expect(production).not.toContain("Custom CSS");
    expect(production).toContain('id="homepageModules"');
    expect(production).toContain("homepageModulesPayload");
    expect(production).toContain("data-homepage-module-move");
    expect(production).toContain("Hero & quick links");
    expect(production).toContain("Visit / shop story");
    expect(production).toContain("Newest products");
    expect(production).toContain("Featured products");
    expect(production).toContain("Selected collection");
    expect(production).toContain("/admin/api/homepage-merchandising");
    expect(production).toContain("Save draft");
    expect(production).toContain("Private preview");
    expect(production).toContain('id="openCatalogue"');
    expect(production).not.toContain('id="globalSearch"');
    expect(production).not.toContain('id="peBrand"');
    expect(production).toContain("Manage brands &amp; ranges");
    expect(production).not.toContain("function brandNameForCategoryIds(ids)");
    expect(production).toContain("Product brand / maker");
    expect(production).toContain("productMakerField('peMakerName',p.brand)");
    expect(production).not.toContain("Website settings…");
    expect(production).toContain("Website structure");
    expect(production).toContain("Brands &amp; ranges");
    expect(production).toContain('id="addStorefrontSection"');
    expect(production).toContain('id="storefrontStructureTree"');
    expect(production).toContain("loadCatalogue");
    expect(production).toContain("renderWebsiteStructure");
    expect(production).toContain("openStructureEditor");
    expect(production).toContain("publishStorefrontNode");
    expect(production).toContain("data-structure-publish");
    expect(production).toContain("/publish");
    expect(production).toContain("/admin/api/storefront-structure");
    expect(production).not.toContain('id="manageCategories"');
    expect(production).not.toContain('id="newCategoryType"');
    expect(production).not.toContain(">Manage categories<");
    expect(production).toContain('id="newProductCategorySearch"');
    expect(production).toContain('id="newProductCategorySelected"');
    expect(production).toContain("ensureProductEditorCategories");
    expect(production).toContain("Where should this product appear?");
    expect(production).toContain("<h3>Website placement</h3>");
    expect(production).toContain("productPlacementDisplay(p)");
    expect(production).toContain("function productPlacementLabel(placement)");
    expect(production).toContain("if(placement.name)return placement.name");
    expect(production).not.toContain("h.textContent==='Storefront placement'");
    expect(production).toContain("Primary section");
    expect(production).toContain("Sub-section · optional");
    expect(production).toContain("Child section · optional");
    expect(production).toContain("Also show in");
    expect(production).toContain("Product labels &amp; classification");
    expect(production).toContain("Preview draft");
    expect(production).toContain("async function duplicateProduct()");
    expect(production).toContain("async function archiveProduct()");
    expect(production).toContain("/duplicate");
    expect(production).toContain("/archive");
    expect(production).toContain("Duplicate created as a private draft.");
    expect(production).toContain("Published and verified on the public feed.");
    expect(production).toContain("/v1/catalog/");
    expect(production).toContain("View on website");
    expect(production).toContain("function openResponsiveProductDetail()");
    expect(production).toContain("window.matchMedia('(max-width: 900px)').matches");
    expect(production).toContain(
      "if(warning)warning.classList.toggle('hidden',!hasDraftSection)}",
    );
    expect(production).not.toContain(
      "</span>'};var warning=document.getElementById(prefix+'PlacementWarning')",
    );
    expect(production).not.toContain('id="newProductType"');
    expect(production).not.toContain('id="peType"');
    expect(production).toContain("· Archived");
    expect(production).toContain('id="stockValueButton"');
    expect(production).toContain('id="view-stock-value"');
    expect(production).toContain("Stock Value");
    expect(production).toContain("Value by supplier");
    expect(production).toContain("Potential gross profit");
    expect(production).toContain("loadStockValuation");
    expect(production).toContain("openProductCostEditor");
    expect(production).toContain("Item cost ex VAT");
    expect(production).toContain("VAT rate %");
    expect(production).toContain("Supplier product code");
    expect(production).toContain(
      "padding-bottom:calc(164px + env(safe-area-inset-bottom))",
    );
    expect(production).not.toContain(
      "Categories used by products cannot be archived until those products are moved to another category.",
    );

    expect(staging).toContain("STAGING");
    expect(staging).toContain("Reset test orders");
    expect(staging).toContain("RESET TEST ORDERS");
    expect(staging).toContain("Current payment &amp; fulfilment status");
    expect(staging).toContain("#dashboardMetrics,#orderMetrics{grid-template-columns:repeat(2");
    expect(staging).toContain("<svg viewBox=");
  });

  it("resolves every direct Admin onclick function reference", () => {
    const html = adminHtml("owner@example.com", "production");
    const refs = [
      ...html.matchAll(/\.onclick=([A-Za-z_$][\w$]*)/g),
    ]
      .map((match) => match[1])
      .filter((name) => name !== "function" && name !== "async");
    const missing = [...new Set(refs)].filter(
      (name) =>
        !html.includes("function " + name + "(") &&
        !html.includes("async function " + name + "("),
    );
    expect(missing).toEqual([]);
  });

  it("emits syntactically valid Admin login JavaScript", () => {
    const html = adminLoginHtml();
    compileInlineScripts(html);
    expect(html).toContain(
      "location.hostname==='admin.theblacksheepshop.co.uk'?'/':'/admin'+location.search+'#orders'",
    );
    expect(html).toContain('id="usePassword"');
    expect(html).toContain("Sign in with password");
    expect(html).toContain("post('/admin/auth/password',{password:password})");
    expect(html).toContain("location.reload()");
    expect(html).not.toContain(
      "location.href='/admin'+location.search+'#orders'",
    );
  });

  it("promotes iPad-width master/detail views into immediate overlays", () => {
    const html = adminHtml("owner@example.com");
    expect(html).toContain("function openResponsiveProductDetail()");
    expect(html).toContain(
      "window.innerWidth<=900||(window.matchMedia&&window.matchMedia('(max-width: 900px)').matches)",
    );
    expect(html).toContain("openResponsiveProductDetail()");
    expect(html).toContain(
      ".detail-open .order-panel{display:block;position:fixed;inset:72px 0 0 78px",
    );
    expect(html).toContain(
      ".product-detail-open .product-detail-panel{display:block;position:fixed;inset:72px 0 0 78px",
    );
    expect(html).toContain(
      ".structure-subrow,.brand-range-row{grid-template-columns:1fr}",
    );
    expect(html).toContain(
      ".mobile-bottom{position:fixed;display:grid;grid-template-columns:repeat(5,1fr)",
    );
    expect(html).not.toContain(
      ".mobile-bottom{grid-template-columns:repeat(7,1fr)}",
    );
    expect(html).toContain(
      "@media(max-width:720px){.placement-grid,.placement-options{grid-template-columns:1fr}",
    );
    expect(html).toContain('aria-controls="adminNavigation"');
    expect(html).toContain('<dialog class="admin-navigation"');
    expect(html).toContain("adminNavigation.showModal()");
    expect(html).toContain("document.getElementById('mobileLogout').onclick=logoutAdmin");
  });
});
