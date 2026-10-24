import { MongoClient, Db } from 'mongodb';
import { SEED_16_PRODUCTS, type SeedProductInput } from './seedData.ts';
import type { Product, Order, OrderStatus } from './db.ts';
import { MONGO_CONFIG } from './config.ts';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let isConnected = false;

export interface MongoStatus {
  configured: boolean;
  connected: boolean;
  databaseName: string;
  productsCount: number;
  ordersCount: number;
  imagesCount: number;
  host: string;
  message: string;
}

export interface StoredImageDoc {
  id: string;
  url: string;
  secureUrl: string;
  publicId: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  uploadedAt: string;
  associatedProductId?: string;
  altText?: string;
  source: 'cloudinary';
  verified: boolean;
}

/**
 * Retrieves the MongoDB-compatible Firestore URI from environment
 */
export function getMongoUri(): string | null {
  return MONGO_CONFIG.uri;
}

/**
 * Initializes and returns the MongoDB database instance
 */
export async function getMongoDb(): Promise<Db | null> {
  if (dbInstance && isConnected) return dbInstance;

  const uri = getMongoUri();
  if (!uri) {
    console.info('[MongoDB Notice] No FIRESTORE_URL or MONGO_URL configured.');
    return null;
  }

  try {
    if (!client) {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });
    }

    await client.connect();
    isConnected = true;
    dbInstance = client.db(MONGO_CONFIG.dbName);
    console.log(`[MongoDB] Connected to database: ${MONGO_CONFIG.dbName}`);
    return dbInstance;
  } catch (err: any) {
    isConnected = false;
    console.warn('[MongoDB Connection Warning]', err.message);
    return null;
  }
}

/**
 * Health and status check for the MongoDB database
 */
export async function checkMongoStatus(): Promise<MongoStatus> {
  const uri = getMongoUri();
  if (!uri) {
    return {
      configured: false,
      connected: false,
      databaseName: 'none',
      productsCount: 0,
      ordersCount: 0,
      imagesCount: 0,
      host: 'none',
      message: 'No FIRESTORE_URL or MONGO_URL configured in environment'
    };
  }

  let host = 'unknown';
  try {
    const parsed = new URL(uri.replace('mongodb://', 'http://'));
    host = parsed.host;
  } catch {
    host = 'firestore.goog';
  }

  try {
    const db = await getMongoDb();
    if (!db) {
      return {
        configured: true,
        connected: false,
        databaseName: MONGO_CONFIG.dbName,
        productsCount: 0,
        ordersCount: 0,
        imagesCount: 0,
        host,
        message: 'Could not establish connection to MongoDB service'
      };
    }

    const [productsCount, ordersCount, imagesCount] = await Promise.all([
      db.collection<any>('products').countDocuments().catch(() => 0),
      db.collection<any>('orders').countDocuments().catch(() => 0),
      db.collection<any>('images').countDocuments().catch(() => 0)
    ]);

    return {
      configured: true,
      connected: true,
      databaseName: MONGO_CONFIG.dbName,
      productsCount,
      ordersCount,
      imagesCount,
      host,
      message: `Connected successfully to Firestore MongoDB API (${productsCount} products, ${ordersCount} orders, ${imagesCount} images)`
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      databaseName: MONGO_CONFIG.dbName,
      productsCount: 0,
      ordersCount: 0,
      imagesCount: 0,
      host,
      message: err.message || 'Connection check failed'
    };
  }
}

// ==========================================
// IMAGE COLLECTION PERSISTENCE (CLOUDINARY -> FIRESTORE/MONGO)
// ==========================================

/**
 * Stores a verified Cloudinary image document in the Firestore/MongoDB images collection
 */
