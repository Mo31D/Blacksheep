/** Shared browser contract. Keep this script free of TypeScript syntax. */
export const publicationScript = String.raw`
var publicationChecks = new Map();
function clearPublicationVerification(domain) {
  var panel = document.getElementById(domain === 'structure' ? 'view-catalogue' : 'view-website');
  var banner = panel && panel.querySelector('[data-publication-status]');
  if (banner) { banner.publicationTicket = null; banner.remove(); }
}
function publicationTarget(domain, snapshot) {
  if (!snapshot || !snapshot.id || !snapshot.publishedVersionId || snapshot.draftVersionId) return null;
  var paths = { product: '/v1/catalog/' + encodeURIComponent(snapshot.id), structure: '/v1/storefront-structure', homepage: '/v1/homepage-merchandising', appearance: '/v1/appearance' };
  if (!paths[domain]) return null;
  return { domain: domain, id: snapshot.id, version: snapshot.publishedVersionId, path: paths[domain] };
}
function matchesPublication(target, data) {
  var value = target.domain === 'product' ? data.product : target.domain === 'structure' ? (data.nodes || []).find(function(n) { return n.id === target.id; }) : data.config;
  return !!value && (value.id === target.id || value.productId === target.id) && value.publishedVersionId === target.version && (!value.effectiveVersionId || value.effectiveVersionId === target.version);
}
async function verifyPublication(domain, snapshot, extraMatch) {
  var target = publicationTarget(domain, snapshot);
  if (!target) return { state: 'pending', ok: false, message: 'Draft changes are not live yet.' };
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var data = await api(target.path, { cache: 'no-store' });
      if (matchesPublication(target, data) && (!extraMatch || extraMatch(data))) return { state: 'live', ok: true, version: target.version, verifiedAt: new Date().toISOString(), message: isProductionAdminRuntime() ? 'Published and verified on the public feed.' : 'Published and verified in staging.' };
    } catch (error) { /* Failure is never live success. Keep the retry available. */ }
    if (attempt < 2) await new Promise(function(resolve) { setTimeout(resolve, 350); });
  }
  return { state: 'failed', ok: false, version: target.version, message: 'Published, but public verification has not matched this version. Retry verification.' };
}
async function showPublicationVerification(domain, snapshot) {
  var target = publicationTarget(domain, snapshot);
  if (!target) return;
  var key = domain + ':' + target.id, ticket = {};
  publicationChecks.set(key, ticket);
  var panel = document.getElementById(domain === 'structure' ? 'view-catalogue' : 'view-website');
  if (!panel) return;
  var banner = panel.querySelector('[data-publication-status]');
  if (!banner) { banner = document.createElement('div'); banner.className = 'publish-note'; banner.setAttribute('data-publication-status', ''); banner.setAttribute('role', 'status'); panel.prepend(banner); }
  banner.publicationTicket = ticket;
  banner.textContent = 'Published. Checking the public version…';
  var result = await verifyPublication(domain, snapshot);
  if (publicationChecks.get(key) !== ticket || banner.publicationTicket !== ticket) return;
  banner.textContent = result.message;
  if (!result.ok) {
    var retry = document.createElement('button'); retry.className = 'btn secondary'; retry.type = 'button'; retry.textContent = 'Retry verification';
    retry.onclick = function() { showPublicationVerification(domain, snapshot); };
    banner.appendChild(retry);
  }
  showToast(result.message, !result.ok);
}
`;
