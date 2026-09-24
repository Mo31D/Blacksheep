import type { D1DatabaseLike } from "../data/d1";
import { recordOrderEvent } from "../data/order-events";
import type {
  CreatedOrder,
  SubmittedOrderInput,
} from "../domain/order";
import { CloudflareEmailOrderNotifier } from "./cloudflare-email";
import type { SendEmailBindingLike } from "./order-notifier";

export interface NotificationEnv {
  DB?: D1DatabaseLike;
  EMAIL?: SendEmailBindingLike;
  ORDER_EMAIL_FROM?: string;
  ORDER_OWNER_EMAIL?: string;
}

async function attemptNotification(
  db: D1DatabaseLike,
  orderId: string,
  eventPrefix: string,
  send: () => Promise<void>,
): Promise<void> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await send();
      await recordOrderEvent(db, {
        orderId,
        eventType: `${eventPrefix}_SENT`,
        metadata: { provider: "cloudflare-email", attempts: attempt },
      });
      return;
    } catch {
      if (attempt === maxAttempts) {
        await recordOrderEvent(db, {
          orderId,
          eventType: `${eventPrefix}_FAILED`,
          metadata: {
            provider: "cloudflare-email",
            attempts: attempt,
            error: "send_failed",
          },
        });
      }
    }
  }
}

export async function notifyOrderSubmitted(
  env: NotificationEnv,
  request: SubmittedOrderInput,
  order: CreatedOrder,
): Promise<void> {
  if (
    !env.DB ||
    !env.EMAIL ||
    !env.ORDER_EMAIL_FROM ||
    !env.ORDER_OWNER_EMAIL
  ) {
    return;
  }

  const notifier = new CloudflareEmailOrderNotifier(
    env.EMAIL,
    env.ORDER_EMAIL_FROM,
    env.ORDER_OWNER_EMAIL,
  );
  const context = { request, order };

  await Promise.all([
    attemptNotification(env.DB, order.id, "OWNER_NOTIFICATION", () =>
      notifier.notifyOwner(context),
    ),
    attemptNotification(env.DB, order.id, "CUSTOMER_ACKNOWLEDGEMENT", () =>
      notifier.acknowledgeCustomer(context),
    ),
  ]);
}
