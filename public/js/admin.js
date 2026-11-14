const adminGet = id => document.getElementById(id);

async function adminApi(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'حدث خطأ');
  }

  return data;
}

function adminEscape(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[c]);
}

async function checkAdminLogin() {
  try {
    const result = await adminApi('/api/admin/check');
    if (result.authenticated) showAdminDashboard();
  } catch(e) {}
}

function showAdminDashboard() {
  adminGet('loginPanel').classList.add('hidden');
  adminGet('dashboard').classList.remove('hidden');
  loadAdminProducts();
  loadDeliveryAreas();
}

console.log('ADMIN JS LOADED');
adminGet('loginForm').addEventListener('submit', async e => {
  console.log('ADMIN LOGIN CLICKED');
  e.preventDefault();
  const data = new FormData(e.target);

  try {
    await adminApi('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: data.get('username'),
        password: data.get('password')
      })
    });

    adminGet('loginMessage').textContent = '';
    showAdminDashboard();
  } catch(error) {
    adminGet('loginMessage').textContent = error.message;
  }
});

adminGet('productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.price = Number(data.price);

  try {
    await adminApi('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    e.target.reset();
    adminGet('productMessage').textContent = 'تمت إضافة المنتج بنجاح';
    loadAdminProducts();

    if (typeof loadProducts === 'function') loadProducts();
  } catch(error) {
    adminGet('productMessage').textContent = error.message;
  }
});

async function loadAdminProducts() {
  try {
    const products = await adminApi('/api/admin/products');

    const names = {
      drinks: 'المشروبات',
      food: 'المأكولات',
      grills: 'المشاوي',
      burgers: 'البرغر'
    };

    adminGet('productsList').innerHTML = products.length
      ? products.map(p => `
        <div class="admin-product">
          <div>
            <strong>${adminEscape(p.name)}</strong>
            <p>${names[p.category] || ''} · ${Number(p.price).toLocaleString('en-US')} ل.س</p>
            <small>${p.available ? 'متوفر' : 'غير متوفر'}</small>
          </div>
          <div class="admin-actions">
            <button class="edit" onclick="editAdminProduct(${p.id})">تعديل</button>
            <button class="toggle" onclick="toggleAdminProduct(${p.id},${!p.available})">
              ${p.available ? 'إيقاف' : 'تفعيل'}
            </button>
            <button class="delete" onclick="deleteAdminProduct(${p.id})">حذف</button>
          </div>
        </div>
      `).join('')
      : 'لا توجد منتجات';
  } catch(error) {
    adminGet('productsList').textContent = error.message;
  }
}

// إضافة منتج
async function editAdminProduct(id) {
  const products = await adminApi('/api/admin/products');
  const p = products.find(x => x.id === id);
  if (!p) return;

  const name = prompt('اسم المنتج:', p.name);
  if (name === null) return;

  const price = prompt('السعر:', p.price);
  if (price === null) return;

  const description = prompt('الوصف:', p.description);
  if (description === null) return;

  const image = prompt('رابط الصورة:', p.image);
  if (image === null) return;

  await adminApi('/api/admin/products/' + id, {
    method: 'PUT',
    body: JSON.stringify({
      name,
      price: Number(price),
      description,
      image
    })
  });

  loadAdminProducts();
  if (typeof loadProducts === 'function') loadProducts();
}

async function toggleAdminProduct(id, available) {
  await adminApi('/api/admin/products/' + id, {
    method: 'PUT',
    body: JSON.stringify({ available })
  });

  loadAdminProducts();
  if (typeof loadProducts === 'function') loadProducts();
}

async function deleteAdminProduct(id) {
  if (!confirm('هل تريد حذف هذا المنتج؟')) return;

  await adminApi('/api/admin/products/' + id, {
    method: 'DELETE'
  });

  loadAdminProducts();
  if (typeof loadProducts === 'function') loadProducts();
}

// مناطق التوصيل
async function loadDeliveryAreas() {
  const list = adminGet('deliveryAreasList');
  if (!list) return;

  try {
    const areas = await adminApi('/api/admin/delivery-areas');

    list.innerHTML = areas.length
      ? areas.map(area => `
        <div class="admin-product">
          <div>
            <strong>${adminEscape(area.name)}</strong>
            <p>${Number(area.price).toLocaleString('en-US')} ل.س</p>
            <small>${area.active ? 'مفعلة' : 'متوقفة'}</small>
          </div>
          <div class="admin-actions">
            <button class="edit" onclick="editDeliveryArea(${area.id})">تعديل</button>
            <button class="toggle" onclick="toggleDeliveryArea(${area.id},${!area.active})">
              ${area.active ? 'إيقاف' : 'تفعيل'}
            </button>
            <button class="delete" onclick="deleteDeliveryArea(${area.id})">حذف</button>
          </div>
        </div>
      `).join('')
      : '<p>لم تتم إضافة أي منطقة بعد</p>';
  } catch(error) {
    list.textContent = error.message;
  }
}

adminGet('deliveryAreaForm')?.addEventListener('submit', async e => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(e.target));
  data.price = Number(data.price);

  try {
    await adminApi('/api/admin/delivery-areas', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    e.target.reset();
    adminGet('deliveryAreaMessage').textContent = 'تمت إضافة المنطقة بنجاح';
    loadDeliveryAreas();
  } catch(error) {
    adminGet('deliveryAreaMessage').textContent = error.message;
  }
});

async function editDeliveryArea(id) {
  const areas = await adminApi('/api/admin/delivery-areas');
  const area = areas.find(a => a.id === id);
  if (!area) return;

  const name = prompt('اسم المنطقة:', area.name);
  if (name === null) return;

  const price = prompt('سعر التوصيل بالليرة السورية:', area.price);
  if (price === null) return;

  const amount = Number(price);

  if (!Number.isFinite(amount) || amount < 0) {
    alert('أدخل سعراً صحيحاً');
    return;
  }

  try {
    await adminApi('/api/admin/delivery-areas/' + id, {
      method: 'PUT',
      body: JSON.stringify({ name, price: amount })
    });

    loadDeliveryAreas();
  } catch(error) {
    alert(error.message);
  }
}

async function toggleDeliveryArea(id, active) {
  try {
    await adminApi('/api/admin/delivery-areas/' + id, {
      method: 'PUT',
      body: JSON.stringify({ active })
    });

    loadDeliveryAreas();
  } catch(error) {
    alert(error.message);
  }
}

async function deleteDeliveryArea(id) {
  if (!confirm('هل تريد حذف منطقة التوصيل؟')) return;

  try {
    await adminApi('/api/admin/delivery-areas/' + id, {
      method: 'DELETE'
    });

    loadDeliveryAreas();
  } catch(error) {
    alert(error.message);
  }
}

async function logout() {
  await adminApi('/api/admin/logout', { method: 'POST' });

  adminGet('dashboard').classList.add('hidden');
  adminGet('loginPanel').classList.remove('hidden');
  adminGet('loginForm').reset();
}

checkAdminLogin();
