import { describe, expect, it } from "vitest";
import { createPublicOrderReference } from "../src/domain/order-reference";

describe("public order reference", () => {
  it("contains UTC date plus a non-sequential random suffix", () => {
    const reference = createPublicOrderReference(
      new Date("2026-09-24T18:30:00.000Z"),
      (target) => {
        target.fill(1);
        return target;
      },
    );

    expect(reference).toMatch(/^BSR-260924-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });
});