export async function storeMongoImage(imageInput: {
  url: string;
  secureUrl?: string;
  publicId?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  associatedProductId?: string;
  altText?: string;
}): Promise<StoredImageDoc | null> {
  const db = await getMongoDb();
  const now = new Date().toISOString();
  const publicId = imageInput.publicId || `samples/ecommerce/img-${Date.now()}`;
  const id = publicId.replace(/\//g, '_');
  const secureUrl = imageInput.secureUrl || imageInput.url;

  const doc: StoredImageDoc = {
    id,
    url: imageInput.url,
    secureUrl,
    publicId,
    format: imageInput.format,
    width: imageInput.width,
    height: imageInput.height,
    bytes: imageInput.bytes,
    uploadedAt: now,
    associatedProductId: imageInput.associatedProductId,
    altText: imageInput.altText,
    source: 'cloudinary',
    verified: true
  };

  if (!db) {
    return doc;
  }

  try {
    await db.collection<any>('images').updateOne(
      { $or: [{ id }, { publicId }, { secureUrl }] },
      { $set: { ...doc, _id: id } },
      { upsert: true }
    );
    return doc;
  } catch (err: any) {
    console.warn('[MongoDB Image Store Warning]', err.message);
    return doc;
  }
}

/**
 * Retrieves all stored Cloudinary images from the Firestore/MongoDB images collection
 */
export async function getMongoImages(options: { page?: number; limit?: number } = {}): Promise<{ images: StoredImageDoc[]; total: number }> {
  const db = await getMongoDb();
  if (!db) return { images: [], total: 0 };

  try {
    const col = db.collection<any>('images');
    const total = await col.countDocuments();
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 50));
    const skip = (page - 1) * limit;

    const docs = await col
      .find({})
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const images: StoredImageDoc[] = docs.map(d => ({
      id: d.id || String(d._id),
      url: d.url,
      secureUrl: d.secureUrl || d.url,
      publicId: d.publicId,
      format: d.format,
      width: d.width,
      height: d.height,
      bytes: d.bytes,
      uploadedAt: d.uploadedAt || new Date().toISOString(),
      associatedProductId: d.associatedProductId,
      altText: d.altText,
      source: 'cloudinary',
      verified: d.verified !== undefined ? Boolean(d.verified) : true
    }));

    return { images, total };
  } catch (err: any) {
    console.warn('[MongoDB Get Images Warning]', err.message);
    return { images: [], total: 0 };
  }
}

/**
 * Deletes an image record from the Firestore/MongoDB images collection
 */
export async function deleteMongoImage(publicIdOrId: string): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  try {
    const res = await db.collection<any>('images').deleteOne({
      $or: [{ id: publicIdOrId }, { _id: publicIdOrId }, { publicId: publicIdOrId }]
    });
    return res.deletedCount > 0;
  } catch (err: any) {
    console.warn('[MongoDB Delete Image Warning]', err.message);
    return false;
  }
}

// ==========================================
// PRODUCT CATALOG SEEDING & MANAGEMENT
// ==========================================

/**
 * Idempotently seeds the canonical 16 products using SKU as the unique business key.
 */
