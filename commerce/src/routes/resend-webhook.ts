import type { D1DatabaseLike } from "../data/d1";
import { applyResendDeliveryEvent } from "../data/email-delivery";
import { verifyResendWebhookSignature } from "../security/resend-webhook";

export interface ResendWebhookEnv {
  DB?: D1DatabaseLike;
  RESEND_WEBHOOK_SECRET?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function handleResendWebhook(
  request: Request,
  env: ResendWebhookEnv,
): Promise<Response> {
  if (request.method !== "POST") {
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

  if (!env.DB || !env.RESEND_WEBHOOK_SECRET) {
    return json(
      {
        error: {
          code: "webhook_not_configured",
          message: "Webhook receiver is not configured.",
        },
      },
      503,
    );
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 256 * 1024) {
    return json(
      {
        error: {
          code: "payload_too_large",
          message: "Webhook payload is too large.",
        },
      },
      413,
    );
  }

  const webhookEventId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");

  try {
    await verifyResendWebhookSignature(
      raw,
      {
        id: webhookEventId,
        timestamp,
        signature,
      },
      env.RESEND_WEBHOOK_SECRET,
    );
  } catch {
    return json(
      {
        error: {
          code: "webhook_signature_invalid",
          message: "Invalid webhook signature.",
        },
      },
      401,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(
      {
        error: {
          code: "webhook_payload_invalid",
          message: "Invalid webhook payload.",
        },
      },
      400,
    );
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json(
      {
        error: {
          code: "webhook_payload_invalid",
          message: "Invalid webhook payload.",
        },
      },
      400,
    );
  }

  const body = payload as Record<string, unknown>;
  const type = typeof body.type === "string" ? body.type : "";
  const data =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : {};
  const providerMessageId =
    typeof data.email_id === "string" ? data.email_id : "";

  if (!webhookEventId || !type || !providerMessageId) {
    return json(
      {
        error: {
          code: "webhook_payload_invalid",
          message: "Webhook event is missing required fields.",
        },
      },
      400,
    );
  }

  const receivedAt = new Date().toISOString();
  const providerCreatedAt =
    typeof body.created_at === "string"
      ? body.created_at
      : typeof data.created_at === "string"
        ? data.created_at
        : null;

  const result = await applyResendDeliveryEvent(env.DB, {
    webhookEventId,
    eventType: type,
    providerMessageId,
    providerCreatedAt,
    receivedAt,
  });

  return json({ ok: true, ...result });
}
