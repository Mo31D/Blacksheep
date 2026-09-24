import type { SendEmailBindingLike } from "./order-notifier";

type Mailbox = string | { email: string; name?: string };

export class ResendSendError extends Error {
  constructor(
    public readonly status: number,
    public readonly providerCode: string,
  ) {
    super("resend_send_failed");
  }
}

function mailbox(value: Mailbox): string {
  if (typeof value === "string") return value;
  const name = value.name?.trim();
  return name ? `${name} <${value.email}>` : value.email;
}

export class ResendEmailSender implements SendEmailBindingLike {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: {
    from: Mailbox;
    to: Mailbox;
    replyTo?: Mailbox;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown> {
    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: mailbox(message.from),
        to: [mailbox(message.to)],
        reply_to: message.replyTo ? mailbox(message.replyTo) : undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      let providerCode = "unknown_error";
      try {
        const body = (await response.clone().json()) as { name?: unknown };
        if (
          typeof body.name === "string" &&
          /^[a-z0-9_:-]{1,64}$/i.test(body.name)
        ) {
          providerCode = body.name;
        }
      } catch {
        // Intentionally do not persist provider response text.
      }
      throw new ResendSendError(response.status, providerCode);
    }

    return response.json();
  }
}
