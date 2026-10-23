import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { db, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS } from './server/db.ts';
import { validateGuestCheckout } from './src/utils/orderValidation.ts';
import { validateCoupon, calculateDiscount, calculateOrderPricing } from './src/utils/pricing.ts';
import { uploadToCloudinary, deleteFromCloudinary, CLOUDINARY_CONFIG, testCloudinaryConnection, generateUploadSignature } from './server/cloudinary.ts';
import {
  checkRtdbStatus,
  syncProductToRtdb,
  deleteProductFromRtdb,
  migrateStoreToRtdb,
  verifyFirebaseIdToken,
  FIREBASE_CONFIG
} from './server/firebase.ts';
import {
  getMongoDb,
  checkMongoStatus,
  getMongoProducts,
  getMongoProductById,
  saveMongoProduct,
  archiveMongoProduct,
  deleteMongoProduct,
  createMongoOrder,
  getMongoOrders,
  updateMongoOrderStatus,
  getMongoOrderByIdOrNumber,
  seedMongoProducts
} from './server/mongo.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// In-memory active admin sessions map (token -> username)
const activeSessions = new Map<string, { username: string; expiresAt: number }>();

async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication token required' });
  }
  const token = authHeader.split(' ')[1];

  // 1. Check verified backend sessions
  const session = activeSessions.get(token);
  if (session && session.expiresAt >= Date.now()) {
    (req as any).adminUser = session.username;
    return next();
  }

  // 2. Check Firebase ID Token verification
  try {
    const verified = await verifyFirebaseIdToken(token);
    if (verified.valid && verified.isAdmin) {
      (req as any).adminUser = verified.email || verified.uid;
      return next();
    }
  } catch (err) {
    console.warn('[Admin Auth Token Verification Error]', err);
  }

  return res.status(401).json({ error: 'Session expired or insufficient administrator privileges. Please sign in.' });
}

// ==========================================
// 0. HEALTH & READINESS ENDPOINTS
// ==========================================
app.get(['/health/live', '/health'], (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/health/ready', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database: true,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 1. PUBLIC STORE APIS (NO LOGIN REQUIRED)
// ==========================================

// Get active products with optional search, category, sort
app.get(['/api/products', '/api/v1/products'], async (req: Request, res: Response) => {
  try {
    const { category, search, sort, featured, trending, newArrival, page, limit } = req.query;
    const result = await getMongoProducts({
      category: typeof category === 'string' ? category : undefined,
      search: typeof search === 'string' ? search : undefined,
      sort: typeof sort === 'string' ? sort : undefined,
      isActive: true,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50
    });

    let products = result.products;
    if (featured === 'true') {
      products = products.filter(p => p.isFeatured);
    }
    if (trending === 'true') {
      products = products.filter(p => p.isTrending);
    }
    if (newArrival === 'true') {
      products = products.filter(p => p.isNewArrival);
    }

    if (products.length > 0) {
      return res.json({ products, total: result.total });
    }
  } catch (err: any) {
    console.warn('[MongoDB Product Query Warning, falling back to local]', err.message);
  }

  // Graceful local memory fallback if Mongo is initializing
  let products = db.getProducts().filter(p => p.isActive);
  const { category, search, sort, featured, trending, newArrival } = req.query;

  if (category && typeof category === 'string' && category !== 'all') {
    products = products.filter(p => p.categoryId === category);
  }
  if (featured === 'true') products = products.filter(p => p.isFeatured);
  if (trending === 'true') products = products.filter(p => p.isTrending);
  if (newArrival === 'true') products = products.filter(p => p.isNewArrival);
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q)
    );
  }

  res.json({ products, total: products.length });
});

// Single product
app.get(['/api/products/:id', '/api/v1/products/:id'], async (req: Request, res: Response) => {
  try {
    const product = await getMongoProductById(req.params.id);
    if (product && product.isActive) {
      return res.json({ product });
    }
  } catch (err: any) {
    console.warn('[MongoDB Product By ID Warning]', err.message);
  }

  const product = db.getProductById(req.params.id);
  if (!product || !product.isActive) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ product });
});

// Create product (Admin)
app.post(['/api/products', '/api/v1/products'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { name, price, categoryId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
    if (price === undefined || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ error: 'Valid regular price greater than 0 is required' });
    }
    if (!categoryId) return res.status(400).json({ error: 'Category selection is required' });

    const product = await saveMongoProduct(req.body);
    db.saveProduct(product);
    res.status(201).json({ product });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create product' });
  }
});

