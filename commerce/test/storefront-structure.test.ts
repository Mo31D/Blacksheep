import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import {
  categorySlugsForIds,
  compatibilityPlacementStatements,
  compatibilityStorefrontPlacements,
  ownerPlacementStatements,
  resolveOwnerStorefrontPlacements,
} from "../src/data/storefront-structure";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(
    public readonly sql: string,
    private readonly rows: unknown[] = [],
  ) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.rows as T[] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  prepared: Statement[] = [];
  constructor(private readonly categoryRows: unknown[] = []) {}
  prepare(sql: string): Statement {
    const rows = sql.includes("FROM categories") ? this.categoryRows : [];
    const statement = new Statement(sql, rows);
    this.prepared.push(statement);
    return statement;
  }
  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

class OwnerPlacementDb implements D1DatabaseLike {
  prepared: Statement[] = [];
  constructor(private readonly rows: unknown[]) {}
  prepare(sql: string): Statement {
    const resultRows = sql.includes("FROM storefront_nodes WHERE id IN")
      ? this.rows
      : [];
    const statement = new Statement(sql, resultRows);
    this.prepared.push(statement);
    return statement;
  }
  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

describe("CARD 01 legacy → Storefront compatibility mapping", () => {
  it("uses the most specific mapped Gift primary and preserves extra destinations", () => {
    expect(
      compatibilityStorefrontPlacements(
        "gifts",
        ["highland-cows", "seasonal", "home-gifts"],
        "highland-cows",
      ),
    ).toEqual([
      {
        storefrontNodeId: "sfn_gifts_highland_cows",
        isPrimary: true,
        position: 0,
      },
      {
        storefrontNodeId: "sfn_gifts_seasonal",
        isPrimary: false,
        position: 10,
      },
      {
        storefrontNodeId: "sfn_gifts_home_gifts",
        isPrimary: false,
        position: 20,
      },
    ]);
  });

  it("maps Romney's and Hawkshead root categories to their section roots", () => {
    expect(
      compatibilityStorefrontPlacements(
        "romneys",
        ["romneys", "fudge", "gift-boxes"],
        "romneys",
      ),
    ).toEqual([
      { storefrontNodeId: "sfn_romneys", isPrimary: true, position: 0 },
      {
        storefrontNodeId: "sfn_romneys_fudge",
        isPrimary: false,
        position: 10,
      },
      {
        storefrontNodeId: "sfn_romneys_gift_boxes",
        isPrimary: false,
        position: 20,
      },
    ]);

    expect(
      compatibilityStorefrontPlacements(
        "hawkshead",
        ["hawkshead", "chutneys-pickles"],
        "hawkshead",
      )[0],
    ).toEqual({
      storefrontNodeId: "sfn_hawkshead",
      isPrimary: true,
      position: 0,
    });
  });

  it("falls back to the Product type root when no category maps", () => {
    expect(
      compatibilityStorefrontPlacements("icecream", [], null),
    ).toEqual([
      {
        storefrontNodeId: "sfn_icecream",
        isPrimary: true,
        position: 0,
      },
    ]);
  });

  it("does not invent a placement for an unknown legacy type/category", () => {
    expect(
      compatibilityStorefrontPlacements("unknown", ["unknown"], null),
    ).toEqual([]);
  });

  it("keeps category order while resolving IDs to slugs", async () => {
    const db = new Db([
      { id: "cat-b", slug: "seasonal" },
      { id: "cat-a", slug: "highland-cows" },
    ]);
    await expect(
      categorySlugsForIds(db, ["cat-a", "cat-b"]),
    ).resolves.toEqual(["highland-cows", "seasonal"]);
  });

  it("builds guarded replacement statements so stale Product writes cannot alter placements", () => {
    const db = new Db();
    const statements = compatibilityPlacementStatements(db, {
      productVersionId: "pver-1",
      productType: "gifts",
      categorySlugs: ["highland-cows", "seasonal"],
      primaryCategorySlug: "highland-cows",
      source: "LEGACY_COMPAT",
      createdAt: "2026-09-26T20:00:00.000Z",
      guard: {
        productId: "prd-1",
        resultVersion: 7,
        token: "token-7",
      },
    });

    expect(statements).toHaveLength(3);
    expect((statements[0] as Statement).sql).toContain(
      "EXISTS (SELECT 1 FROM products",
    );
    expect((statements[1] as Statement).sql).toContain(
      "SELECT ?, ?, ?, ?, ?, ? FROM products",
    );
    expect((statements[1] as Statement).values.slice(0, 2)).toEqual([
      "pver-1",
      "sfn_gifts_highland_cows",
    ]);
    expect((statements[2] as Statement).values.slice(0, 2)).toEqual([
      "pver-1",
      "sfn_gifts_seasonal",
    ]);
  });
});


describe("CARD 03 owner-selected Storefront placements", () => {
  it("accepts one primary plus unique additional live nodes", async () => {
    const db = new OwnerPlacementDb([
      {
        id: "sfn_gifts_highland_cows",
        publicationStatus: "ACTIVE",
        publishedVersionId: "sfv-hc",
      },
      {
        id: "sfn_gifts_seasonal",
        publicationStatus: "ACTIVE",
        publishedVersionId: "sfv-seasonal",
      },
    ]);

    await expect(
      resolveOwnerStorefrontPlacements(db, {
        primaryNodeId: "sfn_gifts_highland_cows",
        additionalNodeIds: [
          "sfn_gifts_seasonal",
          "sfn_gifts_seasonal",
          "sfn_gifts_highland_cows",
        ],
      }),
    ).resolves.toEqual([
      {
        storefrontNodeId: "sfn_gifts_highland_cows",
        isPrimary: true,
        position: 0,
      },
      {
        storefrontNodeId: "sfn_gifts_seasonal",
        isPrimary: false,
        position: 10,
      },
    ]);
  });

  it("rejects draft or archived Storefront nodes for a publishable Product placement", async () => {
    const db = new OwnerPlacementDb([
      {
        id: "sfn-draft",
        publicationStatus: "DRAFT",
        publishedVersionId: null,
      },
    ]);

    await expect(
      resolveOwnerStorefrontPlacements(db, {
        primaryNodeId: "sfn-draft",
        additionalNodeIds: [],
      }),
    ).rejects.toThrow("product_storefront_node_not_live");
  });

  it("writes explicit owner placements with one guarded primary", () => {
    const db = new OwnerPlacementDb([]);
    const statements = ownerPlacementStatements(db, {
      productVersionId: "pver-owner",
      placements: [
        {
          storefrontNodeId: "sfn_gifts_highland_cows",
          isPrimary: true,
          position: 0,
        },
        {
          storefrontNodeId: "sfn_gifts_seasonal",
          isPrimary: false,
          position: 10,
        },
      ],
      createdAt: "2026-09-26T22:00:00.000Z",
      guard: {
        productId: "prd-owner",
        resultVersion: 9,
        token: "token-9",
      },
    });

    expect(statements).toHaveLength(3);
    expect((statements[1] as Statement).sql).toContain("'OWNER'");
    expect((statements[1] as Statement).values.slice(0, 3)).toEqual([
      "pver-owner",
      "sfn_gifts_highland_cows",
      1,
    ]);
    expect((statements[2] as Statement).values.slice(0, 3)).toEqual([
      "pver-owner",
      "sfn_gifts_seasonal",
      0,
    ]);
  });
});
