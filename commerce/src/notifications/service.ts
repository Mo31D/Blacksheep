import type { D1DatabaseLike } from "../data/d1";
import { recordOrderEvent } from "../data/order-events";
import {
  providerMessageIdFromResult,
  recordOutboundEmailAudit,
} from "../data/email-messages";
import type {
  CreatedOrder,
  SubmittedOrderInput,
} from "../domain/order";
import { CloudflareEmailOrderNotifier } from "./cloudflare-email";
import { resolveEmailSender, type EmailProviderEnv } from "./email-provider";
import { ResendSendError } from "./resend-email";

export interface NotificationEnv extends EmailProviderEnv {
  DB?: D1DatabaseLike;
  ORDER_EMAIL_FROM?: string;
  ORDER_OWNER_EMAIL?: string;
  ADMIN_BASE_URL?: string;
}

async function attemptNotification(
  db: D1DatabaseLike,
  orderId: string,
  eventPrefix: string,
  provider: string,
  send: () => Promise<unknown>,
  audit?: { subject: string; body: string },
): Promise<void> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result: unknown;
    try {
      result = await send();
    } catch (cause) {
      if (attempt === maxAttempts) {
        try {
          await recordOrderEvent(db, {
            orderId,
            eventType: `${eventPrefix}_FAILED`,
            metadata: {
              provider,
              attempts: attempt,
              error: "send_failed",
              ...(cause instanceof ResendSendError
                ? {
                    providerStatus: cause.status,
                    providerCode: cause.providerCode,
                  }
                : {}),
            },
          });
          if (audit) {
            await recordOutboundEmailAudit(db, {
              orderId,
              subject: audit.subject,
              body: audit.body,
              provider,
              deliveryStatus: "FAILED",
            });
          }
        } catch {
          // Keep the provider failure independent from audit persistence.
        }
      }
      continue;
    }

    const providerMessageId = providerMessageIdFromResult(result);
    try {
      await recordOrderEvent(db, {
        orderId,
        eventType: `${eventPrefix}_SENT`,
        metadata: {
          provider,
          attempts: attempt,
          providerMessageId,
        },
      });
      if (audit) {
        await recordOutboundEmailAudit(db, {
          orderId,
          subject: audit.subject,
          body: audit.body,
          provider,
          providerMessageId,
          deliveryStatus: "SENT",
        });
      }
    } catch {
      // Never duplicate a successful email because audit storage failed.
    }
    return;
  }
}

export async function notifyOrderSubmitted(
  env: NotificationEnv,
  request: SubmittedOrderInput,
  order: CreatedOrder,
): Promise<void> {
  const resolved = resolveEmailSender(env);
  if (
    !env.DB ||
    !resolved ||
    !env.ORDER_EMAIL_FROM ||
    !env.ORDER_OWNER_EMAIL
  ) {
    return;
  }

  const notifier = new CloudflareEmailOrderNotifier(
    resolved.sender,
    env.ORDER_EMAIL_FROM,
    env.ORDER_OWNER_EMAIL,
    env.ADMIN_BASE_URL ?? "https://api.theblacksheepshop.co.uk/admin",
  );
  const context = { request, order };

  await Promise.all([
    attemptNotification(env.DB, order.id, "OWNER_NOTIFICATION", resolved.provider, () =>
      notifier.notifyOwner(context),
    ),
    attemptNotification(
      env.DB,
      order.id,
      "CUSTOMER_ACKNOWLEDGEMENT",
      resolved.provider,
      () => notifier.acknowledgeCustomer(context),
      {
        subject: `We received your order request ${order.publicReference}`,
        body:
          "We received your order request. No payment has been taken. The shop will confirm availability and any delivery cost before asking you to pay.",
      },
    ),
  ]);
}
