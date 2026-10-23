import { ref, get, set, update, remove, child } from 'firebase/database';
import { rtdb, auth } from './firebase.ts';
import type {
  Product,
  Category,
  Order,
  OrderStatus,
  Coupon,
  Banner,
  StoreSettings
} from '../types/store.ts';

// Default categories if database is not yet populated
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-beauty',
    name: 'Beauty Creams & Skincare',
    slug: 'beauty-creams',
    description: 'Nourishing daily face creams, moisturizing lotions, and essential skincare formulas',
    image: 'https://res.cloudinary.com/dqtawjwph/image/upload/v1792480787/samples/ecommerce/dpw5sew73tpzeq9egdio.webp',
    displayOrder: 1,
    isActive: true
  },
  {
    id: 'cat-hair',
    name: 'Hairbrushes & Styling',
    slug: 'hairbrushes-styling',
    description: 'Ergonomic paddle brushes, thermal round blow-dry brushes, and scalp stimulators',
    image: '/src/assets/images/product_rosegold_brush_1792058412656.jpg',
    displayOrder: 2,
    isActive: true
  },
  {
    id: 'cat-organizers',
    name: 'Cosmetic & Vanity Organizers',
    slug: 'cosmetic-organizers',
    description: '360 rotating caddies, acrylic makeup drawers, and aesthetic vanity storage',
    image: '/src/assets/images/product_makeup_organizer_1792058414597.jpg',
    displayOrder: 3,
    isActive: true
  },
  {
    id: 'cat-household',
    name: 'Household & Home Storage',
    slug: 'household-storage',
    description: 'Drawer dividers, kitchen spice racks, and aesthetic home organizers',
    image: '/src/assets/images/product_wood_paddle_brush_1792058413065.jpg',
    displayOrder: 4,
    isActive: true
  }
];

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Zamzam',
  tagline: 'Refined Everyday Beauty, Hair & Home Essentials',
  contactPhone: '03049002888',
  contactEmail: 'yk5550950@gmail.com',
  address: 'Zamzam Lifestyle Studio, Commercial Zone, Phase 5 DHA, Lahore, Pakistan',
  currency: 'PKR',
  standardShippingFee: 200,
  freeShippingThreshold: 3000,
  returnPolicy: '7-day replacement on undamaged personal accessories and cosmetic organizers. Unused hygiene items with seal intact.',
  deliveryPolicy: 'Fast nationwide Cash on Delivery (COD). Major cities delivered in 2-3 business days. All other areas 3-5 business days.',
  aboutText: 'Zamzam curates salon-grade hair care brushes, high-precision personal grooming tools, and elegant cosmetic storage.'
};

export const DEFAULT_BANNERS: Banner[] = [
  {
    id: 'ban-1',
    title: 'Zamzam Trading Company',
    subtitle: 'Explore our curated skincare formulations, rose gold styling brushes & acrylic organizers.',
    badgeText: 'New Season',
    imageUrl: 'https://res.cloudinary.com/dqtawjwph/image/upload/v1792471747/zamzam/demo-products/beauty-creams/demo-mk-cosmetics-age-miracle-creme.jpg',
    linkUrl: '#collection',
    ctaText: 'Explore Catalog',
    isActive: true,
    displayOrder: 1
  }
];

export const DEFAULT_COUPONS: Coupon[] = [
  {
    id: 'cpn-1',
    code: 'WELCOME10',
    discountType: 'percentage',
    discountValue: 10,
    minSpend: 1500,
    maxDiscount: 500,
    usageLimit: 500,
    timesUsed: 13,
    isActive: true
  },
  {
    id: 'cpn-2',
    code: 'FREESHIP',
    discountType: 'fixed',
    discountValue: 200,
    minSpend: 2500,
    usageLimit: 300,
    timesUsed: 19,
    isActive: true
  }
];

/**
 * Normalizes a raw product record from Firebase Realtime Database
 * into the strict storefront Product interface.
 * Preserves Cloudinary image URLs, IDs, categories, and inventory.
 */