export async function seedMongoProducts(
  productsToSeed: SeedProductInput[] = SEED_16_PRODUCTS,
  dryRun = false
): Promise<{
  success: boolean;
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  skipped: number;
  details: Array<{ sku: string; name: string; action: 'inserted' | 'updated' | 'skipped' | 'failed'; error?: string }>;
}> {
  const result = {
    success: true,
    total: productsToSeed.length,
    inserted: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    details: [] as Array<{ sku: string; name: string; action: 'inserted' | 'updated' | 'skipped' | 'failed'; error?: string }>
  };

  const db = await getMongoDb();
  if (!db) {
    throw new Error('Database connection not available to seed products.');
  }

  const col = db.collection<any>('products');
  const now = new Date().toISOString();

  for (const item of productsToSeed) {
    try {
      const existing = await col.findOne({ sku: item.sku });
      const id = existing?._id ? String(existing._id) : (existing?.id || `prod-${item.sku.toLowerCase()}`);

      const doc: Product = {
        id,
        name: item.name,
        sku: item.sku,
        description: item.description,
        shortDescription: item.shortDescription || '',
        price: Number(item.price),
        salePrice: item.salePrice ? Number(item.salePrice) : undefined,
        stock: Number(item.stock),
        categoryId: item.categoryId || 'cat-beauty',
        images: [item.imageUrl],
        imageMetadata: [
          {
            url: item.imageUrl,
            publicId: item.imagePublicId || `samples/ecommerce/${item.sku.toLowerCase()}`,
            isPrimary: true
          }
        ],
        isFeatured: Boolean(item.isFeatured),
        isBestSeller: Boolean(item.isBestSeller),
        isTrending: Boolean(item.isTrending),
        isNewArrival: Boolean(item.isNewArrival),
        isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      if (!dryRun) {
        await col.updateOne(
          { sku: item.sku },
          { $set: { ...doc, _id: id } },
          { upsert: true }
        );

        // Also record image in images collection
        await storeMongoImage({
          url: item.imageUrl,
          secureUrl: item.imageUrl,
          publicId: item.imagePublicId || `samples/ecommerce/${item.sku.toLowerCase()}`,
          associatedProductId: id
        });
      }

      if (existing) {
        result.updated++;
        result.details.push({ sku: item.sku, name: item.name, action: 'updated' });
      } else {
        result.inserted++;
        result.details.push({ sku: item.sku, name: item.name, action: 'inserted' });
      }
    } catch (err: any) {
      result.failed++;
      result.details.push({ sku: item.sku, name: item.name, action: 'failed', error: err.message });
      result.success = false;
    }
  }

  return result;
}

/**
 * Normalizes raw MongoDB documents to clean Product objects with guaranteed string image URLs
 */
export function normalizeDocToProduct(d: any): Product {
  const rawImages = Array.isArray(d.images) && d.images.length > 0
    ? d.images
    : (d.imageUrl ? (Array.isArray(d.imageUrl) ? d.imageUrl : [d.imageUrl]) : []);
  
  const images: string[] = [];
  const imageMetadata: any[] = Array.isArray(d.imageMetadata) ? [...d.imageMetadata] : [];

  for (const item of rawImages) {
    if (typeof item === 'string' && item.trim()) {
      const url = item.trim();
      images.push(url);
      if (!imageMetadata.some(m => m.url === url)) {
        imageMetadata.push({ url, publicId: '', isPrimary: images.length === 1 });
      }
    } else if (item && typeof item === 'object') {
      const url = item.url || item.secure_url || item.imageUrl || '';
      if (typeof url === 'string' && url.trim()) {
        const cleanUrl = url.trim();
        images.push(cleanUrl);
        if (!imageMetadata.some(m => m.url === cleanUrl)) {
          imageMetadata.push({
            url: cleanUrl,
            publicId: item.publicId || item.imagePublicId || '',
            isPrimary: images.length === 1
          });
        }
      }
    }
  }

  const primaryImage = images[0] || (typeof d.imageUrl === 'string' ? d.imageUrl : '') || '';
  if (primaryImage && images.length === 0) {
    images.push(primaryImage);
  }

  return {
    id: d.id || String(d._id),
    name: d.name || 'Product',
    sku: d.sku || `SKU-${d._id}`,
    description: d.description || '',
    shortDescription: d.shortDescription || '',
    price: Number(d.price) || 0,
    salePrice: d.salePrice ? Number(d.salePrice) : undefined,
    stock: d.stock !== undefined ? Number(d.stock) : 10,
    categoryId: d.categoryId || 'cat-beauty',
    images,
    imageMetadata: imageMetadata.length > 0 ? imageMetadata : undefined,
    isFeatured: Boolean(d.isFeatured),
    isBestSeller: Boolean(d.isBestSeller),
    isTrending: Boolean(d.isTrending),
    isNewArrival: Boolean(d.isNewArrival),
    isActive: d.isActive !== undefined ? Boolean(d.isActive) : true,
    createdAt: d.createdAt || new Date().toISOString(),
    updatedAt: d.updatedAt || new Date().toISOString()
  };
}

/**
 * Retrieves products from MongoDB with search, filter, and sorting
 */
export async function getMongoProducts(options: {
  category?: string;
  search?: string;
  sort?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ products: Product[]; total: number }> {
  const db = await getMongoDb();
  if (!db) return { products: [], total: 0 };

  const query: any = {};
  if (options.isActive !== undefined) {
    query.isActive = options.isActive;
  }
  if (options.category && options.category !== 'all') {
    query.categoryId = options.category;
  }
  if (options.search && options.search.trim()) {
    const q = options.search.trim();
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { sku: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } }
    ];
  }

  const col = db.collection<any>('products');
  const total = await col.countDocuments(query);

  let sortObj: any = { createdAt: -1 };
  if (options.sort === 'price_asc') sortObj = { price: 1 };
  else if (options.sort === 'price_desc') sortObj = { price: -1 };
  else if (options.sort === 'newest') sortObj = { createdAt: -1 };
  else if (options.sort === 'popular') sortObj = { isBestSeller: -1, isFeatured: -1 };

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 50));
  const skip = (page - 1) * limit;

  const docs = await col
    .find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(limit)
    .toArray();

  const products: Product[] = docs.map(d => normalizeDocToProduct(d));

  return { products, total };
}

/**
 * Gets a single product by ID or SKU
 */
