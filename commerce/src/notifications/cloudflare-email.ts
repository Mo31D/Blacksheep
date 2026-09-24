import type {
  OrderNotificationContext,
  OrderNotifier,
  SendEmailBindingLike,
} from "./order-notifier";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function money(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function itemText(context: OrderNotificationContext): string {
  return context.request.items
    .map(
      (item) =>
        `${item.quantity} × ${item.productName} — ${money(item.lineTotalMinor)}`,
    )
    .join("\n");
}

function itemHtml(context: OrderNotificationContext): string {
  return context.request.items
    .map(
      (item) =>
        `<li>${item.quantity} × ${escapeHtml(item.productName)} — <strong>${money(item.lineTotalMinor)}</strong></li>`,
    )
    .join("");
}

export class CloudflareEmailOrderNotifier implements OrderNotifier {
  constructor(
    private readonly email: SendEmailBindingLike,
    private readonly fromEmail: string,
    private readonly ownerEmail: string,
  ) {}

  async notifyOwner(context: OrderNotificationContext): Promise<void> {
    const method =
      context.request.fulfilmentMethod === "collection" ? "Collection" : "Delivery";
    const subject = `New Black Sheep order request ${context.order.publicReference}`;
    const text = [
      `New order request: ${context.order.publicReference}`,
      `Method: ${method}`,
      `Items subtotal: ${money(context.request.itemsSubtotalMinor)}`,
      "",
      itemText(context),
      "",
      "Open the private order dashboard to review availability and delivery.",
    ].join("\n");

    await this.email.send({
      from: { email: this.fromEmail, name: "The Black Sheep Shop" },
      to: this.ownerEmail,
      subject,
      text,
      html: `<h1>New order request</h1><p><strong>${escapeHtml(context.order.publicReference)}</strong></p><p>${method} · ${money(context.request.itemsSubtotalMinor)}</p><ul>${itemHtml(context)}</ul><p>Open the private order dashboard to review availability and delivery.</p>`,
    });
  }

  async acknowledgeCustomer(context: OrderNotificationContext): Promise<void> {
    const subject = `We received your order request ${context.order.publicReference}`;
    const method =
      context.request.fulfilmentMethod === "collection" ? "collection" : "delivery";
    const text = [
      `Hello ${context.request.customerName},`,
      "",
      `We received your Black Sheep Shop order request ${context.order.publicReference}.`,
      `Items subtotal: ${money(context.request.itemsSubtotalMinor)}.`,
      `Requested fulfilment: ${method}.`,
      "",
      "No payment has been taken.",
      "We will check availability and, for delivery orders, confirm the delivery cost before sending the final total and payment instructions.",
      "",
      itemText(context),
    ].join("\n");

    await this.email.send({
      from: { email: this.fromEmail, name: "The Black Sheep Shop" },
      to: {
        email: context.request.customerEmail,
        name: context.request.customerName,
      },
      subject,
      text,
      html: `<p>Hello ${escapeHtml(context.request.customerName)},</p><p>We received your Black Sheep Shop order request <strong>${escapeHtml(context.order.publicReference)}</strong>.</p><p>Items subtotal: <strong>${money(context.request.itemsSubtotalMinor)}</strong><br>Requested fulfilment: ${method}.</p><p><strong>No payment has been taken.</strong> We will check availability and, for delivery orders, confirm the delivery cost before sending the final total and payment instructions.</p><ul>${itemHtml(context)}</ul>`,
    });
  }
}
