import { jsonNoIndex as json } from "./json-response";
export { json };

export function error(code: string, status: number, message = code): Response {
  return json({ error: { code, message } }, status);
}
export async function readProductJson(request: Request): Promise<Record<string, unknown>> {
  const raw = await readJson(request);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("product_invalid_request");
  }
  return raw as Record<string, unknown>;
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new Error("admin_json_required");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 16 * 1024) {
    throw new Error("admin_payload_too_large");
  }
  return JSON.parse(text);
}

