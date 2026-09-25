export interface EmailCta {
  label: string;
  url: string;
}

export interface TransactionalEmailInput {
  preheader: string;
  eyebrow?: string;
  title: string;
  greeting?: string;
  intro?: string;
  bodyHtml?: string;
  bodyText?: string;
  cta?: EmailCta;
  afterCtaHtml?: string;
  afterCtaText?: string;
  reference?: string;
}

export function escapeEmailHtml(value: string): string {
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

export function emailMoney(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function link(url: string, label: string): string {
  return `<a href="${escapeEmailHtml(url)}" style="color:#171713;text-decoration:underline">${escapeEmailHtml(label)}</a>`;
}

export function renderTransactionalEmail(
  input: TransactionalEmailInput,
): { html: string; text: string } {
  const text = [
    input.greeting,
    input.greeting ? "" : null,
    input.title,
    input.reference ? `Order ${input.reference}` : null,
    "",
    input.intro,
    input.intro ? "" : null,
    input.bodyText,
    input.bodyText ? "" : null,
    input.cta ? `${input.cta.label}: ${input.cta.url}` : null,
    input.cta ? "" : null,
    input.afterCtaText,
    input.afterCtaText ? "" : null,
    "The Black Sheep Shop",
    "2 Lancaster House, Lake Road, Ambleside, LA22 0AD",
    "07776 185647 · orders@theblacksheepshop.co.uk",
    "",
    "Delivery & returns: https://theblacksheepshop.co.uk/delivery-returns.html",
    "Order terms: https://theblacksheepshop.co.uk/terms.html",
    "Privacy: https://theblacksheepshop.co.uk/privacy.html",
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");

  const cta = input.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0"><tr><td style="border-radius:10px;background:#171713"><a href="${escapeEmailHtml(input.cta.url)}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px">${escapeEmailHtml(input.cta.label)}</a></td></tr></table>`
    : "";

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeEmailHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f0e7;color:#171713;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeEmailHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f0e7">
<tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fffdf9;border:1px solid #ded6c8;border-radius:18px;overflow:hidden">
<tr><td style="padding:24px 28px 18px;border-bottom:1px solid #eee8dc">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:700;line-height:1.05">The Black Sheep Shop</div>
  <div style="margin-top:5px;color:#756f64;font-size:13px">Ambleside · Lake District</div>
</td></tr>
<tr><td style="padding:28px">
  ${input.eyebrow ? `<div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#756f64;font-weight:700;margin-bottom:8px">${escapeEmailHtml(input.eyebrow)}</div>` : ""}
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.08;margin:0 0 18px">${escapeEmailHtml(input.title)}</h1>
  ${input.reference ? `<div style="display:inline-block;background:#eee8dc;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:700;margin:0 0 22px">Order ${escapeEmailHtml(input.reference)}</div>` : ""}
  ${input.greeting ? `<p style="font-size:16px;line-height:1.6;margin:0 0 16px">${escapeEmailHtml(input.greeting)}</p>` : ""}
  ${input.intro ? `<p style="font-size:16px;line-height:1.65;margin:0 0 18px">${escapeEmailHtml(input.intro)}</p>` : ""}
  ${input.bodyHtml ?? ""}
  ${cta}
  ${input.afterCtaHtml ?? ""}
</td></tr>
<tr><td style="padding:22px 28px;background:#f8f4eb;border-top:1px solid #eee8dc;color:#655f56;font-size:13px;line-height:1.6">
  <strong style="color:#171713">The Black Sheep Shop</strong><br>
  2 Lancaster House, Lake Road, Ambleside, LA22 0AD<br>
  07776 185647 · ${link("mailto:orders@theblacksheepshop.co.uk", "orders@theblacksheepshop.co.uk")}
  <div style="margin-top:13px">${link("https://theblacksheepshop.co.uk/delivery-returns.html", "Delivery & returns")} · ${link("https://theblacksheepshop.co.uk/terms.html", "Order terms")} · ${link("https://theblacksheepshop.co.uk/privacy.html", "Privacy")}</div>
  <div style="margin-top:12px;color:#8a8378">This is a transactional message about your order request. Reply to this email if you need help.</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { html, text };
}

export function renderItemsTable(
  items: readonly {
    productName: string;
    quantity: number;
    lineTotalMinor: number;
  }[],
): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:18px 0">${items
    .map(
      (item) =>
        `<tr><td style="padding:11px 0;border-bottom:1px solid #eee8dc;font-size:15px">${escapeEmailHtml(String(item.quantity))} × ${escapeEmailHtml(item.productName)}</td><td align="right" style="padding:11px 0;border-bottom:1px solid #eee8dc;font-size:15px;font-weight:700">${emailMoney(item.lineTotalMinor)}</td></tr>`,
    )
    .join("")}</table>`;
}

export function itemsText(
  items: readonly {
    productName: string;
    quantity: number;
    lineTotalMinor: number;
  }[],
): string {
  return items
    .map(
      (item) =>
        `${item.quantity} × ${item.productName} — ${emailMoney(item.lineTotalMinor)}`,
    )
    .join("\n");
}


export interface OwnerOperationalEmailInput {
  preheader: string;
  eyebrow: string;
  title: string;
  reference?: string;
  intro?: string;
  bodyHtml?: string;
  bodyText?: string;
  cta?: EmailCta;
  secondaryCta?: EmailCta;
  privacyNote?: string;
}

export function adminOrderUrl(adminBaseUrl: string, reference: string): string {
  const base = adminBaseUrl.trim().replace(/\/+$/, "");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}order=${encodeURIComponent(reference)}#orders`;
}

export function renderOwnerOperationalEmail(
  input: OwnerOperationalEmailInput,
): { html: string; text: string } {
  const privacyNote =
    input.privacyNote ??
    "Private owner notification. Customer information is shown only to help you fulfil this order.";

  const text = [
    "THE BLACK SHEEP SHOP · OWNER ADMIN",
    "",
    input.title,
    input.reference ? `Order ${input.reference}` : null,
    "",
    input.intro,
    input.intro ? "" : null,
    input.bodyText,
    input.bodyText ? "" : null,
    input.cta ? `${input.cta.label}: ${input.cta.url}` : null,
    input.secondaryCta
      ? `${input.secondaryCta.label}: ${input.secondaryCta.url}`
      : null,
    input.cta || input.secondaryCta ? "" : null,
    privacyNote,
    "",
    "The Black Sheep Shop · Ambleside",
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");

  const button = (cta: EmailCta, secondary = false) =>
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display:inline-table;margin:0 ${secondary ? "0" : "8px"} 8px 0"><tr><td style="border-radius:11px;background:${secondary ? "#fffdf9" : "#171713"};border:1px solid ${secondary ? "#cfc5b4" : "#171713"}"><a href="${escapeEmailHtml(cta.url)}" style="display:inline-block;padding:13px 18px;color:${secondary ? "#171713" : "#ffffff"};text-decoration:none;font-weight:800;font-size:14px">${escapeEmailHtml(cta.label)}</a></td></tr></table>`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeEmailHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#eee9df;color:#171713;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeEmailHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eee9df">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#fffdf9;border:1px solid #d8cfbf;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(40,31,19,.08)">
<tr><td style="padding:20px 24px;background:#171713;color:#fff">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    <td>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:700;line-height:1.05">The Black Sheep Shop</div>
      <div style="margin-top:5px;color:#c8b382;font-size:11px;text-transform:uppercase;letter-spacing:.16em;font-weight:800">Owner operations · Ambleside</div>
    </td>
    <td align="right" style="vertical-align:top"><span style="display:inline-block;border:1px solid #514b40;border-radius:999px;padding:6px 9px;color:#e5dccb;font-size:10px;font-weight:700">PRIVATE ADMIN</span></td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 26px">
  <div style="font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#8a7140;font-weight:800;margin-bottom:8px">${escapeEmailHtml(input.eyebrow)}</div>
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.08;margin:0 0 15px;color:#171713">${escapeEmailHtml(input.title)}</h1>
  ${input.reference ? `<div style="display:inline-block;background:#f1eadc;border:1px solid #e1d6c2;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:800;margin:0 0 19px">Order ${escapeEmailHtml(input.reference)}</div>` : ""}
  ${input.intro ? `<p style="font-size:15px;line-height:1.65;margin:0 0 18px;color:#4e493f">${escapeEmailHtml(input.intro)}</p>` : ""}
  ${input.bodyHtml ?? ""}
  ${input.cta || input.secondaryCta ? `<div style="margin-top:22px">${input.cta ? button(input.cta) : ""}${input.secondaryCta ? button(input.secondaryCta, true) : ""}</div>` : ""}
</td></tr>
<tr><td style="padding:18px 26px;background:#f7f2e8;border-top:1px solid #e8dfd0;color:#6f685d;font-size:12px;line-height:1.55">
  <strong style="color:#171713">Owner note</strong><br>
  ${escapeEmailHtml(privacyNote)}
  <div style="margin-top:9px;color:#8a8378">The Black Sheep Shop · 2 Lancaster House, Lake Road, Ambleside, LA22 0AD</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { html, text };
}
