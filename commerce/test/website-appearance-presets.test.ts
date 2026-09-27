import { describe, expect, it } from "vitest";
import {
  listWebsiteAppearancePresets,
  normalizeWebsiteAppearancePresetKey,
  validateAppearanceContrast,
} from "../src/data/website-appearance";

describe("CARD 09 seasonal Website Appearance presets", () => {
  it("exposes the five approved owner presets", () => {
    const presets = listWebsiteAppearancePresets();
    expect(presets.map((preset) => preset.key)).toEqual([
      "DEFAULT",
      "WINTER",
      "CHRISTMAS",
      "SUMMER",
      "ICE_CREAM",
    ]);
    expect(presets.map((preset) => preset.label)).toEqual([
      "Default",
      "Winter",
      "Christmas",
      "Summer",
      "Ice Cream",
    ]);
  });

  it("keeps every bundled preset within the readable contrast guard", () => {
    for (const preset of listWebsiteAppearancePresets()) {
      expect(() => validateAppearanceContrast(preset.tokens)).not.toThrow();
    }
  });

  it("rejects arbitrary preset keys", () => {
    expect(() =>
      normalizeWebsiteAppearancePresetKey("NEON_CUSTOM", "DEFAULT"),
    ).toThrow("appearance_preset_invalid");
  });

  it("rejects owner colour combinations that make content unreadable", () => {
    const base = listWebsiteAppearancePresets()[0].tokens;
    expect(() =>
      validateAppearanceContrast({
        ...base,
        text: "#f8f4ea",
        background: "#f8f4ea",
      }),
    ).toThrow("appearance_contrast_invalid");
  });
});
