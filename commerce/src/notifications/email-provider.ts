import type { SendEmailBindingLike } from "./order-notifier";
import { ResendEmailSender } from "./resend-email";

export interface EmailProviderEnv {
  EMAIL?: SendEmailBindingLike;
  RESEND_API_KEY?: string;
}

export interface ResolvedEmailSender {
  sender: SendEmailBindingLike;
  provider: "cloudflare-email" | "resend";
}

export function resolveEmailSender(
  env: EmailProviderEnv,
): ResolvedEmailSender | null {
  if (env.EMAIL) {
    return { sender: env.EMAIL, provider: "cloudflare-email" };
  }

  if (env.RESEND_API_KEY) {
    return {
      sender: new ResendEmailSender(env.RESEND_API_KEY),
      provider: "resend",
    };
  }

  return null;
}
