import type { SendEmailBindingLike } from "./order-notifier";

type Mailbox = string | { email: string; name?: string };

export class ResendSendError extends Error {
  readonly name = "ResendSendError";

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
  private readonly apiKey: string;

  constructor(
    apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey.trim();
  }

  async send(message: {
    from: Mailbox;
    to: Mailbox;
    replyTo?: Mailbox;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown> {
    if (!/^re_[A-Za-z0-9_-]+$/.test(this.apiKey)) {
      throw new ResendSendError(0, "invalid_api_key_format");
    }

    let response: Response;
    try {
      response = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
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
    } catch {
      throw new ResendSendError(0, "transport_error");
    }

    if (!response.ok) {
      let providerCode = `http_${response.status}`;
      try {
        const body = (await response.clone().json()) as {
          name?: unknown;
          error?: { name?: unknown };
        };
        const candidate =
          typeof body.name === "string"
            ? body.name
            : typeof body.error?.name === "string"
              ? body.error.name
              : null;
        if (candidate && /^[a-z0-9_:-]{1,64}$/i.test(candidate)) {
          providerCode = candidate;
        }
      } catch {
        // Do not persist provider response text or request data.
      }
      throw new ResendSendError(response.status, providerCode);
    }

    return response.json();
  }
}
