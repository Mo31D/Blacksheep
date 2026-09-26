import { describe, expect, it, vi } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleCreateOrder } from "../src/routes/orders";

class FakeStatement implements D1PreparedStatementLike {
  values: unknown[] = [];

  constructor(
    public readonly sql: string,
    private readonly firstResult: unknown = null,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.firstResult as T | null) ?? null;
  }

  async run(): Promise<unknown> {
    return {};
  }
}

class FakeDb implements D1DatabaseLike {
  prepared: FakeStatement[] = [];
  batched: FakeStatement[] = [];
  nextFirstResult: unknown = null;

  prepare(query: string): FakeStatement {
    const statement = new FakeStatement(query, this.nextFirstResult);
    this.nextFirstResult = null;
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched = statements as FakeStatement[];
    return [] as T[];
  }
}

const product = {
  id: "HC-003",
  sku: "LP75455",
  slug: "hc-003-three-highland-cows-see-hear-speak-no-evil-ornament",
  name: "Highland Cow Trio",
  priceMinor: 1495,
};

const idempotencyKey = "123e4567-e89b-42d3-a456-426614174000";

function body(overrides: Record<string, unknown> = {}) {
  return {
    turnstileToken: "valid-turnstile-token",
    fulfilmentMethod: "delivery",
    customer: {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "07123456789",
    },
    deliveryAddress: {
      line1: "12 Example Road",
      town: "Kendal",
      postcode: "LA9 4AA",
      country: "GB",
    },
    items: [
      {
        productId: product.id,
        quantity: 2,
        priceMinor: 1,
      },
    ],
    ...overrides,
  };
}

function request(payload = body(), key = idempotencyKey): Request {
  return new Request("https://api.example.test/v1/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": key,
    },
    body: JSON.stringify(payload),
  });
}

function env(db: FakeDb) {
  return {
    DB: db,
    TURNSTILE_SECRET_KEY: "test-secret",
    TURNSTILE_ALLOWED_HOSTNAMES: "theblacksheepshop.co.uk",
    TURNSTILE_EXPECTED_ACTION: "order_request",
    ORDER_RATE_LIMITER: {
      async limit() {
        return { success: true };
      },
    },
  };
}

function pricing(
  requested: readonly { productId: string; quantity: number }[],
) {
  return {
    currency: "GBP" as const,
    itemsSubtotalMinor: requested.reduce(
      (sum, line) => sum + product.priceMinor * line.quantity,
      0,
    ),
    lines: requested.map((line) => ({
      productId: line.productId,
      sku: product.sku,
      slug: product.slug,
      productName: product.name,
      unitPriceMinor: product.priceMinor,
      quantity: line.quantity,
      lineTotalMinor: product.priceMinor * line.quantity,
    })),
  };
}

function dependencies(
  pricingFn = vi.fn(async (
    _db: D1DatabaseLike,
    requested: readonly { productId: string; quantity: number }[],
  ) => pricing(requested)),
) {
  return {
    verifyTurnstileFn: vi.fn(async () => ({
      success: true,
      hostname: "theblacksheepshop.co.uk",
      action: "order_request",
    })),
    notifyOrderSubmittedFn: vi.fn(async () => undefined),
    randomUUID: () => "48f112bf-3eae-4aa4-8338-b2a37c2f2d19",
    createReference: () => "BSR-260924-ABCDEFGH",
    priceRequestedCartFromD1Fn: pricingFn,
  };
}

