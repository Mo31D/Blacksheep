import { describe, expect, it } from "vitest";
import { CloudflareEmailOrderNotifier } from "../src/notifications/cloudflare-email";

describe("owner operational emails", () => {
  it("renders a premium new-order summary with a direct Admin order link", async () => {
    const sent: any[] = [];
    const notifier = new CloudflareEmailOrderNotifier(
      {
        async send(message) {
          sent.push(message);
          return { id: "msg-owner-1" };
        },
      },
      "orders@theblacksheepshop.co.uk",
      "owner@example.com",
      "https://admin.example.com/admin",
    );

    await notifier.notifyOwner({
      order: {
        id: "order-1",
        publicReference: "BSR-260925-TEST1234",
        status: "SUBMITTED",
        createdAt: "2026-09-25T17:00:00.000Z",
      },
      request: {
        id: "order-1",
        publicReference: "BSR-260925-TEST1234",
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
        currency: "GBP",
        fulfilmentMethod: "delivery",
        customerName: "Test Customer",
        customerEmail: "customer@example.com",
        customerPhone: "07123456789",
        deliveryAddress: {
          line1: "1 Lake Road",
          line2: null,
          town: "Ambleside",
          county: "Cumbria",
          postcode: "LA22 0AA",
          country: "GB",
        },
        customerNote: "Please leave a note before delivery.",
        itemsSubtotalMinor: 2495,
        items: [
          {
            catalogProductId: "PR-046",
            sku: "A29927",
            slug: "test-product",
            productName: "Test Product",
            unitPriceMinor: 2495,
            quantity: 1,
            lineTotalMinor: 2495,
          },
        ],
      },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("BSR-260925-TEST1234");
    expect(sent[0].subject).toContain("Delivery");
    expect(sent[0].html).toContain("PRIVATE ADMIN");
    expect(sent[0].html).toContain("Open order in Admin");
    expect(sent[0].html).toContain(
      "https://admin.example.com/admin?order=BSR-260925-TEST1234#orders",
    );
    expect(sent[0].html).toContain("1 Lake Road");
    expect(sent[0].html).toContain("Please leave a note before delivery.");
    expect(sent[0].text).toContain("Next action:");
    expect(sent[0].replyTo).toEqual({
      email: "customer@example.com",
      name: "Test Customer",
    });
  });
});
