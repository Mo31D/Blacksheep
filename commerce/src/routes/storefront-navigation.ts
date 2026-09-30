import type { StorefrontNodeSnapshot } from "../data/storefront-structure";

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

function path(node: StorefrontNodeSnapshot): string {
  return node.legacyPath || "/collections/" + encodeURIComponent(node.slug);
}

export function renderStorefrontNavigation(
  nodes: StorefrontNodeSnapshot[],
  currentNodeId: string | null,
): { desktop: string; mobile: string; ctaPath: string } {
  const roots = nodes
    .filter((node) => !node.parentNodeId && node.showInNavigation)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let current = currentNodeId ? byId.get(currentNodeId) : undefined;
  const seen = new Set<string>();
  while (current?.parentNodeId && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentNodeId);
  }
  const rootLinks = roots.map((node) =>
      '<a' + (node.id === current?.id ? ' class="active"' : "") +
      ' href="' + esc(path(node)) + '">' + esc(node.name) + "</a>",
    ).join("");
  const mobile = [
    '<a href="/">Home</a>',
    rootLinks,
    '<a href="/all-products.html">Full range</a>',
    '<a href="/about.html">About</a>',
    '<a href="/visit.html">Visit</a>',
  ].join("");
  const gifts = roots.find((node) => node.stableKey === "gifts") ?? roots[0];
  return { desktop: rootLinks, mobile, ctaPath: gifts ? path(gifts) : "/all-products.html" };
}
