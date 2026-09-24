const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function createPublicOrderReference(
  now = new Date(),
  randomValues: (target: Uint8Array) => Uint8Array = (target) =>
    crypto.getRandomValues(target),
): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const bytes = randomValues(new Uint8Array(8));
  const suffix = Array.from(
    bytes,
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join("");
  return `BSR-${yy}${mm}${dd}-${suffix}`;
}
