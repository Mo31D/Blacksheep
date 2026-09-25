function decodeSecret(secret: string): Uint8Array {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  if (!raw) throw new Error("webhook_secret_invalid");

  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("webhook_secret_invalid");
  }

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBase64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export interface ResendWebhookHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export async function verifyResendWebhookSignature(
  payload: string,
  headers: ResendWebhookHeaders,
  webhookSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<void> {
  const id = headers.id?.trim() ?? "";
  const timestampRaw = headers.timestamp?.trim() ?? "";
  const signatureHeader = headers.signature?.trim() ?? "";

  if (!id || !timestampRaw || !signatureHeader) {
    throw new Error("webhook_signature_missing");
  }

  const timestamp = Number(timestampRaw);
  if (!Number.isInteger(timestamp)) {
    throw new Error("webhook_timestamp_invalid");
  }

  if (Math.abs(nowSeconds - timestamp) > 300) {
    throw new Error("webhook_timestamp_outside_tolerance");
  }

  const secretBytes = decodeSecret(webhookSecret);
  const secretBuffer = secretBytes.buffer.slice(
    secretBytes.byteOffset,
    secretBytes.byteOffset + secretBytes.byteLength,
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    secretBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signedContent = id + "." + timestampRaw + "." + payload;
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent),
  );
  const expected = toBase64(digest);

  const candidates = signatureHeader
    .split(/s+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const separator = value.indexOf(",");
      return separator >= 0 ? value.slice(separator + 1) : value;
    });

  if (!candidates.some((candidate) => constantTimeEqual(candidate, expected))) {
    throw new Error("webhook_signature_invalid");
  }
}
