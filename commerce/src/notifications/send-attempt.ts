import type { SendEmailBindingLike } from "./order-notifier";
import { EmailRecipientPolicyError } from "./email-provider";
import { ResendSendError } from "./resend-email";

type EmailMessage = Parameters<SendEmailBindingLike["send"]>[0];

export class EmailSendFailure extends Error {
  constructor(
    public readonly attempts: number,
    public readonly cause: unknown,
  ) {
    super("email_send_failed");
  }
}

function retryable(error: unknown): boolean {
  if (error instanceof EmailRecipientPolicyError) return false;
  if (!(error instanceof ResendSendError)) return true;
  return (error.status === 0 && error.providerCode === "transport_error") ||
    error.status === 408 || error.status === 429 ||
    error.status >= 500 ||
    (error.status === 409 && error.providerCode === "concurrent_idempotent_requests");
}

// One logical send gets one key; a transport timeout may have succeeded remotely.
export async function sendEmailWithRetry(
  sender: SendEmailBindingLike,
  message: EmailMessage,
): Promise<{ result: unknown; attempts: number }> {
  return retryEmailOperation((idempotencyKey) =>
    sender.send({ ...message, idempotencyKey: message.idempotencyKey ?? idempotencyKey }));
}

export async function retryEmailOperation(
  send: (idempotencyKey: string) => Promise<unknown>,
): Promise<{ result: unknown; attempts: number }> {
  const idempotencyKey = crypto.randomUUID();
  for (let attempts = 1; attempts <= 2; attempts += 1) {
    try {
      return { result: await send(idempotencyKey), attempts };
    } catch (cause) {
      if (attempts === 2 || !retryable(cause)) throw new EmailSendFailure(attempts, cause);
    }
  }
  throw new Error("unreachable_email_retry_state");
}
