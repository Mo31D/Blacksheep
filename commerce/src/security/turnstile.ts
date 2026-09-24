export interface TurnstileSiteverifyResult {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

export interface VerifyTurnstileInput {
  secret: string;
  token: string;
  remoteIp?: string | null;
  idempotencyKey: string;
  expectedHostnames: readonly string[];
  expectedAction: string;
}

export interface VerifyTurnstileOptions {
  fetchImpl?: typeof fetch;
}

export async function verifyTurnstile(
  input: VerifyTurnstileInput,
  options: VerifyTurnstileOptions = {},
): Promise<TurnstileSiteverifyResult> {
  if (!input.secret) throw new Error("turnstile_secret_missing");
  if (!input.token || input.token.length > 2048) {
    return { success: false, "error-codes": ["invalid-input-response"] };
  }

  const form = new FormData();
  form.set("secret", input.secret);
  form.set("response", input.token);
  form.set("idempotency_key", input.idempotencyKey);
  if (input.remoteIp) form.set("remoteip", input.remoteIp);

  const response = await (options.fetchImpl ?? fetch)(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: form,
    },
  );

  if (!response.ok) throw new Error("turnstile_siteverify_unavailable");

  const result = (await response.json()) as TurnstileSiteverifyResult;
  if (!result.success) return result;

  if (
    input.expectedHostnames.length &&
    (!result.hostname || !input.expectedHostnames.includes(result.hostname))
  ) {
    return { ...result, success: false, "error-codes": ["hostname-mismatch"] };
  }

  if (input.expectedAction && result.action !== input.expectedAction) {
    return { ...result, success: false, "error-codes": ["action-mismatch"] };
  }

  return result;
}