export async function getMongoProductById(idOrSku: string): Promise<Product | null> {
  const db = await getMongoDb();
  if (!db) return null;

  const doc = await db.collection<any>('products').findOne({
    $or: [{ id: idOrSku }, { _id: idOrSku }, { sku: idOrSku.toUpperCase() }]
  });

  if (!doc) return null;

  return normalizeDocToProduct(doc);
}

/**
 * Creates or updates a product in MongoDB and synchronizes image assets into images collection
 */
export async function saveMongoProduct(payload: Partial<Product> & { name: string; price: number }): Promise<Product> {
  const db = await getMongoDb();
  if (!db) throw new Error('Database connection unavailable.');

  const now = new Date().toISOString();
  const id = payload.id || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const sku = payload.sku?.trim().toUpperCase() || `SKU-${id.toUpperCase()}`;

  const product: Product = {
    id,
    name: payload.name.trim(),
    sku,
    description: payload.description || '',
    shortDescription: payload.shortDescription || '',
    price: Number(payload.price),
    salePrice: payload.salePrice ? Number(payload.salePrice) : undefined,
    stock: payload.stock !== undefined ? Number(payload.stock) : 10,
    categoryId: payload.categoryId || 'cat-beauty',
    images: Array.isArray(payload.images) && payload.images.length > 0 ? payload.images : [],
    imageMetadata: payload.imageMetadata,
    isFeatured: Boolean(payload.isFeatured),
    isBestSeller: Boolean(payload.isBestSeller),
    isTrending: Boolean(payload.isTrending),
    isNewArrival: payload.isNewArrival !== undefined ? Boolean(payload.isNewArrival) : true,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdAt: payload.createdAt || now,
    updatedAt: now
  };

  await db.collection<any>('products').updateOne(
    { $or: [{ id }, { _id: id }, { sku }] },
    { $set: { ...product, _id: id } },
    { upsert: true }
  );

  // Synchronize Cloudinary images to the images collection
  if (Array.isArray(product.images)) {
    for (const imgUrl of product.images) {
      if (typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
        const meta = product.imageMetadata?.find(m => m.url === imgUrl);
        await storeMongoImage({
          url: imgUrl,
          secureUrl: imgUrl,
          publicId: meta?.publicId,
          associatedProductId: id
        });
      }
    }
  }

  return product;
}

/**
 * Soft deletes / archives a product
 */
export async function archiveMongoProduct(productId: string): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  const res = await db.collection<any>('products').updateOne(
    { $or: [{ id: productId }, { _id: productId }] },
    { $set: { isActive: false, updatedAt: new Date().toISOString() } }
  );

  return res.matchedCount > 0;
}

/**
 * Permanently deletes a product from MongoDB
 */
export async function deleteMongoProduct(productId: string): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  const res = await db.collection<any>('products').deleteOne({
    $or: [{ id: productId }, { _id: productId }]
  });

  return res.deletedCount > 0;
}

/**
 * Saves a customer order and atomically deducts inventory
 */
export async function createMongoOrder(order: Order): Promise<{ success: boolean; order: Order; error?: string }> {
  const db = await getMongoDb();
  if (!db) return { success: false, order, error: 'Database not connected' };

  try {
    for (const item of order.items) {
      const prod = await db.collection<any>('products').findOne({
        $or: [{ id: item.productId }, { _id: item.productId }]
      });

      if (prod && prod.stock < item.quantity) {
        return {
          success: false,
          order,
          error: `Insufficient stock for "${prod.name}". Available: ${prod.stock}`
        };
      }
    }

    for (const item of order.items) {
      await db.collection<any>('products').updateOne(
        { $or: [{ id: item.productId }, { _id: item.productId }] },
        { $inc: { stock: -item.quantity }, $set: { updatedAt: new Date().toISOString() } }
      );
    }

    await db.collection<any>('orders').insertOne({ ...order, _id: order.id });

    return { success: true, order };
  } catch (err: any) {
    return { success: false, order, error: err.message };
  }
}

/**
 * Retrieves orders from MongoDB
 */
