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
  renderOwnerOperationalEmail,
  renderTransactionalEmail,
  adminOrderUrl,
} from "./email-template";

export class CloudflareEmailOrderNotifier implements OrderNotifier {
  constructor(
    private readonly email: SendEmailBindingLike,
    private readonly fromEmail: string,
    private readonly ownerEmail: string,
    private readonly adminBaseUrl: string,
  ) {}

  async notifyOwner(context: OrderNotificationContext): Promise<unknown> {
    const method =
      context.request.fulfilmentMethod === "collection" ? "Collection" : "Delivery";
    const subject =
      `New order · ${context.order.publicReference} · ${method} · ${emailMoney(context.request.itemsSubtotalMinor)}`;
    const orderUrl = adminOrderUrl(
      this.adminBaseUrl,
      context.order.publicReference,
    );
    const address = context.request.deliveryAddress;
    const addressText =
      method === "Delivery" && address
        ? [
            address.line1,
            address.line2,
            address.town,
            address.county,
            address.postcode,
            address.country,
          ]
            .filter(Boolean)
            .join(", ")
        : "Collection from Ambleside";
    const note = context.request.customerNote?.trim() || null;

    const message = renderOwnerOperationalEmail({
      preheader: `${method} · ${context.request.customerName} · ${emailMoney(context.request.itemsSubtotalMinor)}`,
      eyebrow: "New order · Action required",
      title: "A new order is waiting for review",
      reference: context.order.publicReference,
      intro:
        "Everything below is the customer's original request. Review stock and fulfilment in Admin before sending the confirmed version.",
      bodyText: [
        `Customer: ${context.request.customerName}`,
        `Email: ${context.request.customerEmail}`,
        `Phone: ${context.request.customerPhone || "Not provided"}`,
        `Fulfilment: ${method}`,
        `Address: ${addressText}`,
        `Items subtotal: ${emailMoney(context.request.itemsSubtotalMinor)}`,
        note ? `Customer note: ${note}` : null,
        "",
        itemsText(context.request.items),
        "",
        "Next action: open this order in Admin, confirm availability and prepare the reviewed quote.",
      ]
        .filter((line) => line !== null)
        .join("\n"),
      bodyHtml: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;border:1px solid #ddd3c3;border-radius:15px;overflow:hidden;background:#faf6ee">
          <tr>
            <td width="50%" style="padding:14px 16px;border-right:1px solid #e4dacb;border-bottom:1px solid #e4dacb">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:#8a7140;font-weight:800">Customer</div>
              <div style="font-size:16px;font-weight:800;margin-top:4px">${escapeEmailHtml(context.request.customerName)}</div>
              <div style="font-size:12px;color:#655f56;margin-top:4px">${escapeEmailHtml(context.request.customerEmail)}</div>
              <div style="font-size:12px;color:#655f56;margin-top:2px">${escapeEmailHtml(context.request.customerPhone || "No phone supplied")}</div>
            </td>
            <td width="50%" style="padding:14px 16px;border-bottom:1px solid #e4dacb">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:#8a7140;font-weight:800">Fulfilment</div>
              <div style="font-size:16px;font-weight:800;margin-top:4px">${method}</div>
              <div style="font-size:12px;line-height:1.45;color:#655f56;margin-top:4px">${escapeEmailHtml(addressText)}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:14px 16px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                <td style="font-size:12px;color:#655f56">Requested items subtotal</td>
                <td align="right" style="font-size:24px;font-weight:800">${emailMoney(context.request.itemsSubtotalMinor)}</td>
              </tr></table>
            </td>
          </tr>
        </table>
        ${renderItemsTable(context.request.items)}
        ${note ? `<div style="border-left:4px solid #b98d47;background:#f7f2e8;border-radius:0 12px 12px 0;padding:13px 15px;margin:16px 0"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:#8a7140;font-weight:800;margin-bottom:5px">Customer note</div><div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeEmailHtml(note)}</div></div>` : ""}
        <div style="border:1px solid #d9e1d8;border-radius:13px;background:#f1f7f2;padding:13px 15px;margin:18px 0 0">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:#52705e;font-weight:800">Next action</div>
          <div style="font-size:14px;line-height:1.55;margin-top:5px">Open this order in Admin, confirm availability, then prepare the reviewed quote for the customer.</div>
        </div>
      `,
      cta: { label: "Open order in Admin", url: orderUrl },
      secondaryCta: {
        label: "Reply to customer",
        url: `mailto:${context.request.customerEmail}`,
      },
    });

    return this.email.send({
      from: { email: this.fromEmail, name: "The Black Sheep Shop" },
      to: { email: this.ownerEmail, name: "The Black Sheep Shop Owner" },
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
