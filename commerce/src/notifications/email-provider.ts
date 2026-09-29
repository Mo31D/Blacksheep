import type { SendEmailBindingLike } from "./order-notifier";
import { ResendEmailSender } from "./resend-email";

export interface EmailProviderEnv {
  EMAIL?: SendEmailBindingLike;
  RESEND_API_KEY?: string;
  ENVIRONMENT?: string;
  STAGING_EMAIL_ALLOWLIST?: string;
}

export interface ResolvedEmailSender {
  sender: SendEmailBindingLike;
  provider: "cloudflare-email" | "resend";
}

export class EmailRecipientPolicyError extends Error {
  readonly name = "EmailRecipientPolicyError";
  constructor() {
    super("staging_email_recipient_not_allowed");
  }
}

function recipientEmail(value: Parameters<SendEmailBindingLike["send"]>[0]["to"]): string {
  return (typeof value === "string" ? value : value.email).trim().toLowerCase();
}

function stagingSender(env: EmailProviderEnv, sender: SendEmailBindingLike): SendEmailBindingLike {
  if (env.ENVIRONMENT !== "staging" && env.ENVIRONMENT !== "preview") return sender;

  const entries = (env.STAGING_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const valid = entries.length > 0 && entries.every((value) =>
    /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(value));
  const allowlist = new Set(valid ? entries : []);

  return {
    async send(message) {
      if (!allowlist.has(recipientEmail(message.to))) {
        throw new EmailRecipientPolicyError();
      }
      return sender.send(message);
    },
  };
}

export function resolveEmailSender(
  env: EmailProviderEnv,
): ResolvedEmailSender | null {
  if (env.EMAIL) {
    return { sender: stagingSender(env, env.EMAIL), provider: "cloudflare-email" };
  }

  if (env.RESEND_API_KEY) {
    return {
      sender: stagingSender(env, new ResendEmailSender(env.RESEND_API_KEY)),
      provider: "resend",
    };
  }

  return null;
}