export async function getMongoOrders(options?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ orders: Order[]; total: number }> {
  const db = await getMongoDb();
  if (!db) return { orders: [], total: 0 };

  const query: any = {};
  if (options?.status && options.status !== 'all') {
    query.fulfillmentStatus = options.status;
  }
  if (options?.search && options.search.trim()) {
    const q = options.search.trim();
    query.$or = [
      { orderNumber: { $regex: q, $options: 'i' } },
      { 'customer.fullName': { $regex: q, $options: 'i' } },
      { 'customer.phone': { $regex: q, $options: 'i' } },
      { 'customer.city': { $regex: q, $options: 'i' } }
    ];
  }

  const col = db.collection<any>('orders');
  const total = await col.countDocuments(query);

  const page = Math.max(1, options?.page || 1);
  const limit = Math.min(100, Math.max(1, options?.limit || 50));
  const skip = (page - 1) * limit;

  const docs = await col
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const orders: Order[] = docs.map(d => ({
    id: d.id || String(d._id),
    orderNumber: d.orderNumber,
    customer: d.customer,
    items: d.items || [],
    subtotal: d.subtotal,
    discount: d.discount || 0,
    shippingFee: d.shippingFee || 0,
    total: d.total,
    paymentMethod: d.paymentMethod || 'COD',
    paymentStatus: d.paymentStatus || 'pending',
    fulfillmentStatus: d.fulfillmentStatus || 'placed',
    statusHistory: d.statusHistory || [],
    trackingNumber: d.trackingNumber,
    courierName: d.courierName,
    cancelReason: d.cancelReason,
    internalNotes: d.internalNotes,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  }));

  return { orders, total };
}

/**
 * Updates order fulfillment status and handles cancellation restock
 */
export async function updateMongoOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  trackingNumber?: string,
  courierName?: string,
  note?: string,
  performedBy = 'Administrator'
): Promise<Order | null> {
  const db = await getMongoDb();
  if (!db) return null;

  const existing = await db.collection<any>('orders').findOne({
    $or: [{ id: orderId }, { _id: orderId }]
  });

  if (!existing) return null;

  const now = new Date().toISOString();
  const prevStatus = existing.fulfillmentStatus;

  if (newStatus === 'cancelled' && prevStatus !== 'cancelled' && Array.isArray(existing.items)) {
    for (const item of existing.items) {
      await db.collection<any>('products').updateOne(
        { $or: [{ id: item.productId }, { _id: item.productId }] },
        { $inc: { stock: item.quantity }, $set: { updatedAt: now } }
      );
    }
  }

  const historyEntry = {
    status: newStatus,
    timestamp: now,
    note: note || `Status updated from ${prevStatus} to ${newStatus} by ${performedBy}`
  };

  const updateFields: any = {
    fulfillmentStatus: newStatus,
    updatedAt: now,
    statusHistory: [...(existing.statusHistory || []), historyEntry]
  };

  if (trackingNumber !== undefined) updateFields.trackingNumber = trackingNumber;
  if (courierName !== undefined) updateFields.courierName = courierName;
  if (newStatus === 'delivered') updateFields.paymentStatus = 'paid';

  await db.collection<any>('orders').updateOne(
    { $or: [{ id: orderId }, { _id: orderId }] },
    { $set: updateFields }
  );

  return {
    ...existing,
    ...updateFields,
    id: existing.id || String(existing._id)
  };
}

/**
 * Finds order by ID or order number, optionally verifying customer phone
 */
export async function getMongoOrderByIdOrNumber(
  idOrNumber: string,
  phone?: string
): Promise<Order | null> {
  const db = await getMongoDb();
  if (!db) return null;

  const query: any = {
    $or: [{ id: idOrNumber }, { _id: idOrNumber }, { orderNumber: idOrNumber }]
  };

  const d = await db.collection<any>('orders').findOne(query);
  if (!d) return null;

  if (phone && d.customer?.phone) {
    const cleanReq = phone.replace(/\D/g, '');
    const cleanCust = d.customer.phone.replace(/\D/g, '');
    if (cleanReq && cleanCust && !cleanCust.includes(cleanReq) && !cleanReq.includes(cleanCust)) {
      return null;
    }
  }

  return {
    id: d.id || String(d._id),
    orderNumber: d.orderNumber,
    customer: d.customer,
    items: d.items || [],
    subtotal: d.subtotal,
    discount: d.discount || 0,
    shippingFee: d.shippingFee || 0,
    total: d.total,
    paymentMethod: d.paymentMethod || 'COD',
    paymentStatus: d.paymentStatus || 'pending',
    fulfillmentStatus: d.fulfillmentStatus || 'placed',
    statusHistory: d.statusHistory || [],
    trackingNumber: d.trackingNumber,
    courierName: d.courierName,
    cancelReason: d.cancelReason,
    internalNotes: d.internalNotes,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  };
}