// Update product (Admin)
app.patch(['/api/products/:id', '/api/v1/products/:id'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const product = await saveMongoProduct({ ...req.body, id: req.params.id });
    db.saveProduct(product);
    res.json({ product });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update product' });
  }
});

// Delete product (Admin)
app.delete(['/api/products/:id', '/api/v1/products/:id'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true' || req.body?.force === true;
    let success = false;
    if (force) {
      success = await deleteMongoProduct(req.params.id);
    } else {
      success = await archiveMongoProduct(req.params.id);
    }
    db.deleteProduct(req.params.id, force);
    res.json({ success, message: force ? 'Product deleted permanently' : 'Product archived safely' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to delete product' });
  }
});

// Categories
app.get(['/api/categories', '/api/v1/categories'], (_req: Request, res: Response) => {
  const categories = db.getCategories().filter(c => c.isActive);
  res.json({ categories });
});

// Promotional Banners
app.get(['/api/banners', '/api/v1/banners'], (_req: Request, res: Response) => {
  const banners = db.getBanners().filter(b => b.isActive);
  res.json({ banners });
});

// Public store settings
app.get(['/api/settings', '/api/v1/settings'], (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({ settings });
});

// Validate Coupon
app.post(['/api/coupons/validate', '/api/v1/coupons/validate'], (req: Request, res: Response) => {
  const { code, subtotal } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Coupon code is required' });
  }
  const allCoupons = db.getCoupons();
  const coupon = allCoupons.find(c => c.code.toUpperCase() === String(code).trim().toUpperCase());

  const validation = validateCoupon(coupon, Number(subtotal) || 0);
  if (!validation.valid || !coupon) {
    return res.status(400).json({ valid: false, error: validation.error || 'Invalid coupon code' });
  }

  const discountAmount = calculateDiscount(coupon, Number(subtotal) || 0);
  res.json({
    valid: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      amountSaved: discountAmount
    }
  });
});

// Guest Checkout Order Placement (Server Authoritative with MongoDB Stock Deduction)
app.post(['/api/orders', '/api/v1/orders'], async (req: Request, res: Response) => {
  const { customer, items, couponCode } = req.body;

  // Validate form
  const validation = validateGuestCheckout(customer, items);
  if (!validation.isValid) {
    return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
  }

  // Look up coupon on server
  let coupon = null;
  if (couponCode) {
    coupon = db.getCoupons().find(c => c.code.toUpperCase() === String(couponCode).trim().toUpperCase());
  }

  // Calculate prices authoritatively on server
  const settings = db.getSettings();
  const pricing = calculateOrderPricing(items, coupon, {
    standardFee: settings.standardShippingFee,
    freeShippingThreshold: settings.freeShippingThreshold
  });

  const now = new Date().toISOString();
  const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const orderNumber = `ZZ-${Date.now().toString().slice(-6)}`;

  const newOrder: any = {
    id: orderId,
    orderNumber,
    customer,
    items: items.map((i: any) => ({
      productId: i.productId,
      name: i.name,
      price: i.salePrice && i.salePrice > 0 ? i.salePrice : i.price,
      quantity: i.quantity,
      image: i.image || i.imageUrl || (Array.isArray(i.images) ? i.images[0] : ''),
      sku: i.sku || ''
    })),
    subtotal: pricing.subtotal,
    discount: pricing.discountAmount,
    shippingFee: pricing.shippingFee,
    total: pricing.total,
    paymentMethod: 'COD',
    paymentStatus: 'pending',
    fulfillmentStatus: 'placed',
    statusHistory: [
      {
        status: 'placed',
        timestamp: now,
        note: 'Order placed by guest customer via cash on delivery'
      }
    ],
    couponCode: coupon?.code,
    createdAt: now,
    updatedAt: now
  };

  try {
    const mongoResult = await createMongoOrder(newOrder);
    if (!mongoResult.success) {
      return res.status(400).json({ error: mongoResult.error || 'Failed to place order in database' });
    }
    db.createGuestOrder(newOrder);
    return res.status(201).json({
      success: true,
      order: mongoResult.order
    });
  } catch (err: any) {
    console.error('[Create Order Error]', err);
    // Local fallback
    const localResult = db.createGuestOrder(newOrder);
    if (localResult.success) {
      return res.status(201).json({ success: true, order: localResult.order });
    }
    return res.status(500).json({ error: err.message || 'Could not place order' });
  }
});