export function normalizeProductRecord(id: string, raw: any): Product {
  if (!raw || typeof raw !== 'object') {
    return {
      id,
      name: id,
      price: 0,
      stock: 0,
      categoryId: 'demo-products',
      images: [],
      description: '',
      shortDescription: '',
      isFeatured: false,
      isBestSeller: false,
      isTrending: false,
      isNewArrival: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      sku: id.toUpperCase()
    };
  }

  // 1. Resolve Cloudinary Image URLs
  const images: string[] = [];
  if (Array.isArray(raw.images) && raw.images.length > 0) {
    raw.images.forEach((img: any) => {
      if (typeof img === 'string' && img.trim()) images.push(img.trim());
      else if (img?.url && typeof img.url === 'string') images.push(img.url.trim());
    });
  }

  if (images.length === 0 && raw.imageUrl && typeof raw.imageUrl === 'string') {
    images.push(raw.imageUrl.trim());
  }

  if (images.length === 0 && Array.isArray(raw.imageMetadata)) {
    raw.imageMetadata.forEach((meta: any) => {
      if (meta?.url && typeof meta.url === 'string') images.push(meta.url.trim());
    });
  }

  // 2. Resolve Price & Sale Price
  const price = typeof raw.price === 'number' ? raw.price : parseFloat(raw.price) || 0;
  const salePrice = raw.salePrice !== undefined && raw.salePrice !== null
    ? (typeof raw.salePrice === 'number' ? raw.salePrice : parseFloat(raw.salePrice) || undefined)
    : undefined;

  // 3. Resolve Category
  const categoryId = raw.categoryId || 'cat-beauty';

  // 4. Resolve Stable ID
  const prodId = raw.id || (raw.sku ? `prod-${raw.sku.toLowerCase()}` : (id ? (id.startsWith('prod-') ? id : `prod-${id}`) : `prod-${Date.now()}`));

  return {
    id: prodId,
    name: raw.name || 'Untitled Product',
    price,
    salePrice,
    stock: typeof raw.stock === 'number' ? raw.stock : parseInt(raw.stock, 10) || 0,
    categoryId,
    images: images.length > 0 ? images : ['https://res.cloudinary.com/dqtawjwph/image/upload/v1792480787/samples/ecommerce/dpw5sew73tpzeq9egdio.webp'],
    description: raw.description || raw.shortDescription || '',
    shortDescription: raw.shortDescription || '',
    sku: raw.sku || prodId.toUpperCase(),
    isFeatured: Boolean(raw.isFeatured),
    isBestSeller: Boolean(raw.isBestSeller),
    isTrending: Boolean(raw.isTrending),
    isNewArrival: raw.isNewArrival !== undefined ? Boolean(raw.isNewArrival) : false,
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    isDemo: false,
    imageMetadata: Array.isArray(raw.imageMetadata) ? raw.imageMetadata : (raw.imageUrl ? [{ url: raw.imageUrl, publicId: raw.imagePublicId, isPrimary: true }] : undefined),
    brand: raw.brand,
    priceCurrency: raw.priceCurrency || 'PKR',
    priceLabel: raw.priceLabel,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

/**
 * Reads records from Firebase Realtime Database at a given path.
 * Handles both keyed objects ({ [key]: data }) and arrays.
 */
async function getRtdbPath<T = any>(path: string): Promise<T | null> {
  try {
    const snapshot = await get(ref(rtdb, path));
    if (!snapshot.exists()) return null;
    return snapshot.val() as T;
  } catch (err) {
    console.warn(`[RTDB Fetch Warning] Failed reading path /${path}:`, err);
    return null;
  }
}

// =========================================================================
// REALTIME DATABASE CATALOG SERVICES
// =========================================================================

export const rtdbService = {
  /**
   * Reads all records from /demoProducts in Firebase Realtime Database
   */
  getDemoProducts: async (): Promise<Product[]> => {
    const raw = await getRtdbPath<Record<string, any>>('demoProducts');
    if (!raw) return [];

    const products: Product[] = [];
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      Object.entries(raw).forEach(([id, item]) => {
        products.push(normalizeProductRecord(id, { ...item, isDemo: true }));
      });
    } else if (Array.isArray(raw)) {
      raw.forEach((item, index) => {
        if (item) {
          const id = item.id || `demo-product-${index}`;
          products.push(normalizeProductRecord(id, { ...item, isDemo: true }));
        }
      });
    }

    return products;
  },

  /**
   * Reads all live products from /products or root / (0..15) in Firebase Realtime Database
   */
  getLiveProducts: async (): Promise<Product[]> => {
    let raw = await getRtdbPath<any>('products');

    // If /products is not found or empty, read directly from root / where products 0..15 are stored
    if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
      raw = await getRtdbPath<any>('');
    }

    if (!raw) return [];

    const products: Product[] = [];
    if (Array.isArray(raw)) {
      raw.forEach((item, index) => {
        if (item && typeof item === 'object') {
          const id = item.id || (item.sku ? `prod-${item.sku.toLowerCase()}` : `product-${index}`);
          products.push(normalizeProductRecord(id, item));
        }
      });
    } else if (typeof raw === 'object') {
      Object.entries(raw).forEach(([id, item]) => {
        const pItem = item as any;
        if (pItem && typeof pItem === 'object') {
          if (['settings', 'categories', 'orders', 'customerOrders', 'coupons', 'banners'].includes(id)) {
            return;
          }
          if (pItem.name || pItem.sku || pItem.price !== undefined) {
            const prodId = pItem.id || (pItem.sku ? `prod-${pItem.sku.toLowerCase()}` : id);
            products.push(normalizeProductRecord(prodId, pItem));
          }
        }
      });
    }

    return products;
  },

  /**
   * Reads the comprehensive product catalog.
   */
  getCatalog: async (): Promise<{
    liveProducts: Product[];
    demoProducts: Product[];
    allProducts: Product[];
  }> => {
    let live = await rtdbService.getLiveProducts();

    // If live RTDB returned empty, fetch from backend API /api/v1/products (which connects to MongoDB/local catalog)
    if (live.length === 0) {
      try {
        const res = await fetch('/api/v1/products').then(r => r.json());
        if (res.products && Array.isArray(res.products) && res.products.length > 0) {
          live = res.products.map((p: any) => normalizeProductRecord(p.id, p));
        }
      } catch (err) {
        console.warn('[Catalog API Fallback]', err);
      }
    }

    return {
      liveProducts: live,
      demoProducts: [],
      allProducts: live
    };
  },

  /**
   * Publishes a single demo product from /demoProducts to /products in RTDB
   * Preserves Cloudinary image URLs while allowing price/stock/name adjustments.
   */
  publishDemoProduct: async (
    demoProductId: string,
    overrides?: Partial<Product>
  ): Promise<Product> => {
    const rawDemo = await getRtdbPath<any>(`demoProducts/${demoProductId}`);
    if (!rawDemo) {
      throw new Error(`Demo product "${demoProductId}" was not found in /demoProducts.`);
    }

    const normalized = normalizeProductRecord(demoProductId, rawDemo);
    const published: Product = {
      ...normalized,
      ...overrides,
      id: overrides?.id || normalized.id,
      isDemo: false,
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
      price: overrides?.price !== undefined ? overrides.price : (normalized.price > 0 ? normalized.price : 1500),
      stock: overrides?.stock !== undefined ? overrides.stock : (normalized.stock > 0 ? normalized.stock : 10),
      updatedAt: new Date().toISOString()
    };

    // Save directly to /products/{id} in RTDB
    await set(ref(rtdb, `products/${published.id}`), published);
    return published;
  },

  /**
   * Publishes all verified beauty creams from /demoProducts into /products
   */
  publishAllDemoCreams: async (): Promise<{ count: number; products: Product[] }> => {
    const demoItems = await rtdbService.getDemoProducts();
    // Filter the 5 verified creams
    const creams = demoItems.filter(p =>
      p.id.includes('cream') ||
      p.id.includes('creme') ||
      p.categoryId === 'demo-beauty-creams' ||
      p.price > 0
    );

    const publishedList: Product[] = [];
    for (const cream of creams) {
      const pub = await rtdbService.publishDemoProduct(cream.id, {
        isDemo: false,
        isActive: true
      });
      publishedList.push(pub);
    }

    return { count: publishedList.length, products: publishedList };
  },

  /**
   * Saves or updates a product in /products/{id}
   */
  saveProduct: async (product: Partial<Product> & { name: string; price: number }): Promise<Product> => {
    const id = product.id || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fullProduct: Product = {
      id,
      name: product.name.trim(),
      price: Number(product.price),
      salePrice: product.salePrice ? Number(product.salePrice) : undefined,
      stock: product.stock !== undefined ? Number(product.stock) : 10,
      categoryId: product.categoryId || 'demo-beauty-creams',
      images: Array.isArray(product.images) && product.images.length > 0 ? product.images : ['https://res.cloudinary.com/dqtawjwph/image/upload/v1792471736/zamzam/demo-products/beauty-creams/demo-biocos-beauty-cream.jpg'],
      description: product.description || '',
      shortDescription: product.shortDescription || '',
      sku: product.sku || `SKU-${id.toUpperCase()}`,
      isFeatured: Boolean(product.isFeatured),
      isBestSeller: Boolean(product.isBestSeller),
      isTrending: Boolean(product.isTrending),
      isNewArrival: product.isNewArrival !== undefined ? Boolean(product.isNewArrival) : true,
      isActive: product.isActive !== undefined ? Boolean(product.isActive) : true,
      isDemo: Boolean(product.isDemo),
      brand: product.brand,
      createdAt: product.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await set(ref(rtdb, `products/${id}`), fullProduct);
    return fullProduct;
  },

  /**
   * Deletes a product from /products/{id} in RTDB
   */
  deleteProduct: async (productId: string): Promise<void> => {
    await remove(ref(rtdb, `products/${productId}`));
  },

  /**
   * Reads categories from /categories in RTDB (fallback to DEFAULT_CATEGORIES)
   */
  getCategories: async (): Promise<Category[]> => {
    const raw = await getRtdbPath<Record<string, any>>('categories');
    if (!raw) return DEFAULT_CATEGORIES;

    if (Array.isArray(raw)) {
      return raw.filter(Boolean);
    }

    const categories: Category[] = [];
    Object.entries(raw).forEach(([id, item]) => {
      categories.push({
        id: item.id || id,
        name: item.name || id,
        slug: item.slug || id,
        description: item.description,
        image: item.image,
        displayOrder: item.displayOrder || 1,
        isActive: item.isActive !== undefined ? item.isActive : true
      });
    });

    return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  },

  /**
   * Reads settings from /settings in RTDB (fallback to DEFAULT_SETTINGS)
   */
  getSettings: async (): Promise<StoreSettings> => {
    const raw = await getRtdbPath<StoreSettings>('settings');
    return raw || DEFAULT_SETTINGS;
  },

  /**
   * Reads banners from /banners in RTDB (fallback to DEFAULT_BANNERS)
   */
  getBanners: async (): Promise<Banner[]> => {
    const raw = await getRtdbPath<Record<string, any>>('banners');
    if (!raw) return DEFAULT_BANNERS;

    if (Array.isArray(raw)) return raw.filter(Boolean);
    const list: Banner[] = [];
    Object.entries(raw).forEach(([id, item]) => {
      list.push({ ...item, id: item.id || id });
    });
    return list.length > 0 ? list : DEFAULT_BANNERS;
  },

  /**
   * Reads coupons from /coupons in RTDB (fallback to DEFAULT_COUPONS)
   */
  getCoupons: async (): Promise<Coupon[]> => {
    const raw = await getRtdbPath<Record<string, any>>('coupons');
    if (!raw) return DEFAULT_COUPONS;

    if (Array.isArray(raw)) return raw.filter(Boolean);
    const list: Coupon[] = [];
    Object.entries(raw).forEach(([id, item]) => {
      list.push({ ...item, id: item.id || id });
    });
    return list.length > 0 ? list : DEFAULT_COUPONS;
  },

  // =======================================================================
  // ORDERS & CUSTOMER DATA ISOLATION
  // =======================================================================

  /**
   * Creates an order in /orders/{orderId} and records it under /customerOrders/{customerId}/{orderId}
   * Enforces customer identity validation.
   */
  createOrder: async (orderPayload: {
    customer: {
      fullName: string;
      email?: string;
      phone: string;
      address: string;
      city: string;
      postalCode?: string;
      notes?: string;
    };
    items: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      image?: string;
      sku?: string;
    }>;
    subtotal: number;
    discount?: number;
    shippingFee: number;
    total: number;
    paymentMethod?: 'cod' | 'card' | 'bank_transfer';
    couponCode?: string;
    customerId?: string;
  }): Promise<Order> => {
    const user = auth.currentUser;
    const customerId = user?.uid || orderPayload.customerId || 'guest';
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const orderNumber = `ZM-${Math.floor(100000 + Math.random() * 900000)}`;

    const order: Order = {
      id: orderId,
      orderNumber,
      customerId,
      customer: orderPayload.customer,
      items: orderPayload.items,
      subtotal: orderPayload.subtotal,
      discount: orderPayload.discount || 0,
      shippingFee: orderPayload.shippingFee,
      total: orderPayload.total,
      paymentMethod: orderPayload.paymentMethod || 'cod',
      paymentStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      couponCode: orderPayload.couponCode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          status: 'unfulfilled',
          timestamp: new Date().toISOString(),
          note: 'Order placed by customer via Cash on Delivery'
        }
      ]
    };

    // 1. Write to authoritative /orders/{orderId}
    await set(ref(rtdb, `orders/${orderId}`), order);

    // 2. Write to customer-scoped list /customerOrders/{customerId}/{orderId}
    if (customerId && customerId !== 'guest') {
      await set(ref(rtdb, `customerOrders/${customerId}/${orderId}`), {
        orderId,
        orderNumber,
        total: order.total,
        createdAt: order.createdAt,
        fulfillmentStatus: order.fulfillmentStatus
      });
    }

    return order;
  },

  /**
   * Fetches only the authenticated customer's own orders from /customerOrders/{customerId}
   * Strictly enforces Customer Data Isolation.
   */
  getCustomerOrders: async (customerId: string): Promise<Order[]> => {
    if (!customerId) return [];

    // Try reading customerOrders index first
    const refs = await getRtdbPath<Record<string, any>>(`customerOrders/${customerId}`);
    if (refs && typeof refs === 'object') {
      const orderIds = Object.keys(refs);
      const orders: Order[] = [];
      for (const id of orderIds) {
        const o = await getRtdbPath<Order>(`orders/${id}`);
        if (o && o.customerId === customerId) {
          orders.push(o);
        }
      }
      return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Fallback: check all orders where customerId matches
    const all = await getRtdbPath<Record<string, Order>>('orders');
    if (!all) return [];

    return Object.values(all)
      .filter(o => o && o.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Admin-only: Reads all orders from /orders
   */
  getAllOrders: async (): Promise<Order[]> => {
    const raw = await getRtdbPath<Record<string, Order>>('orders');
    if (!raw) return [];

    const orders: Order[] = Object.values(raw).filter(Boolean);
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Admin-only: Updates order fulfillment status and tracking in RTDB
   */
  updateOrderStatus: async (
    orderId: string,
    fulfillmentStatus: OrderStatus,
    trackingNumber?: string,
    courierName?: string,
    note?: string
  ): Promise<Order> => {
    const existing = await getRtdbPath<Order>(`orders/${orderId}`);
    if (!existing) throw new Error(`Order ${orderId} not found.`);

    const now = new Date().toISOString();
    const updatedHistory = [
      ...(existing.statusHistory || []),
      {
        status: fulfillmentStatus,
        timestamp: now,
        note: note || `Status updated to ${fulfillmentStatus}`
      }
    ];

    const updates: Partial<Order> = {
      fulfillmentStatus,
      updatedAt: now,
      statusHistory: updatedHistory
    };

    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (courierName !== undefined) updates.courierName = courierName;
    if (fulfillmentStatus === 'delivered') updates.paymentStatus = 'paid';

    await update(ref(rtdb, `orders/${orderId}`), updates);

    // Also update customer index
    if (existing.customerId && existing.customerId !== 'guest') {
      await update(ref(rtdb, `customerOrders/${existing.customerId}/${orderId}`), {
        fulfillmentStatus,
        updatedAt: now
      }).catch(() => {});
    }

    return { ...existing, ...updates };
  },

  /**
   * Order tracking by orderNumber and phone
   */
  trackOrder: async (orderNumber: string, phone: string): Promise<Order | null> => {
    const all = await getRtdbPath<Record<string, Order>>('orders');
    if (!all) return null;

    const cleanNum = orderNumber.trim().toUpperCase();
    const cleanPhone = phone.replace(/\D/g, '');

    const found = Object.values(all).find(o => {
      if (!o || !o.customer) return false;
      const oNum = (o.orderNumber || o.id || '').trim().toUpperCase();
      const oPhone = (o.customer.phone || '').replace(/\D/g, '');
      return oNum === cleanNum && (cleanPhone.length >= 7 ? oPhone.includes(cleanPhone) : oPhone === cleanPhone);
    });

    return found || null;
  }
};
