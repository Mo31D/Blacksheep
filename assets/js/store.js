(function () {
  const STORE_KEY = 'blackSheepShopProducts';
  const DEFAULT_PATH = 'products.json';

  async function loadDefaultProducts() {
    const response = await fetch(DEFAULT_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load products.json');
    return response.json();
  }

  function getLocalProducts() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveLocalProducts(products) {
    localStorage.setItem(STORE_KEY, JSON.stringify(products));
  }

  function clearLocalProducts() {
    localStorage.removeItem(STORE_KEY);
  }

  async function getProducts() {
    const local = getLocalProducts();
    if (Array.isArray(local) && local.length) return local;
    const defaults = await loadDefaultProducts();
    return defaults;
  }

  function activeProducts(products) {
    return products.filter((item) => item.active !== false);
  }

  function categories(products) {
    return [...new Set(activeProducts(products).map((p) => p.category).filter(Boolean))].sort();
  }

  function money(value) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0));
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  window.BlackSheepStore = {
    STORE_KEY,
    getProducts,
    saveLocalProducts,
    clearLocalProducts,
    activeProducts,
    categories,
    money,
    slugify
  };
})();