// Guest Order Tracking (Requires orderNumber AND customer phone)
app.get(['/api/orders/track', '/api/v1/orders/track', '/api/v1/orders/track/:trackingToken'], async (req: Request, res: Response) => {
  const orderNumber = req.query.orderNumber || req.params.trackingToken;
  const phone = req.query.phone;
  if (!orderNumber || !phone) {
    return res.status(400).json({ error: 'Order number and phone number are required for tracking' });
  }

  const order = await getMongoOrderByIdOrNumber(String(orderNumber), String(phone)) || db.trackOrder(String(orderNumber), String(phone));
  if (!order) {
    return res.status(404).json({ error: 'No order found matching this order number and phone number' });
  }

  // Return public tracking view (protect other customer data)
  res.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.fullName,
      maskedPhone: order.customer.phone.replace(/(\d{4})\d+(\d{2})/, '$1****$2'),
      city: order.customer.city,
      address: order.customer.address,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingFee: order.shippingFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
      fulfillmentStatus: order.fulfillmentStatus,
      statusHistory: order.statusHistory,
      trackingNumber: order.trackingNumber,
      courierName: order.courierName,
      createdAt: order.createdAt
    }
  });
});

// Direct order tracking by ID or orderNumber via POST
app.post(['/api/orders/:id/track', '/api/v1/orders/:id/track'], async (req: Request, res: Response) => {
  const orderIdOrNumber = req.params.id;
  const phone = req.body.phone || req.body.phoneNumber;
  if (!orderIdOrNumber || !phone) {
    return res.status(400).json({ error: 'Order identifier and phone number are required' });
  }

  const order = await getMongoOrderByIdOrNumber(String(orderIdOrNumber), String(phone)) || db.trackOrder(String(orderIdOrNumber), String(phone));
  if (!order) {
    return res.status(404).json({ error: 'No order found matching this order number and customer phone' });
  }

  res.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.fullName,
      maskedPhone: order.customer.phone.replace(/(\d{4})\d+(\d{2})/, '$1****$2'),
      city: order.customer.city,
      address: order.customer.address,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingFee: order.shippingFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
      fulfillmentStatus: order.fulfillmentStatus,
      statusHistory: order.statusHistory,
      trackingNumber: order.trackingNumber,
      courierName: order.courierName,
      createdAt: order.createdAt
    }
  });
});

// ==========================================
// 2. ADMIN AUTHENTICATION & MANAGEMENT APIS
// ==========================================

// Admin Login
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const isValid = db.verifyAdmin(username, password);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid administrator credentials' });
  }

  const token = db.createSessionToken(username);
  // 7-day token expiry
  activeSessions.set(token, {
    username,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    token,
    user: {
      username,
      role: 'admin'
    }
  });
});

// Admin Logout
app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// Validate session
app.get('/api/admin/me', requireAdminAuth, (req: Request, res: Response) => {
  res.json({
    user: {
      username: (req as any).adminUser,
      role: 'admin'
    }
  });
});

// Admin Product Endpoints
// Admin Product Endpoints (Backed by MongoDB/FIRESTORE_URL)
app.get(['/api/admin/products', '/api/v1/admin/products'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await getMongoProducts({
      search: typeof search === 'string' ? search : undefined,
      isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 100
    });
    if (result.products.length > 0) {
      return res.json({ products: result.products, total: result.total });
    }
  } catch (err: any) {
    console.warn('[Admin Mongo Products Warning]', err.message);
  }
  const products = db.getProducts();
  res.json({ products, total: products.length });
});

// Import initial 16 products catalog into MongoDB
app.post(['/api/admin/products/import', '/api/v1/admin/products/import'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const dryRun = req.body?.dryRun === true;
    const result = await seedMongoProducts(undefined, dryRun);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Product catalog import failed' });
  }
});

// Cloudinary signature generation endpoint (Admin Only)
app.post(['/api/admin/uploads/signature', '/api/v1/admin/uploads/signature'], requireAdminAuth, (req: Request, res: Response) => {
  try {
    const sig = generateUploadSignature(req.body?.paramsToSign || {});
    res.json(sig);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Signature generation failed' });
  }
});

// Check whether product appears in orders before deleting
app.get('/api/admin/products/:id/orders-check', requireAdminAuth, (req: Request, res: Response) => {
  const check = db.isProductInOrders(req.params.id);
  const product = db.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({
    productId: product.id,
    productName: product.name,
    inOrders: check.inOrders,
    orderCount: check.orderCount,
    orderNumbers: check.orderNumbers
  });
});

app.post('/api/admin/products', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { name, price, categoryId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (price === undefined || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ error: 'Valid regular price greater than 0 is required' });
    }
    if (!categoryId) {
      return res.status(400).json({ error: 'Category selection is required' });
    }

    const product = await saveMongoProduct(req.body);
    db.saveProduct(product);
    res.status(201).json({ product });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create product' });
  }
});