describe("POST /v1/orders", () => {
  it("creates a D1 server-priced order and ignores forged browser prices", async () => {
    const db = new FakeDb();
    const deps = dependencies();

    const response = await handleCreateOrder(request(), env(db), deps);
    const payload = (await response.json()) as any;

    expect(response.status).toBe(201);
    expect(payload.paymentTaken).toBe(false);
    expect(payload.order.reference).toBe("BSR-260924-ABCDEFGH");
    expect(payload.order.itemsSubtotalMinor).toBe(product.priceMinor * 2);
    expect(deps.priceRequestedCartFromD1Fn).toHaveBeenCalledWith(
      db,
      expect.arrayContaining([
        expect.objectContaining({ productId: product.id, quantity: 2 }),
      ]),
    );

    const itemInsert = db.batched.find((statement) =>
      statement.sql.includes("INSERT INTO order_items"),
    )!;
    expect(itemInsert.values[6]).toBe(product.priceMinor);
    expect(itemInsert.values[6]).not.toBe(1);
  });

  it("uses D1 pricing even when no legacy authority flag is present", async () => {
    const db = new FakeDb();
    const d1Pricing = vi.fn(async () => ({
      currency: "GBP" as const,
      itemsSubtotalMinor: 2468,
      lines: [
        {
          productId: product.id,
          sku: product.sku,
          slug: product.slug,
          productName: product.name,
          unitPriceMinor: 1234,
          quantity: 2,
          lineTotalMinor: 2468,
        },
      ],
    }));

    const response = await handleCreateOrder(
      request(),
      env(db),
      dependencies(d1Pricing),
    );
    const payload = (await response.json()) as any;

    expect(response.status).toBe(201);
    expect(payload.order.itemsSubtotalMinor).toBe(2468);
    expect(d1Pricing).toHaveBeenCalledTimes(1);

    const itemInsert = db.batched.find((statement) =>
      statement.sql.includes("INSERT INTO order_items"),
    )!;
    expect(itemInsert.values[6]).toBe(1234);
  });

  it("returns an existing order for an idempotent retry before Turnstile or D1 pricing", async () => {
    const db = new FakeDb();
    db.nextFirstResult = {
      id: "existing",
      publicReference: "BSR-260924-EXISTING",
      status: "SUBMITTED",
      createdAt: "2026-09-24T18:00:00.000Z",
    };
    const d1Pricing = vi.fn(async () => pricing([{ productId: product.id, quantity: 2 }]));
    const deps = dependencies(d1Pricing);

    const response = await handleCreateOrder(request(), env(db), deps);
    const payload = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(payload.idempotentReplay).toBe(true);
    expect(payload.order.reference).toBe("BSR-260924-EXISTING");
    expect(deps.verifyTurnstileFn).not.toHaveBeenCalled();
    expect(d1Pricing).not.toHaveBeenCalled();
    expect(db.batched).toHaveLength(0);
  });

  it("rejects failed or replayed Turnstile tokens before D1 pricing", async () => {
    const db = new FakeDb();
    const d1Pricing = vi.fn(async () => pricing([{ productId: product.id, quantity: 2 }]));
    const deps = dependencies(d1Pricing);
    deps.verifyTurnstileFn = vi.fn(async () => ({
      success: false,
      "error-codes": ["timeout-or-duplicate"],
    })) as any;

    const response = await handleCreateOrder(request(), env(db), deps);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "turnstile_failed" },
    });
    expect(d1Pricing).not.toHaveBeenCalled();
    expect(db.batched).toHaveLength(0);
  });

  it.each(["arriving_soon", "out_of_stock", "price_unavailable"] as const)(
    "maps D1 %s products to product_not_purchasable",
    async (reason) => {
      const db = new FakeDb();
      const d1Pricing = vi.fn(async () => {
        throw new Error(reason);
      });

      const response = await handleCreateOrder(
        request(),
        env(db),
        dependencies(d1Pricing),
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "product_not_purchasable" },
      });
      expect(db.batched).toHaveLength(0);
    },
  );

  it("rejects stale or deleted D1 product IDs", async () => {
    const db = new FakeDb();
    const d1Pricing = vi.fn(async () => {
      throw new Error("catalog_product_not_found");
    });

    const response = await handleCreateOrder(
      request(
        body({
          items: [{ productId: "DELETED-PRODUCT-ID", quantity: 1 }],
        }),
      ),
      env(db),
      dependencies(d1Pricing),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "product_not_found" },
    });
    expect(db.batched).toHaveLength(0);
  });

  it("requires a UUID idempotency key before D1 pricing", async () => {
    const db = new FakeDb();
    const deps = dependencies();

    const response = await handleCreateOrder(
      request(body(), "not-a-uuid"),
      env(db),
      deps,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_idempotency_key" },
    });
    expect(deps.priceRequestedCartFromD1Fn).not.toHaveBeenCalled();
  });

  it("enforces the current GB-only delivery rule", async () => {
    const db = new FakeDb();
    const deps = dependencies();

    const response = await handleCreateOrder(
      request(
        body({
          deliveryAddress: {
            line1: "1 Main Street",
            town: "Dublin",
            postcode: "D02",
            country: "IE",
          },
        }),
      ),
      env(db),
      deps,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "delivery_country_not_supported" },
    });
    expect(deps.priceRequestedCartFromD1Fn).not.toHaveBeenCalled();
  });

  it("rate limits repeated order creation attempts before D1 pricing", async () => {
    const db = new FakeDb();
    const rateEnv = env(db);
    rateEnv.ORDER_RATE_LIMITER = {
      async limit() {
        return { success: false };
      },
    };
    const deps = dependencies();

    const response = await handleCreateOrder(request(), rateEnv, deps);
    expect(response.status).toBe(429);
    expect(deps.priceRequestedCartFromD1Fn).not.toHaveBeenCalled();
    expect(db.batched).toHaveLength(0);
  });

  it("accepts collection without a delivery address", async () => {
    const db = new FakeDb();
    const response = await handleCreateOrder(
      request(
        body({
          fulfilmentMethod: "collection",
          deliveryAddress: undefined,
        }),
      ),
      env(db),
      dependencies(),
    );

    expect(response.status).toBe(201);
  });
});
