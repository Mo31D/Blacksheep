import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { adminHtml } from "../src/admin/ui";

const script = Array.from(adminHtml("owner@example.test").matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g), m => m[1]).join("\n");
function functionSource(name: string) {
  const line = script.split("\n").find(line => line.startsWith("async function " + name + "(") || line.startsWith("function " + name + "("));
  if (!line) throw new Error("Missing generated function: " + name);
  return line;
}

describe("Product brand input ownership in emitted Admin JavaScript", () => {
  it.each(["saveProductDraft", "createProductFromSheet"])(
    "%s sends the explicit maker rather than a selected range label", async name => {
      const values: Record<string, string> = {
        peTitle: "Toffee", peDesc: "Updated description", peMakerName: "Walker's Nonsuch",
        newProductTitle: "Toffee", newProductDesc: "Description", newProductMakerName: "Walker's Nonsuch",
        newProductPrice: "", newProductCost: "", newProductVat: "20",
        newProductSupplier: "", newProductSupplierCode: "", newProductSku: "", newProductBarcode: "",
      };
      const api = vi.fn(async (_path: string, _options: { body: string }) => ({ product: { id: "p", version: 2 } }));
      const showToast = vi.fn();
      const context = {
        api, showToast, productCurrent: { id: "p", version: 1, brand: "Walker's Nonsuch", productType: "gifts" },
        productCategories: [{ id: "cat-range", name: "Romney's", categoryType: "BRAND_RANGE" }],
        document: { getElementById: (id: string) => ({ value: values[id] ?? "" }) },
        selectedCategoryIds: () => ["cat-range"], readPlacementEditor: () => ({ primaryNodeId: "gifts" }),
        productTypeForPlacement: () => "gifts", closeCatalogSheet() {}, loadProducts: async () => {},
        renderProductDetail() {}, openResponsiveProductDetail() {}, productsLoaded: true,
      };
      // Include the current helper when reproducing the old destructive projection.
      const oldHelper = script.match(/function brandNameForCategoryIds\(ids\)\{[^\n]+/)?.[0] ?? "";
      await runInNewContext(oldHelper + "\n" + functionSource(name) + "\n" + name + "()", context);
      expect(api).toHaveBeenCalledOnce();
      const request = JSON.parse(api.mock.calls[0][1].body);
      expect(name === "saveProductDraft" ? request.changes.brand : request.brand).toBe("Walker's Nonsuch");
      expect(name === "saveProductDraft" ? request.changes.categoryIds : request.categoryIds).toEqual(["cat-range"]);
      expect(showToast.mock.calls.some(call => call[1] === true)).toBe(false);
    },
  );

  it("pre-populates the explicit maker from the Product snapshot", async () => {
    let form = "";
    const context = {
      productCurrent: { id: "p", brand: "The Leonardo Collection", title: "Gift", categories: [] },
      ensureProductEditorCategories: async () => {}, ensureProductStorefrontNodes: async () => {},
      openProductSheet: (html: string) => { form = html; }, esc: (value: unknown) => String(value ?? ""),
      placementEditorHtml: () => "", categoryChoices: () => "", document: {
        querySelectorAll: () => [], getElementById: () => ({}),
      },
      wirePlacementEditor() {}, wireCategoryPicker() {}, saveProductDraft() {}, showToast: vi.fn(),
    };
    await runInNewContext(functionSource("productMakerField") + "\n" + functionSource("openProductEditor") + "\nopenProductEditor()", context);
    expect(form).toContain('id="peMakerName"');
    expect(form).toContain('value="The Leonardo Collection"');
    expect(form).toContain("Product brand / maker");
  });
});