app.put('/api/admin/products/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { name, price } = req.body;
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Product name cannot be empty' });
    }
    if (price !== undefined && (isNaN(Number(price)) || Number(price) <= 0)) {
      return res.status(400).json({ error: 'Valid regular price greater than 0 is required' });
    }

    const product = await saveMongoProduct({ ...req.body, id: req.params.id });
    db.saveProduct(product);
    res.json({ product });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update product' });
  }
});

// Safe archive/deactivate product
app.post('/api/admin/products/:id/archive', requireAdminAuth, async (req: Request, res: Response) => {
  const success = await archiveMongoProduct(req.params.id);
  const localResult = db.archiveProduct(req.params.id);
  if (!success && !localResult.success) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ success: true, product: localResult.product });
});

// Delete product with order check and optional force
app.delete('/api/admin/products/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const force = req.query.force === 'true' || req.body?.force === true;
  let success = false;
  if (force) {
    success = await deleteMongoProduct(req.params.id);
  } else {
    success = await archiveMongoProduct(req.params.id);
  }
  db.deleteProduct(req.params.id, force);

  res.json({ success, message: force ? 'Product permanently removed' : 'Product archived safely' });
});

// Bulk product actions
app.post('/api/admin/products/bulk', requireAdminAuth, (req: Request, res: Response) => {
  const { productIds, action, categoryId } = req.body;
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'productIds array is required' });
  }

  if (action === 'activate') {
    const resCount = db.bulkUpdateProducts(productIds, { isActive: true });
    return res.json({ success: true, updatedCount: resCount.updatedCount });
  }
  if (action === 'deactivate') {
    const resCount = db.bulkUpdateProducts(productIds, { isActive: false });
    return res.json({ success: true, updatedCount: resCount.updatedCount });
  }
  if (action === 'set_category') {
    if (!categoryId) return res.status(400).json({ error: 'categoryId is required for set_category' });
    const resCount = db.bulkUpdateProducts(productIds, { categoryId });
    return res.json({ success: true, updatedCount: resCount.updatedCount });
  }

  res.status(400).json({ error: 'Invalid bulk action. Supported: activate, deactivate, set_category' });
});

// Admin Category Endpoints
app.get('/api/admin/categories', requireAdminAuth, (_req: Request, res: Response) => {
  const categories = db.getCategories();
  res.json({ categories });
});

app.post('/api/admin/categories', requireAdminAuth, (req: Request, res: Response) => {
  const category = db.saveCategory(req.body);
  res.status(201).json({ category });
});

app.put('/api/admin/categories/:id', requireAdminAuth, (req: Request, res: Response) => {
  const category = db.saveCategory({ ...req.body, id: req.params.id });
  res.json({ category });
});

app.delete('/api/admin/categories/:id', requireAdminAuth, (req: Request, res: Response) => {
  const result = db.deleteCategory(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }
  res.json({ success: true });
});

// Admin Orders (Backed by MongoDB/FIRESTORE_URL)
app.get(['/api/admin/orders', '/api/v1/admin/orders'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { status, search, page, limit } = req.query;
    const result = await getMongoOrders({
      status: typeof status === 'string' ? status : undefined,
      search: typeof search === 'string' ? search : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined
    });
    if (result.orders.length > 0) {
      return res.json({ orders: result.orders, total: result.total });
    }
  } catch (err: any) {
    console.warn('[Admin Mongo Orders Warning]', err.message);
  }

  let orders = db.getOrders();
  const { status, search } = req.query;

  if (status && typeof status === 'string' && status !== 'all') {
    orders = orders.filter(o => o.fulfillmentStatus === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    orders = orders.filter(o => 
      o.orderNumber.toLowerCase().includes(q) ||
      o.customer.fullName.toLowerCase().includes(q) ||
      o.customer.phone.includes(q) ||
      o.customer.city.toLowerCase().includes(q)
    );
  }

  res.json({ orders, total: orders.length });
});

app.all(['/api/admin/orders/:id/status', '/api/v1/admin/orders/:id/status'], requireAdminAuth, async (req: Request, res: Response) => {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, trackingNumber, courierName, cancelReason, internalNotes, note } = req.body;
  try {
    const mongoOrder = await updateMongoOrderStatus(
      req.params.id,
      status,
      trackingNumber,
      courierName,
      note || cancelReason || internalNotes,
      (req as any).adminUser || 'Administrator'
    );
    if (mongoOrder) {
      db.updateOrderStatus(req.params.id, status, trackingNumber, courierName, cancelReason, internalNotes);
      return res.json({ success: true, order: mongoOrder });
    }
  } catch (err: any) {
    console.warn('[Mongo Update Order Status Warning]', err.message);
  }

  const result = db.updateOrderStatus(
    req.params.id,
    status,
    trackingNumber,
    courierName,
    cancelReason,
    internalNotes
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, order: result.order });
});

