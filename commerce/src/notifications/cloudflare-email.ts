import type {
  OrderNotificationContext,
  OrderNotifier,
  SendEmailBindingLike,
} from "./order-notifier";
import {
  emailMoney,
  escapeEmailHtml,
  itemsText,
  renderItemsTable,
  renderTransactionalEmail,
} from "./email-template";

export class CloudflareEmailOrderNotifier implements OrderNotifier {
  constructor(
    private readonly email: SendEmailBindingLike,
    private readonly fromEmail: string,
    private readonly ownerEmail: string,
  ) {}

  async notifyOwner(context: OrderNotificationContext): Promise<unknown> {
    const method =
      context.request.fulfilmentMethod === "collection" ? "Collection" : "Delivery";
    const subject = `New Black Sheep order request ${context.order.publicReference}`;
    const message = renderTransactionalEmail({
      preheader: `${method} request · ${emailMoney(context.request.itemsSubtotalMinor)}`,
      eyebrow: "New order request",
      title: "A new order needs review",
      reference: context.order.publicReference,
      intro: `${context.request.customerName} has submitted a ${method.toLowerCase()} request. Check availability before sending the final total.`,
      bodyText: [
        `Customer: ${context.request.customerName}`,
        `Email: ${context.request.customerEmail}`,
        `Phone: ${context.request.customerPhone || "Not provided"}`,
        `Requested fulfilment: ${method}`,
        `Items subtotal: ${emailMoney(context.request.itemsSubtotalMinor)}`,
        "",
        itemsText(context.request.items),
      ].join("\n"),
      bodyHtml: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:7px 0;color:#756f64">Customer</td><td align="right" style="padding:7px 0;font-weight:700">${escapeEmailHtml(context.request.customerName)}</td></tr>
          <tr><td style="padding:7px 0;color:#756f64">Email</td><td align="right" style="padding:7px 0;font-weight:700">${escapeEmailHtml(context.request.customerEmail)}</td></tr>
          <tr><td style="padding:7px 0;color:#756f64">Phone</td><td align="right" style="padding:7px 0;font-weight:700">${escapeEmailHtml(context.request.customerPhone || "Not provided")}</td></tr>
          <tr><td style="padding:7px 0;color:#756f64">Fulfilment</td><td align="right" style="padding:7px 0;font-weight:700">${method}</td></tr>
          <tr><td style="padding:7px 0;color:#756f64">Items subtotal</td><td align="right" style="padding:7px 0;font-weight:700">${emailMoney(context.request.itemsSubtotalMinor)}</td></tr>
        </table>
        ${renderItemsTable(context.request.items)}
        <p style="font-size:14px;line-height:1.6;color:#655f56;margin:18px 0 0">Open the private owner dashboard to review availability, any changes and delivery before contacting the customer.</p>
      `,
    });

    return this.email.send({
      from: { email: this.fromEmail, name: "The Black Sheep Shop" },
      to: this.ownerEmail,
      replyTo: {
        email: context.request.customerEmail,
        name: context.request.customerName,
      },
      subject,
      text: message.text,
      html: message.html,
    });
  }

  async acknowledgeCustomer(context: OrderNotificationContext): Promise<unknown> {
    const subject = `We received your order request ${context.order.publicReference}`;
    const method =
      context.request.fulfilmentMethod === "collection" ? "Collection" : "Delivery";
    const message = renderTransactionalEmail({
      preheader: "Your Black Sheep Shop order request has been received.",
      eyebrow: "Order request received",
      title: "Thanks — we have your request",
      reference: context.order.publicReference,
      greeting: `Hello ${context.request.customerName},`,
      intro:
        "We will check the requested items before asking you to pay. No payment has been taken at this stage.",
      bodyText: [
        `Requested fulfilment: ${method}`,
        `Items subtotal: ${emailMoney(context.request.itemsSubtotalMinor)}`,
        "",
        itemsText(context.request.items),
        "",
        "Next: we will confirm availability and, for delivery orders, the delivery cost. If anything needs changing, we will show the revised order clearly before payment.",
      ].join("\n"),
      bodyHtml: `
        <div style="border:1px solid #ded6c8;border-radius:14px;padding:16px 18px;background:#f8f4eb;margin:18px 0">
          <div style="font-size:13px;color:#756f64">Requested fulfilment</div>
          <div style="font-size:17px;font-weight:700;margin-top:3px">${method}</div>
          <div style="font-size:13px;color:#756f64;margin-top:12px">Items subtotal</div>
          <div style="font-size:22px;font-weight:800;margin-top:3px">${emailMoney(context.request.itemsSubtotalMinor)}</div>
        </div>
        ${renderItemsTable(context.request.items)}
        <p style="font-size:15px;line-height:1.65;margin:18px 0 0"><strong>What happens next?</strong><br>We will confirm availability and, for delivery orders, the delivery cost. If anything needs changing, we will show the revised order clearly before payment.</p>
      `,
    });

    return this.email.send({
      from: { email: this.fromEmail, name: "The Black Sheep Shop" },
      to: {
        email: context.request.customerEmail,
        name: context.request.customerName,
      },
      replyTo: { email: this.fromEmail, name: "The Black Sheep Shop" },
      subject,
      text: message.text,
      html: message.html,
    });
  }
}
