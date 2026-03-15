(function () {
  const form = document.getElementById('product-form');
  if (!form) return;

  const els = {
    id: document.getElementById('product-id'),
    name: document.getElementById('product-name'),
    price: document.getElementById('product-price'),
    category: document.getElementById('product-category'),
    image: document.getElementById('product-image'),
    upload: document.getElementById('product-image-upload'),
    description: document.getElementById('product-description'),
    featured: document.getElementById('product-featured'),
    active: document.getElementById('product-active'),
    list: document.getElementById('admin-product-list'),
    resetForm: document.getElementById('reset-form'),
    exportJson: document.getElementById('export-json'),
    importJson: document.getElementById('import-json'),
    resetLocal: document.getElementById('reset-local'),
    search: document.getElementById('admin-search'),
    message: document.getElementById('admin-message')
  };

  let products = [];
  let uploadedImageData = '';

  function setMessage(text) {
    els.message.textContent = text;
    window.setTimeout(() => {
      if (els.message.textContent === text) els.message.textContent = '';
    }, 2500);
  }

  function resetForm() {
    form.reset();
    els.id.value = '';
    uploadedImageData = '';
    els.active.checked = true;
  }

  function sortProducts(items) {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderList() {
    const query = (els.search.value || '').toLowerCase().trim();
    const filtered = sortProducts(products).filter((item) => {
      const haystack = `${item.name} ${item.category} ${item.description}`.toLowerCase();
      return haystack.includes(query);
    });

    els.list.innerHTML = filtered.map((item) => `
      <article class="admin-item">
        <img src="${item.image || ''}" alt="${item.name}" />
        <div>
          <strong>${item.name}</strong>
          <p>${item.category || 'Uncategorized'} • ${window.BlackSheepStore.money(item.price)}</p>
          <small>${item.active === false ? 'Hidden' : 'Visible'}${item.featured ? ' • Featured' : ''}</small>
        </div>
        <div class="admin-item-actions">
          <button type="button" class="btn btn-secondary btn-small" data-edit="${item.id}">Edit</button>
          <button type="button" class="btn btn-danger btn-small" data-delete="${item.id}">Delete</button>
        </div>
      </article>`).join('');
  }

  function persist() {
    window.BlackSheepStore.saveLocalProducts(products);
    renderList();
  }

  function editItem(id) {
    const item = products.find((product) => product.id === id);
    if (!item) return;
    els.id.value = item.id;
    els.name.value = item.name || '';
    els.price.value = item.price || '';
    els.category.value = item.category || '';
    els.image.value = item.image || '';
    els.description.value = item.description || '';
    els.featured.checked = !!item.featured;
    els.active.checked = item.active !== false;
    uploadedImageData = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteItem(id) {
    products = products.filter((item) => item.id !== id);
    persist();
    setMessage('Product deleted');
  }

  function createId(name) {
    const base = window.BlackSheepStore.slugify(name) || 'product';
    let id = base;
    let i = 2;
    while (products.some((item) => item.id === id)) {
      id = `${base}-${i++}`;
    }
    return id;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const id = els.id.value || createId(els.name.value);
    const item = {
      id,
      name: els.name.value.trim(),
      price: Number(els.price.value || 0),
      category: els.category.value.trim(),
      image: uploadedImageData || els.image.value.trim(),
      description: els.description.value.trim(),
      featured: els.featured.checked,
      active: els.active.checked
    };

    const index = products.findIndex((product) => product.id === id);
    if (index >= 0) products[index] = item;
    else products.push(item);

    persist();
    resetForm();
    setMessage('Product saved locally');
  });

  els.upload.addEventListener('change', () => {
    const file = els.upload.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadedImageData = reader.result;
      setMessage('Image loaded as local preview');
    };
    reader.readAsDataURL(file);
  });

  els.list.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit]');
    const deleteButton = event.target.closest('[data-delete]');
    if (editButton) {
      editItem(editButton.dataset.edit);
      return;
    }
    if (deleteButton) deleteItem(deleteButton.dataset.delete);
  });

  els.resetForm.addEventListener('click', resetForm);
  els.search.addEventListener('input', renderList);

  els.exportJson.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(sortProducts(products), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.json';
    a.click();
    URL.revokeObjectURL(url);
    setMessage('JSON exported');
  });

  els.importJson.addEventListener('change', () => {
    const file = els.importJson.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('Invalid JSON format');
        products = data;
        persist();
        resetForm();
        setMessage('JSON imported');
      } catch {
        setMessage('Import failed');
      }
    };
    reader.readAsText(file);
  });

  els.resetLocal.addEventListener('click', async () => {
    window.BlackSheepStore.clearLocalProducts();
    products = await window.BlackSheepStore.getProducts();
    renderList();
    resetForm();
    setMessage('Local changes cleared');
  });

  (async function init() {
    try {
      products = await window.BlackSheepStore.getProducts();
      if (!Array.isArray(products)) products = [];
    } catch {
      products = [];
      setMessage('Could not load products');
    }
    renderList();
  })();
})();
