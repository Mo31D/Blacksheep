import { describe, expect, it } from "vitest";
import {
  costIncludingVat,
  DEFAULT_RETAIL_MULTIPLIER,
  DEFAULT_VAT_RATE_BASIS_POINTS,
  estimateCostFromRetail,
  retailExcludingVat,
} from "../src/data/inventory-valuation";

describe("stock valuation pricing policy", () => {
  it("uses the default 2x retail rule with 20% VAT for estimated cost", () => {
    expect(DEFAULT_RETAIL_MULTIPLIER).toBe(2);
    expect(DEFAULT_VAT_RATE_BASIS_POINTS).toBe(2000);
    expect(estimateCostFromRetail(1000, 2000)).toEqual({
      costIncVatMinor: 500,
      costExVatMinor: 417,
    });
  });

  it("keeps actual supplier cost as ex-VAT and derives VAT-inclusive cost", () => {
    expect(costIncludingVat(400, 2000)).toBe(480);
    expect(retailExcludingVat(1000, 2000)).toBe(833);
  });

  it("does not invent an estimate when retail price is missing", () => {
    expect(estimateCostFromRetail(null, 2000)).toEqual({
      costIncVatMinor: null,
      costExVatMinor: null,
    });
  });

  it("supports product-specific VAT rates", () => {
    expect(estimateCostFromRetail(1000, 0)).toEqual({
      costIncVatMinor: 500,
      costExVatMinor: 500,
    });
    expect(costIncludingVat(500, 500)).toBe(525);
  });
});