// Admin Coupons
app.get('/api/admin/coupons', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ coupons: db.getCoupons() });
});

app.post('/api/admin/coupons', requireAdminAuth, (req: Request, res: Response) => {
  const coupon = db.saveCoupon(req.body);
  res.status(201).json({ coupon });
});

app.put('/api/admin/coupons/:id', requireAdminAuth, (req: Request, res: Response) => {
  const coupon = db.saveCoupon({ ...req.body, id: req.params.id });
  res.json({ coupon });
});

app.delete('/api/admin/coupons/:id', requireAdminAuth, (req: Request, res: Response) => {
  const success = db.deleteCoupon(req.params.id);
  res.json({ success });
});

// Admin Banners
app.get('/api/admin/banners', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ banners: db.getBanners() });
});

app.post('/api/admin/banners', requireAdminAuth, (req: Request, res: Response) => {
  const banner = db.saveBanner(req.body);
  res.status(201).json({ banner });
});

app.put('/api/admin/banners/:id', requireAdminAuth, (req: Request, res: Response) => {
  const banner = db.saveBanner({ ...req.body, id: req.params.id });
  res.json({ banner });
});

app.delete('/api/admin/banners/:id', requireAdminAuth, (req: Request, res: Response) => {
  const success = db.deleteBanner(req.params.id);
  res.json({ success });
});

// Admin Settings
app.get('/api/admin/settings', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ settings: db.getSettings() });
});

app.put('/api/admin/settings', requireAdminAuth, (req: Request, res: Response) => {
  const settings = db.updateSettings(req.body);
  res.json({ settings });
});

// Admin Reports, Inventory & Audit Logs
app.get('/api/admin/reports', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ reports: db.getReports() });
});

app.get('/api/admin/audit-logs', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ auditLogs: db.getAuditLogs() });
});

app.get('/api/admin/inventory', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ movements: db.getInventoryMovements() });
});

// Cloudinary Management Endpoints (Admin Only)
app.get('/api/admin/cloudinary/config', requireAdminAuth, async (_req: Request, res: Response) => {
  const health = await testCloudinaryConnection();
  res.json({
    cloudName: CLOUDINARY_CONFIG.cloudName,
    uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
    assetFolder: CLOUDINARY_CONFIG.assetFolder,
    configured: !!process.env.CLOUDINARY_URL,
    status: health.connected ? 'ready' : 'disconnected',
    message: health.message
  });
});

app.post('/api/admin/cloudinary/upload', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { file, folder } = req.body;
    if (!file || typeof file !== 'string') {
      return res.status(400).json({ error: 'Image file (base64 data URI) is required' });
    }

    // Validation for image format
    if (file.startsWith('data:') && !file.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Only image files (JPEG, PNG, WEBP, AVIF, GIF) are allowed.' });
    }

    const uploadResult = await uploadToCloudinary(file, folder || CLOUDINARY_CONFIG.assetFolder);
    res.status(201).json({
      success: true,
      image: uploadResult
    });
  } catch (err: any) {
    console.error('[Cloudinary Upload Error]', err);
    res.status(500).json({ error: err.message || 'Cloudinary upload failed' });
  }
});

app.post('/api/admin/cloudinary/delete', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: 'publicId is required' });
    }

    const delResult = await deleteFromCloudinary(publicId);
    res.json({ success: true, result: delResult.result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to delete Cloudinary asset' });
  }
});

// Firebase Realtime Database Status and Migration Endpoints (Admin Only)
app.get('/api/admin/firebase/status', requireAdminAuth, async (_req: Request, res: Response) => {
  const status = await checkRtdbStatus();
  res.json({ status });
});

app.post('/api/admin/firebase/migrate', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const allData = (db as any).data;
    const result = await migrateStoreToRtdb(allData);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Migration failed' });
  }
});

// Admin Password Change Endpoint
app.post('/api/admin/change-password', requireAdminAuth, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  const result = db.updateAdminPassword(currentPassword, newPassword);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, message: 'Password updated successfully' });
});

// ==========================================
// 3. VITE INTEGRATION & STATIC SERVING
// ==========================================

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Aura Store Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
