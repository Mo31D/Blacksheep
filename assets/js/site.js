(function () {
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => nav.classList.toggle('open'));
  }

  function productCard(item) {
    return `
      <article class="product-card">
        <a href="product.html?id=${encodeURIComponent(item.id)}" class="product-image-wrap">
          <img src="${item.image || ''}" alt="${item.name}" class="product-image" loading="lazy" />
        </a>
        <div class="product-body">
          <p class="product-category">${item.category || 'Product'}</p>
          <h3><a href="product.html?id=${encodeURIComponent(item.id)}">${item.name}</a></h3>
          <p class="product-description">${item.description || ''}</p>
          <div class="product-meta">
            <strong>${window.BlackSheepStore.money(item.price)}</strong>
            <a href="product.html?id=${encodeURIComponent(item.id)}" class="text-link">View</a>
          </div>
        </div>
      </article>`;
  }

  async function renderFeatured() {
    const target = document.getElementById('featured-products');
    if (!target) return;
    const products = await window.BlackSheepStore.getProducts();
    const featured = window.BlackSheepStore.activeProducts(products).filter((p) => p.featured).slice(0, 4);
    target.innerHTML = featured.map(productCard).join('');
  }

  async function renderShop() {
    const grid = document.getElementById('shop-products');
    if (!grid) return;
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const emptyState = document.getElementById('empty-state');

    const products = await window.BlackSheepStore.getProducts();
    const active = window.BlackSheepStore.activeProducts(products);
    const cats = window.BlackSheepStore.categories(products);
    categoryFilter.innerHTML += cats.map((cat) => `<option value="${cat}">${cat}</option>`).join('');

    function update() {
      const query = (searchInput.value || '').toLowerCase().trim();
      const category = categoryFilter.value;
      const filtered = active.filter((item) => {
        const inCategory = category === 'all' || item.category === category;
        const haystack = `${item.name} ${item.description} ${item.category}`.toLowerCase();
        return inCategory && haystack.includes(query);
      });
      grid.innerHTML = filtered.map(productCard).join('');
      emptyState.classList.toggle('hidden', filtered.length > 0);
    }

    searchInput.addEventListener('input', update);
    categoryFilter.addEventListener('change', update);
    update();
  }

  async function renderProductDetail() {
    const target = document.getElementById('product-detail');
    if (!target) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const products = await window.BlackSheepStore.getProducts();
    const item = products.find((product) => product.id === id && product.active !== false);

    if (!item) {
      target.innerHTML = '<p class="empty-state">Product not found.</p>';
      return;
    }

    document.title = `${item.name} | The Black Sheep Shop`;
    target.innerHTML = `
      <div class="product-detail-grid">
        <div class="product-detail-image-wrap">
          <img src="${item.image || ''}" alt="${item.name}" class="product-detail-image" />
        </div>
        <div class="product-detail-copy">
          <p class="eyebrow">${item.category || 'Product'}</p>
          <h1>${item.name}</h1>
          <p class="price-large">${window.BlackSheepStore.money(item.price)}</p>
          <p>${item.description || ''}</p>
          <div class="detail-actions">
            <a class="btn btn-primary" href="contact.html">Enquire</a>
            <a class="btn btn-secondary" href="shop.html">Back to shop</a>
          </div>
        </div>
      </div>`;
  }

  renderFeatured();
  renderShop();
  renderProductDetail();
})();
