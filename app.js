const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'products.json');
const AREAS_FILE = path.join(DATA_DIR, 'delivery-areas.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]');
}

if (!fs.existsSync(AREAS_FILE)) {
  fs.writeFileSync(AREAS_FILE, '[]');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-before-publishing',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 8 * 60 * 60 * 1000
  }
}));

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readProducts() {
  return readJSON(DATA_FILE);
}

function readAreas() {
  return readJSON(AREAS_FILE);
}

const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
const adminHash = bcrypt.hashSync(adminPassword, 12);


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };
    const ext = extensions[file.mimetype];
    if (!ext) return cb(new Error('نوع الصورة غير مدعوم'));
    cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(allowed.includes(file.mimetype) ? null : new Error('اختر صورة JPG أو PNG أو WEBP أو GIF'), allowed.includes(file.mimetype));
  }
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'يجب تسجيل دخول المدير' });
}

const categories = ['drinks', 'food', 'grills', 'burgers'];

// رفع صور المنتجات من الهاتف
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, err => {
    if (err) {
      return res.status(400).json({
        error: err.code === 'LIMIT_FILE_SIZE'
          ? 'حجم الصورة يجب ألا يتجاوز 8 ميغابايت'
          : err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم اختيار صورة' });
    }

    res.json({ image: '/uploads/' + req.file.filename });
  });
});

// المنتجات
app.get('/api/products', (req, res) => {
  res.json(readProducts().filter(p => p.available));
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (
    username !== 'admin' ||
    typeof password !== 'string' ||
    !(await bcrypt.compare(password, adminHash))
  ) {
    return res.status(401).json({
      error: 'اسم المستخدم أو كلمة المرور غير صحيحة'
    });
  }

  req.session.isAdmin = true;
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ authenticated: !!req.session.isAdmin });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(readProducts());
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, category, description, price, image } = req.body;

  if (
    !name ||
    !categories.includes(category) ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    return res.status(400).json({
      error: 'تحقق من بيانات المنتج والسعر والتصنيف'
    });
  }

  const products = readProducts();

  const product = {
    id: Date.now(),
    name: String(name).trim(),
    category,
    description: String(description || '').trim(),
    price: Number(price),
    image: String(image || '').trim(),
    available: true
  };

  products.push(product);
  saveJSON(DATA_FILE, products);

  res.json(product);
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const products = readProducts();
  const product = products.find(p => p.id === Number(req.params.id));

  if (!product) {
    return res.status(404).json({ error: 'المنتج غير موجود' });
  }

  const { name, category, description, price, image, available } = req.body;

  if (name !== undefined) product.name = String(name).trim();

  if (category !== undefined && categories.includes(category)) {
    product.category = category;
  }

  if (description !== undefined) {
    product.description = String(description).trim();
  }

  if (
    price !== undefined &&
    Number.isFinite(Number(price)) &&
    Number(price) >= 0
  ) {
    product.price = Number(price);
  }

  if (image !== undefined) product.image = String(image).trim();
  if (available !== undefined) product.available = Boolean(available);

  saveJSON(DATA_FILE, products);
  res.json(product);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const products = readProducts();
  const updated = products.filter(p => p.id !== Number(req.params.id));

  if (updated.length === products.length) {
    return res.status(404).json({ error: 'المنتج غير موجود' });
  }

  saveJSON(DATA_FILE, updated);
  res.json({ success: true });
});

// مناطق التوصيل: متاحة للعميل للقراءة فقط
app.get('/api/delivery-areas', (req, res) => {
  res.json(readAreas().filter(area => area.active !== false));
});

// إدارة مناطق التوصيل للمدير
app.get('/api/admin/delivery-areas', requireAdmin, (req, res) => {
  res.json(readAreas());
});

app.post('/api/admin/delivery-areas', requireAdmin, (req, res) => {
  const name = String(req.body.name || '').trim();
  const price = Number(req.body.price);

  if (!name || name.length > 100 || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({
      error: 'أدخل اسم المنطقة وسعر توصيل صحيح'
    });
  }

  const areas = readAreas();

  if (areas.some(a => a.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'هذه المنطقة موجودة بالفعل' });
  }

  const area = {
    id: Date.now(),
    name,
    price,
    active: true
  };

  areas.push(area);
  saveJSON(AREAS_FILE, areas);

  res.json(area);
});

app.put('/api/admin/delivery-areas/:id', requireAdmin, (req, res) => {
  const areas = readAreas();
  const area = areas.find(a => a.id === Number(req.params.id));

  if (!area) {
    return res.status(404).json({ error: 'المنطقة غير موجودة' });
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();

    if (!name || name.length > 100) {
      return res.status(400).json({ error: 'اسم المنطقة غير صالح' });
    }

    if (areas.some(a =>
      a.id !== area.id &&
      a.name.toLowerCase() === name.toLowerCase()
    )) {
      return res.status(400).json({ error: 'اسم المنطقة مستخدم بالفعل' });
    }

    area.name = name;
  }

  if (req.body.price !== undefined) {
    const price = Number(req.body.price);

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'سعر التوصيل غير صالح' });
    }

    area.price = price;
  }

  if (req.body.active !== undefined) {
    area.active = Boolean(req.body.active);
  }

  saveJSON(AREAS_FILE, areas);
  res.json(area);
});

app.delete('/api/admin/delivery-areas/:id', requireAdmin, (req, res) => {
  const areas = readAreas();
  const updated = areas.filter(a => a.id !== Number(req.params.id));

  if (updated.length === areas.length) {
    return res.status(404).json({ error: 'المنطقة غير موجودة' });
  }

  saveJSON(AREAS_FILE, updated);
  res.json({ success: true });
});

app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log('Restaurant server running on port ' + PORT);

  if (adminPassword === 'Admin@12345') {
    console.log('تنبيه: غيّر كلمة مرور المدير قبل نشر الموقع على الإنترنت');
  }
});
