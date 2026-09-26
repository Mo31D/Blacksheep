import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { archiveAdminCategory } from "../src/data/product-editor";
import { handleAdminRequest } from "../src/routes/admin";

class Statement implements D1PreparedStatementLike {
  bind(): D1PreparedStatementLike {
    return this;
  }
  async first<T>(): Promise<T | null> {
    return null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  prepare(): D1PreparedStatementLike {
    return new Statement();
  }
  async batch<T>(): Promise<T[]> {
    return [];
  }
}

const identity = async () => ({
  ok: true as const,
  status: 200,
  identity: { email: "owner@example.com", subject: "owner-1" },
});

const category = {
  id: "cat_highland",
  slug: "highland-cows",
  name: "Highland Cows",
  categoryType: "COLLECTION_THEME" as const,
  active: true,
  sortOrder: 10,
  productCount: 35,
};

function mutationRequest(path: string, body: unknown) {
  return new Request("https://admin.example.com" + path, {
    method: path.endsWith("/move") || path.endsWith("/archive") || path.endsWith("/restore")
      ? "POST"
      : "PATCH",
    headers: {
      origin: "https://admin.example.com",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Admin Category Manager", () => {
  it("lists active categories by default and can request archived rows", async () => {
    let includeArchived = false;
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/categories?includeArchived=1"),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        listAdminCategoriesFn: async (_db, options) => {
          includeArchived = options?.includeArchived === true;
          return [category];
        },
      },
    );

    expect(response.status).toBe(200);
    expect(includeArchived).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      categories: [{ name: "Highland Cows", productCount: 35 }],
    });
  });

  it("creates a category with a persisted group", async () => {
    let input: Record<string, unknown> | null = null;
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/categories", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Christmas Decorations",
          categoryType: "PRODUCT_CATEGORY",
        }),
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        createAdminCategoryFn: async (_db, raw) => {
          input = raw as Record<string, unknown>;
          return { id: "cat_new" };
        },
        listAdminCategoriesFn: async () => [
          {
            ...category,
            id: "cat_new",
            slug: "christmas-decorations",
            name: "Christmas Decorations",
            categoryType: "PRODUCT_CATEGORY",
            productCount: 0,
          },
        ],
      },
    );

    expect(response.status).toBe(201);
    expect(input).toMatchObject({
      name: "Christmas Decorations",
      categoryType: "PRODUCT_CATEGORY",
    });
  });

  it("renames/moves a category group and supports explicit ordering", async () => {
    let updated: Record<string, unknown> | null = null;
    let moved = "";
    const update = await handleAdminRequest(
      mutationRequest("/admin/api/categories/cat_highland", {
        name: "Highland Cow Gifts",
        categoryType: "PRODUCT_CATEGORY",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        updateAdminCategoryFn: async (_db, _id, raw) => {
          updated = raw as Record<string, unknown>;
        },
        listAdminCategoriesFn: async () => [
          {
            ...category,
            name: "Highland Cow Gifts",
            categoryType: "PRODUCT_CATEGORY",
          },
        ],
      },
    );
    expect(update.status).toBe(200);
    expect(updated).toMatchObject({
      name: "Highland Cow Gifts",
      categoryType: "PRODUCT_CATEGORY",
    });

    const move = await handleAdminRequest(
      mutationRequest("/admin/api/categories/cat_highland/move", {
        direction: "UP",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        moveAdminCategoryFn: async (_db, _id, direction) => {
          moved = direction;
        },
      },
    );
    expect(move.status).toBe(200);
    expect(moved).toBe("UP");
  });

  it("allows non-destructive archive even when products still use the category", async () => {
    let archived = false;
    const response = await handleAdminRequest(
      mutationRequest("/admin/api/categories/cat_highland/archive", {}),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        archiveAdminCategoryFn: async () => {
          archived = true;
        },
      },
    );

    expect(response.status).toBe(200);
    expect(archived).toBe(true);
  });

  it("archives without deleting existing product-category relationships", async () => {
    const sqlSeen: string[] = [];
    let archiveUpdateRan = false;
    const db: D1DatabaseLike = {
      prepare(sql: string): D1PreparedStatementLike {
        sqlSeen.push(sql);
        return {
          bind(): D1PreparedStatementLike {
            return this;
          },
          async first<T>(): Promise<T | null> {
            if (sql.startsWith("SELECT id, active FROM categories")) {
              return { id: "cat_highland", active: 1 } as T;
            }
            return null;
          },
          async all<T>(): Promise<{ results: T[] }> {
            return { results: [] };
          },
          async run(): Promise<unknown> {
            if (sql.startsWith("UPDATE categories SET active = 0")) {
              archiveUpdateRan = true;
            }
            return {};
          },
        };
      },
      async batch<T>(): Promise<T[]> {
        return [];
      },
    };

    await archiveAdminCategory(db, "cat_highland");

    expect(archiveUpdateRan).toBe(true);
    expect(
      sqlSeen.some((sql) =>
        /DELETE\s+FROM\s+product_version_categories/i.test(sql),
      ),
    ).toBe(false);
  });

  it("restores an archived category", async () => {
    let restored = false;
    const response = await handleAdminRequest(
      mutationRequest("/admin/api/categories/cat_highland/restore", {}),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        restoreAdminCategoryFn: async () => {
          restored = true;
        },
      },
    );
    expect(response.status).toBe(200);
    expect(restored).toBe(true);
  });
});
