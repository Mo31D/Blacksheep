import { describe, expect, it, vi } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { COMMERCE_CATALOG } from "../src/generated/catalog";
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

const idempotencyKey = "123e4567-e89b-42d3-a456-426614174000";
const purchasable = COMMERCE_CATALOG.find(
  (item) => item.purchasable && item.priceMinor !== null,
)!;

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
        productId: purchasable.id,
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

const deps = {
  verifyTurnstileFn: vi.fn(async () => ({
    success: true,
    hostname: "theblacksheepshop.co.uk",
    action: "order_request",
  })),
  randomUUID: () => "48f112bf-3eae-4aa4-8338-b2a37c2f2d19",
  createReference: () => "BSR-260924-ABCDEFGH",
};

describe("POST /v1/orders", () => {
  it("creates a server-priced order and ignores forged browser prices", async () => {
    const db = new FakeDb();

    const response = await handleCreateOrder(request(), env(db), deps);
    const payload = (await response.json()) as any;

    expect(response.status).toBe(201);
    expect(payload.paymentTaken).toBe(false);
    expect(payload.order.reference).toBe("BSR-260924-ABCDEFGH");
    expect(payload.order.itemsSubtotalMinor).toBe(purchasable.priceMinor! * 2);

    const itemInsert = db.batched.find((statement) =>
      statement.sql.includes("INSERT INTO order_items"),
    )!;
    expect(itemInsert.values[6]).toBe(purchasable.priceMinor);
    expect(itemInsert.values[6]).not.toBe(1);
  });

  it("returns an existing order for an idempotent retry before reusing Turnstile", async () => {
    const db = new FakeDb();
    db.nextFirstResult = {
      id: "existing",
      publicReference: "BSR-260924-EXISTING",
      status: "SUBMITTED",
      createdAt: "2026-09-24T18:00:00.000Z",
    };
    const verify = vi.fn(async () => ({ success: true }));

    const response = await handleCreateOrder(request(), env(db), {
      ...deps,
      verifyTurnstileFn: verify,
    });
    const payload = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(payload.idempotentReplay).toBe(true);
    expect(payload.order.reference).toBe("BSR-260924-EXISTING");
    expect(verify).not.toHaveBeenCalled();
    expect(db.batched).toHaveLength(0);
  });

  it("rejects failed or replayed Turnstile tokens", async () => {
    const db = new FakeDb();
    const response = await handleCreateOrder(request(), env(db), {
      ...deps,
      verifyTurnstileFn: vi.fn(async () => ({
        success: false,
        "error-codes": ["timeout-or-duplicate"],
      })),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "turnstile_failed" },
    });
    expect(db.batched).toHaveLength(0);
  });

  it.each(["arriving_soon", "out_of_stock", "price_unavailable"] as const)(
    "rejects %s catalogue products",
    async (reason) => {
      const blocked = COMMERCE_CATALOG.find(
        (item) => item.nonPurchasableReason === reason,
      )!;
      expect(blocked).toBeTruthy();

      const db = new FakeDb();
      const response = await handleCreateOrder(
        request(
          body({
            items: [{ productId: blocked.id, quantity: 1 }],
          }),
        ),
        env(db),
        deps,
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "product_not_purchasable" },
      });
      expect(db.batched).toHaveLength(0);
    },
  );

  it("rejects stale or deleted catalogue product IDs", async () => {
    const db = new FakeDb();
    const response = await handleCreateOrder(
      request(
        body({
          items: [{ productId: "DELETED-PRODUCT-ID", quantity: 1 }],
        }),
      ),
      env(db),
      deps,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "product_not_found" },
    });
    expect(db.batched).toHaveLength(0);
  });

  it("requires a UUID idempotency key", async () => {
    const db = new FakeDb();
    const response = await handleCreateOrder(
      request(body(), "not-a-uuid"),
      env(db),
      deps,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_idempotency_key" },
    });
  });

  it("enforces the current GB-only delivery rule", async () => {
    const db = new FakeDb();
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
  });

  it("rate limits repeated order creation attempts", async () => {
    const db = new FakeDb();
    const rateEnv = env(db);
    rateEnv.ORDER_RATE_LIMITER = {
      async limit() {
        return { success: false };
      },
    };

    const response = await handleCreateOrder(request(), rateEnv, deps);
    expect(response.status).toBe(429);
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
      deps,
    );

    expect(response.status).toBe(201);
  });
});
