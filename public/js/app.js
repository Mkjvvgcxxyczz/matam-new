let allProducts = [];
let deliveryAreas = [];
let selectedProduct = null;

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterMenu(category, button) {
  document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
  button.classList.add('active');

  const products = category === 'all'
    ? allProducts
    : allProducts.filter(p => p.category === category);

  renderProducts(products);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;',
    '"':'&quot;', "'":'&#39;'
  })[char]);
}

function renderProducts(products) {
  const grid = document.getElementById('menuGrid');

  if (!products.length) {
    grid.innerHTML = '<p class="loading">لا توجد منتجات في هذا القسم حالياً</p>';
    return;
  }

  grid.innerHTML = products.map(item => `
    <article class="food-card">
      <img src="${escapeHTML(item.image || '')}" alt="${escapeHTML(item.name)}"
           onerror="this.style.display='none'">
      <div class="food-info">
        <h3>${escapeHTML(item.name)}</h3>
        <p>${escapeHTML(item.description || '')}</p>
        <div class="food-price">${Number(item.price).toLocaleString('en-US')} ل.س</div>
        <button class="main-btn order-btn"
          onclick="openOrder(${Number(item.id)})">
          اطلب الآن
        </button>
      </div>
    </article>
  `).join('');
}

async function loadProducts() {
  const grid = document.getElementById('menuGrid');

  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('تعذر تحميل المنتجات');

    allProducts = await response.json();
    renderProducts(allProducts);
  } catch (error) {
    grid.innerHTML = '<p class="loading">تعذر تحميل القائمة. أعد تحميل الصفحة.</p>';
  }
}

async function loadPublicDeliveryAreas() {
  try {
    const response = await fetch('/api/delivery-areas');
    if (!response.ok) throw new Error('تعذر تحميل مناطق التوصيل');

    deliveryAreas = await response.json();
  } catch (error) {
    deliveryAreas = [];
  }
}

function openOrder(id) {
  selectedProduct = allProducts.find(p => Number(p.id) === Number(id));
  if (!selectedProduct) return;

  const old = document.getElementById('orderModal');
  if (old) old.remove();

  const options = deliveryAreas.map(area => `
    <option value="${Number(area.id)}">
      ${escapeHTML(area.name)} - ${Number(area.price).toLocaleString('en-US')} ل.س
    </option>
  `).join('');

  const modal = document.createElement('div');
  modal.id = 'orderModal';
  modal.className = 'order-modal';

  modal.innerHTML = `
    <div class="order-box">
      <button class="order-close" onclick="closeOrder()">×</button>
      <h2>إتمام الطلب</h2>
      <p class="order-product">${escapeHTML(selectedProduct.name)}</p>
      <p>سعر القطعة: <strong>${Number(selectedProduct.price).toLocaleString('en-US')} ل.س</strong></p>

      <form id="customerOrderForm">
        <label>الكمية</label>
        <input name="quantity" type="number" min="1" max="50" value="1" required>

        <label>الاسم</label>
        <input name="customerName" placeholder="اسمك الكامل" required>

        <label>رقم الهاتف</label>
        <input name="phone" type="tel" placeholder="رقم الهاتف" required>

        <label>منطقة التوصيل</label>
        <select name="areaId" required>
          <option value="">اختر منطقتك</option>
          ${options}
        </select>

        <label>العنوان بالتفصيل</label>
        <textarea name="address" placeholder="الشارع والبناء وأقرب نقطة دالة" required></textarea>

        <button type="button" class="secondary-btn" onclick="getCustomerLocation()">
          📍 مشاركة موقعي اختيارياً
        </button>
        <p id="locationMessage"></p>

        <div class="order-total" id="orderTotal">الإجمالي: --</div>

        <button class="main-btn" type="submit">إرسال الطلب عبر واتساب</button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = document.getElementById('customerOrderForm');
  form.addEventListener('input', updateOrderTotal);
  form.addEventListener('change', updateOrderTotal);
  form.addEventListener('submit', sendWhatsAppOrder);
  updateOrderTotal();
}

function closeOrder() {
  document.getElementById('orderModal')?.remove();
  selectedProduct = null;
}

function selectedArea() {
  const id = Number(document.querySelector('[name="areaId"]')?.value);
  return deliveryAreas.find(a => Number(a.id) === id && a.active !== false);
}

function updateOrderTotal() {
  if (!selectedProduct) return;

  const form = document.getElementById('customerOrderForm');
  if (!form) return;

  const quantity = Math.max(1, Number(form.quantity.value) || 1);
  const area = selectedArea();
  const productsTotal = Number(selectedProduct.price) * quantity;
  const delivery = area ? Number(area.price) : 0;

  document.getElementById('orderTotal').textContent =
    `المنتجات: ${productsTotal.toLocaleString('en-US')} ل.س | ` +
    `التوصيل: ${area ? delivery.toLocaleString('en-US') + ' ل.س' : 'اختر المنطقة'} | ` +
    `الإجمالي: ${(productsTotal + delivery).toLocaleString('en-US')} ل.س`;
}

let customerCoordinates = null;

function getCustomerLocation() {
  const message = document.getElementById('locationMessage');

  if (!navigator.geolocation) {
    message.textContent = 'المتصفح لا يدعم تحديد الموقع';
    return;
  }

  message.textContent = 'بانتظار إذن مشاركة الموقع...';

  navigator.geolocation.getCurrentPosition(
    position => {
      customerCoordinates = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      message.textContent = 'تم تحديد موقعك بنجاح';
    },
    () => {
      message.textContent = 'تعذر تحديد الموقع. يمكنك كتابة العنوان يدوياً';
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

function sendWhatsAppOrder(event) {
  event.preventDefault();

  if (!selectedProduct) return;

  const form = event.currentTarget;
  const data = new FormData(form);
  const area = selectedArea();

  if (!area) {
    alert('يرجى اختيار منطقة التوصيل');
    return;
  }

  const quantity = Number(data.get('quantity'));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    alert('الرجاء اختيار كمية صحيحة');
    return;
  }

  const name = String(data.get('customerName')).trim();
  const phone = String(data.get('phone')).trim();
  const address = String(data.get('address')).trim();

  if (!name || !phone || !address) {
    alert('يرجى تعبئة جميع بيانات التوصيل');
    return;
  }

  const productsTotal = Number(selectedProduct.price) * quantity;
  const delivery = Number(area.price);
  const finalTotal = productsTotal + delivery;

  const locationLink = customerCoordinates
    ? `https://www.google.com/maps?q=${customerCoordinates.lat},${customerCoordinates.lng}`
    : 'لم تتم مشاركة الموقع';

  const message = [
    '🍽️ *طلب جديد - مطعم البيك*',
    '----------------------',
    `المنتج: ${selectedProduct.name}`,
    `سعر القطعة: ${Number(selectedProduct.price).toLocaleString('en-US')} ل.س`,
    `الكمية: ${quantity}`,
    `إجمالي المنتجات: ${productsTotal.toLocaleString('en-US')} ل.س`,
    `منطقة التوصيل: ${area.name}`,
    `تكلفة التوصيل: ${delivery.toLocaleString('en-US')} ل.س`,
    `الإجمالي النهائي: ${finalTotal.toLocaleString('en-US')} ل.س`,
    '----------------------',
    `اسم العميل: ${name}`,
    `رقم الهاتف: ${phone}`,
    `العنوان: ${address}`,
    `الموقع: ${locationLink}`
  ].join('\n');

  const url = 'https://wa.me/963980516021?text=' + encodeURIComponent(message);
  window.open(url, '_blank');
}

loadProducts();
loadPublicDeliveryAreas();
