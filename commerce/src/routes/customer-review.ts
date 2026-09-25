import type { D1DatabaseLike } from "../data/d1";
import {
  acceptCustomerReview,
  declineCustomerReview,
  getCustomerReview,
  recordCustomerQuestion,
} from "../data/customer-review";
import {
  notifyOwnerCustomerQuestion,
  type CustomerQuestionEnv,
} from "../notifications/customer-question";

export interface CustomerReviewEnv extends CustomerQuestionEnv {
  DB?: D1DatabaseLike;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
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

function money(minor: number | null): string {
  return minor === null ? "—" : "£" + (Number(minor) / 100).toFixed(2);
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    CONFIRMED: "Available",
    REDUCED: "Quantity changed",
    UNAVAILABLE: "Unavailable",
    SUBSTITUTE: "Substitute",
    ADDED: "Added",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

type ReviewSnapshot = NonNullable<Awaited<ReturnType<typeof getCustomerReview>>>;

function reviewHtml(review: ReviewSnapshot, token: string): string {
  const originalMap = new Map(
    review.originalItems.map((item) => [item.lineNumber, item]),
  );

  const lines = review.revisedItems
    .map((item) => {
      const original = originalMap.get(item.lineNumber);
      const changed =
        item.availabilityStatus !== "CONFIRMED" ||
        item.confirmedQuantity !== item.requestedQuantity ||
        (original && original.productName !== item.productName);

      const detail =
        item.availabilityStatus === "ADDED"
          ? "Added by the shop"
          : item.availabilityStatus === "SUBSTITUTE"
            ? "Substitute for " + (original?.productName ?? "requested item")
            : item.availabilityStatus === "UNAVAILABLE"
              ? "Requested " + item.requestedQuantity + " · not available"
              : item.availabilityStatus === "REDUCED"
                ? "Requested " +
                  item.requestedQuantity +
                  " · confirmed " +
                  item.confirmedQuantity
                : "Confirmed as requested";

      return [
        '<div class="item ',
        changed ? "changed" : "",
        '">',
        '<div class="item-main"><div><strong>',
        escapeHtml(item.productName),
        "</strong><small>",
        escapeHtml(detail),
        "</small></div><span>",
        escapeHtml(statusLabel(item.availabilityStatus)),
        "</span></div>",
        item.customerNote
          ? '<div class="note">' + escapeHtml(item.customerNote) + "</div>"
          : "",
        '<div class="item-price"><span>',
        String(item.confirmedQuantity),
        " × ",
        money(item.unitPriceMinor),
        "</span><strong>",
        money(item.lineTotalMinor),
        "</strong></div></div>",
      ].join("");
    })
    .join("");

  const fulfilment =
    review.fulfilmentMethod === "collection"
      ? "Collection in Ambleside"
      : "Delivery";
  const canPay =
    review.paymentAvailable &&
    (review.revisionState === "SENT" || review.revisionState === "ACCEPTED");
  const paid =
    review.paymentStatus === "PAID" || review.paymentStatus === "REFUNDED";

  const shopMessage = review.customerMessage
    ? [
        '<div class="shop-message"><div class="eyebrow">Message from the shop</div>',
        escapeHtml(review.customerMessage),
        "</div>",
      ].join("")
    : "";

  const timing = review.fulfilmentMessage
    ? [
        '<div class="row"><span>Timing</span><strong>',
        escapeHtml(review.fulfilmentMessage),
        "</strong></div>",
      ].join("")
    : "";

  const actionHtml = paid
    ? '<div class="paid">Payment has already been recorded for this order.</div>'
    : [
        '<div class="actions">',
        canPay
          ? '<button class="btn" id="acceptPay">Accept changes &amp; pay securely</button>'
          : '<button class="btn" disabled>Payment link not available</button>',
        '<button class="btn danger" id="decline">I cannot accept these changes</button>',
        '<div class="secure">The payment button opens the secure payment request supplied by the shop. The Black Sheep Shop does not store your card or online-banking details.</div>',
        "</div>",
      ].join("");

  const tokenJson = JSON.stringify(token).replace(/</g, "\\u003c");

  return [
    "<!doctype html><html lang=\"en\"><head>",
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#f4f0e7">',
    "<title>Review order · The Black Sheep Shop</title>",
    "<style>",
    ':root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171713;background:#f4f0e7}*{box-sizing:border-box}body{margin:0;background:#f4f0e7;color:#171713}.shell{width:min(720px,100%);margin:0 auto;padding:24px 14px 64px}.brand{display:flex;align-items:center;gap:10px;margin:4px 0 28px}.mark{width:38px;height:38px;border-radius:13px;background:#171713;color:#fff;display:grid;place-items:center;font-family:Georgia,serif;font-weight:700}.brand-copy{font-family:Georgia,serif;font-size:20px;line-height:.95}.card{background:#fffdf9;border:1px solid #ded6c8;border-radius:20px;box-shadow:0 14px 36px rgba(40,31,19,.06);overflow:hidden}.head{padding:24px 22px 18px;border-bottom:1px solid #eee8dc}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#756f64;font-weight:800}.head h1{font-family:Georgia,serif;font-size:36px;line-height:1.05;margin:7px 0}.muted{color:#756f64}.shop-message{margin:16px 20px 0;border-left:4px solid #b9822f;background:#f8f4eb;border-radius:0 12px 12px 0;padding:14px 16px;line-height:1.6}.items{padding:18px 20px}.items h2,.summary h2,.question h2{font-family:Georgia,serif;font-size:22px;margin:0 0 12px}.item{border:1px solid #e8e0d4;border-radius:14px;padding:13px;margin-bottom:9px;background:#fff}.item.changed{border-color:#d8c4a3;background:#fffaf1}.item-main{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.item-main strong{font-size:15px}.item-main small{display:block;color:#756f64;margin-top:4px}.item-main>span{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;border-radius:999px;background:#eee8dc;padding:5px 7px;white-space:nowrap}.item-price{display:flex;justify-content:space-between;gap:12px;margin-top:10px;font-size:13px}.note{margin-top:9px;padding:8px 10px;border-radius:9px;background:#f4f0e7;font-size:13px;color:#655f56}.summary{padding:0 20px 18px}.summary-box{border:1px solid #ded6c8;border-radius:14px;padding:14px;background:#f8f4eb}.row{display:flex;justify-content:space-between;gap:12px;padding:6px 0}.row.total{font-size:20px;font-weight:800;border-top:1px solid #ded6c8;margin-top:7px;padding-top:12px}.actions{padding:0 20px 22px;display:grid;gap:9px}.btn{border:1px solid transparent;border-radius:12px;padding:13px 16px;font:inherit;font-weight:800;cursor:pointer;background:#171713;color:#fff;width:100%}.btn.secondary{background:#fff;color:#171713;border-color:#d8d0c4}.btn.danger{background:#fff6f4;color:#9c2f2f;border-color:#efc0bb}.btn:disabled{opacity:.5;cursor:not-allowed}.secure{font-size:12px;color:#756f64;line-height:1.5;text-align:center}.question{padding:20px;border-top:1px solid #eee8dc;background:#fff}.field{width:100%;border:1px solid #d8d0c4;border-radius:12px;padding:12px;font:inherit;min-height:100px;resize:vertical}.status{min-height:20px;margin-top:8px;font-size:13px}.success{color:#277a55}.error{color:#a02f2f}.legal{font-size:11px;color:#756f64;line-height:1.55;text-align:center;margin-top:18px}.legal a{color:#171713}.paid{padding:18px 20px;background:#eef7f1;border-top:1px solid #d7e9dc;color:#285f43;font-weight:700}@media(max-width:520px){.shell{padding:14px 10px 44px}.head{padding:20px 16px}.head h1{font-size:31px}.items,.summary,.actions,.question{padding-left:14px;padding-right:14px}.item-main{gap:8px}.item-main>span{font-size:9px}.actions{position:sticky;bottom:0;background:rgba(255,253,249,.96);padding-top:10px;padding-bottom:calc(12px + env(safe-area-inset-bottom));backdrop-filter:blur(14px);border-top:1px solid #eee8dc;z-index:5}}',
    "</style></head><body><main class=\"shell\">",
    '<div class="brand"><div class="mark">BS</div><div class="brand-copy">The Black<br>Sheep Shop</div></div>',
    '<section class="card"><div class="head"><div class="eyebrow">Secure order review</div><h1>Review your order</h1><div class="muted">Order ',
    escapeHtml(review.reference),
    " · reviewed version ",
    String(review.revisionNumber),
    "</div></div>",
    shopMessage,
    '<div class="items"><h2>Confirmed items</h2>',
    lines,
    "</div>",
    '<div class="summary"><h2>Order summary</h2><div class="summary-box">',
    '<div class="row"><span>Items</span><strong>',
    money(review.itemsSubtotalMinor),
    "</strong></div>",
    '<div class="row"><span>Delivery</span><strong>',
    money(review.deliveryAmountMinor),
    "</strong></div>",
    '<div class="row"><span>Fulfilment</span><strong>',
    escapeHtml(fulfilment),
    "</strong></div>",
    timing,
    '<div class="row total"><span>Final total</span><strong>',
    money(review.finalTotalMinor),
    "</strong></div></div></div>",
    actionHtml,
    '<div class="question"><h2>Need to ask something?</h2><div class="muted" style="margin-bottom:10px">Send a question about this reviewed order. It will be attached to the order for the shop to follow up.</div><textarea id="question" class="field" maxlength="2000" placeholder="Type your question…"></textarea><button class="btn secondary" id="sendQuestion" style="margin-top:9px">Send question to the shop</button><div id="questionStatus" class="status" aria-live="polite"></div></div>',
    "</section>",
    '<div class="legal">This private link is specific to the current reviewed version and expires automatically.<br><a href="https://theblacksheepshop.co.uk/delivery-returns.html">Delivery &amp; returns</a> · <a href="https://theblacksheepshop.co.uk/terms.html">Order terms</a> · <a href="https://theblacksheepshop.co.uk/privacy.html">Privacy</a></div>',
    "</main><script>",
    "const token=",
    tokenJson,
    ";",
    "async function post(path,body){const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data&&data.error&&(data.error.message||data.error.code)||'Request failed');return data}",
    "const accept=document.getElementById('acceptPay');if(accept)accept.onclick=async()=>{accept.disabled=true;accept.textContent='Opening secure payment…';try{const data=await post('/review/'+encodeURIComponent(token)+'/accept',{});location.href=data.paymentRequestUrl}catch(error){accept.disabled=false;accept.textContent='Accept changes & pay securely';alert(error.message)}};",
    "const decline=document.getElementById('decline');if(decline)decline.onclick=async()=>{if(!confirm('Tell the shop you cannot accept this reviewed order? No payment will be taken by this page.'))return;decline.disabled=true;try{await post('/review/'+encodeURIComponent(token)+'/decline',{});const actions=document.querySelector('.actions');if(actions)actions.innerHTML='<div class=\"paid\" style=\"border:0\">Thanks. The shop has been told that you cannot accept these changes and will review the order again.</div>'}catch(error){decline.disabled=false;alert(error.message)}};",
    "document.getElementById('sendQuestion').onclick=async()=>{const button=document.getElementById('sendQuestion'),status=document.getElementById('questionStatus'),field=document.getElementById('question'),message=field.value.trim();status.className='status';if(message.length<2){status.className='status error';status.textContent='Please enter your question.';return}button.disabled=true;status.textContent='Sending…';try{await post('/review/'+encodeURIComponent(token)+'/question',{message});field.value='';status.className='status success';status.textContent='Question sent to the shop.'}catch(error){status.className='status error';status.textContent=error.message}finally{button.disabled=false}};",
    "</script></body></html>",
  ].join("");
}

function expiredHtml(): string {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Order review unavailable</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f0e7;color:#171713;margin:0;padding:30px}.card{max-width:560px;margin:60px auto;background:#fffdf9;border:1px solid #ded6c8;border-radius:18px;padding:26px}h1{font-family:Georgia,serif}a{color:#171713}</style></head><body><main class="card"><h1>This review link is no longer available</h1><p>The link may have expired or a newer reviewed version may have replaced it.</p><p>Please reply to the shop email or contact <a href="mailto:orders@theblacksheepshop.co.uk">orders@theblacksheepshop.co.uk</a>.</p></main></body></html>';
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new Error("json_required");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 8 * 1024) {
    throw new Error("payload_too_large");
  }
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_request");
  }
  return parsed as Record<string, unknown>;
}

export async function handleCustomerReviewRequest(
  request: Request,
  env: CustomerReviewEnv,
): Promise<Response> {
  if (!env.DB) {
    return json(
      {
        error: {
          code: "database_unavailable",
          message: "Order review is temporarily unavailable.",
        },
      },
      503,
    );
  }

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/review\/([A-Za-z0-9_-]{32,128})(?:\/(accept|decline|question))?$/,
  );
  if (!match) {
    return json({ error: { code: "not_found", message: "Not found." } }, 404);
  }

  const token = match[1];
  const action = match[2] ?? null;

  if (!action && request.method === "GET") {
    const review = await getCustomerReview(env.DB, token);
    if (!review) {
      return new Response(expiredHtml(), {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow",
          "referrer-policy": "no-referrer",
        },
      });
    }

    return new Response(reviewHtml(review, token), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "content-security-policy":
          "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        "referrer-policy": "no-referrer",
      },
    });
  }

  if (request.method !== "POST" || !action) {
    return json(
      {
        error: {
          code: "method_not_allowed",
          message: "Method not allowed.",
        },
      },
      405,
    );
  }

  try {
    if (action === "accept") {
      const accepted = await acceptCustomerReview(env.DB, token);
      if (!accepted.paymentRequestUrl.startsWith("https://")) {
        throw new Error("review_payment_not_available");
      }
      return json(accepted);
    }

    if (action === "decline") {
      return json(await declineCustomerReview(env.DB, token));
    }

    const body = await readJson(request);
    const question = await recordCustomerQuestion(
      env.DB,
      token,
      String(body.message ?? ""),
    );
    await notifyOwnerCustomerQuestion(env, question);
    return json({ ok: true, reference: question.reference }, 201);
  } catch (cause) {
    const code =
      cause instanceof Error ? cause.message : "review_action_failed";
    const status =
      code === "review_not_available" || code === "review_token_invalid"
        ? 404
        : code === "payload_too_large"
          ? 413
          : code === "review_already_paid" ||
              code === "review_payment_not_available"
            ? 409
            : 400;

    const message =
      status === 404
        ? "This review link is no longer available."
        : code === "review_already_paid"
          ? "Payment has already been recorded for this order."
          : code === "review_payment_not_available"
            ? "The secure payment request is not currently available."
            : code === "review_question_invalid"
              ? "Please enter a question between 2 and 2000 characters."
              : "Unable to update this reviewed order.";

    return json({ error: { code, message } }, status);
  }
}
