import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface ProductImageMeta {
  url: string;
  publicId?: string;
  altText?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  price: number;
  salePrice?: number;
  stock: number;
  images: string[];
  imageMetadata?: ProductImageMeta[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isTrending: boolean;
  isNewArrival: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  sku?: string;
}

export type OrderStatus = 
  | 'placed'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  orderNumber: string;
  customer: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    area?: string;
    notes?: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: 'COD';
  paymentStatus: 'pending' | 'paid' | 'cancelled';
  fulfillmentStatus: OrderStatus;
  statusHistory: Array<{
    status: OrderStatus;
    timestamp: string;
    note?: string;
  }>;
  trackingNumber?: string;
  courierName?: string;
  cancelReason?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minSpend?: number;
  maxDiscount?: number;
  usageLimit?: number;
  timesUsed: number;
  expiresAt?: string;
  isActive: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badgeText?: string;
  imageUrl: string;
  linkUrl: string;
  ctaText: string;
  isActive: boolean;
  displayOrder: number;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  logoUrl?: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  currency: string;
  standardShippingFee: number;
  freeShippingThreshold: number;
  returnPolicy: string;
  deliveryPolicy: string;
  aboutText: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'order_deduction' | 'order_cancellation_restock' | 'manual_adjustment' | 'restock';
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: string;
  timestamp: string;
  performedBy: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'product' | 'category' | 'order' | 'coupon' | 'settings' | 'banner';
  entityId: string;
  details: string;
  performedBy: string;
  timestamp: string;
}

export interface DatabaseSchema {
  products: Product[];
  categories: Category[];
  orders: Order[];
  coupons: Coupon[];
  banners: Banner[];
  settings: StoreSettings;
  inventoryMovements: InventoryMovement[];
  auditLogs: AuditLog[];
  adminAuth: {
    username: string;
    passwordHash: string; // SHA-256 hash of admin password
    tokenSecret: string;
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export const DEFAULT_ADMIN_PASS = 'admin12345';
export const DEFAULT_ADMIN_USER = 'admin';

const INITIAL_DATA: DatabaseSchema = {
  adminAuth: {
    username: DEFAULT_ADMIN_USER,
    passwordHash: hashPassword(DEFAULT_ADMIN_PASS),
    tokenSecret: crypto.randomBytes(32).toString('hex')
  },
  settings: {
    storeName: 'Zamzam',
    tagline: 'Refined Everyday Beauty, Hair & Home Essentials',
    contactPhone: '03049002888',
    contactEmail: 'yk5550950@gmail.com',
    address: 'Zamzam Lifestyle Studio, Commercial Zone, Phase 5 DHA, Lahore, Pakistan',
    currency: 'PKR',
    standardShippingFee: 200,
    freeShippingThreshold: 3000,
    returnPolicy: '7-day hassle-free replacement or return on undamaged personal accessories and cosmetic organizers. Unused hygiene items with seal intact.',
    deliveryPolicy: 'Fast nationwide Cash on Delivery (COD). Orders in Lahore/Karachi/Islamabad delivered within 2-3 business days. All other cities 3-5 business days.',
    aboutText: 'Zamzam curates salon-grade hair care brushes, high-precision personal grooming tools, and elegant cosmetic storage designed for modern everyday living.'
  },
  categories: [
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
  ],
  banners: [
    {
      id: 'ban-1',
      title: 'Zamzam Trading Company',
      subtitle: 'Discover our signature rose gold thermal brushes & acrylic organizers.',
      badgeText: 'New Collection',
      imageUrl: '/src/assets/images/hero_lifestyle_store_1792058412869.jpg',
      linkUrl: '#collection',
      ctaText: 'Explore Now',
      isActive: true,
      displayOrder: 1
    }
  ],
  coupons: [
    {
      id: 'cpn-1',
      code: 'WELCOME10',
      discountType: 'percentage',
      discountValue: 10,
      minSpend: 1500,
      maxDiscount: 500,
      usageLimit: 500,
      timesUsed: 12,
      isActive: true
    },
    {
      id: 'cpn-2',
      code: 'AURA500',
      discountType: 'fixed',
      discountValue: 500,
      minSpend: 3500,
      usageLimit: 200,
      timesUsed: 6,
      isActive: true
    },
    {
      id: 'cpn-3',
      code: 'FREESHIP',
      discountType: 'fixed',
      discountValue: 200,
      minSpend: 2000,
      usageLimit: 300,
      timesUsed: 19,
      isActive: true
    }
  ],
  products: [
    {
      id: 'prod-1',
      name: 'Rose Gold Pro Thermal Styling Brush',
      sku: 'AURA-BR-RG01',
      description: 'Professional salon-grade round blow-dry brush featuring ionic ceramic barrel, heat-resistant nylon ball bristles, and ergonomic metallic rose gold handle for silky voluminous blowouts.',
      shortDescription: 'Ionic thermal round brush for salon blowouts',
      categoryId: 'cat-hair',
      price: 1550,
      salePrice: 1290,
      stock: 45,
      images: [
        '/src/assets/images/product_rosegold_brush_1792058412656.jpg',
        '/src/assets/images/hero_lifestyle_store_1792058412869.jpg'
      ],
      isFeatured: true,
      isBestSeller: true,
      isTrending: true,
      isNewArrival: false,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-2',
      name: 'Ergonomic Natural Wood Grain Cushion Paddle Brush',
      sku: 'AURA-BR-WD02',
      description: 'Handcrafted natural wood grain finish with flexible air-cushioned rubber pad and smooth anti-static ball-tipped pins. Gently detangles wet and dry hair while massaging scalp circulation.',
      shortDescription: 'Air-cushioned wooden paddle brush for effortless detangling',
      categoryId: 'cat-hair',
      price: 1750,
      salePrice: 1450,
      stock: 35,
      images: [
        '/src/assets/images/product_wood_paddle_brush_1792058413065.jpg'
      ],
      isFeatured: true,
      isBestSeller: true,
      isTrending: false,
      isNewArrival: true,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-3',
      name: 'Chameleon Aurora Iridescent Paddle Brush',
      sku: 'AURA-BR-IR03',
      description: 'Vibrant metallic chameleon chrome finish with violet-to-gold chromatic shifts. Soft flexible pink bristles glide through dense or curly hair without pulling or breakage.',
      shortDescription: 'Vibrant iridescent chrome paddle brush',
      categoryId: 'cat-hair',
      price: 1390,
      salePrice: 1090,
      stock: 58,
      images: [
        '/src/assets/images/product_rainbow_hairbrush_1792058414278.jpg'
      ],
      isFeatured: true,
      isBestSeller: false,
      isTrending: true,
      isNewArrival: true,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-4',
      name: 'Aesthetic Multi-Tier Cosmetic Vanity Organizer',
      sku: 'AURA-ORG-MK04',
      description: 'Heavy-duty crystal-clear acrylic vanity storage box with 6 brush compartments, pull-out jewelry drawers, and top lipstick tiers. Keeps dressing tables clutter-free and pristine.',
      shortDescription: 'Multi-compartment acrylic makeup caddy with drawers',
      categoryId: 'cat-organizers',
      price: 2950,
      salePrice: 2490,
      stock: 22,
      images: [
        '/src/assets/images/product_makeup_organizer_1792058414597.jpg'
      ],
      isFeatured: true,
      isBestSeller: true,
      isTrending: true,
      isNewArrival: false,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-5',
      name: 'Matte Black & Rose Gold Neck Oval Cushion Brush',
      sku: 'AURA-BR-BL05',
      description: 'Sleek matte rubberized black chassis with polished rose gold accent collar. Perfect compact daily brush for purse, gym bag, and smooth mid-day touch-ups.',
      shortDescription: 'Velvet-touch black & rose gold compact cushion brush',
      categoryId: 'cat-hair',
      price: 1250,
      salePrice: 990,
      stock: 65,
      images: [
        '/src/assets/images/product_rosegold_brush_1792058412656.jpg'
      ],
      isFeatured: false,
      isBestSeller: true,
      isTrending: false,
      isNewArrival: false,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-6',
      name: 'Aurora Metallic Spiral Blowout Barrel Brush',
      sku: 'AURA-BR-SP06',
      description: 'Vibrant rainbow chrome thermal barrel with staggered spiral bristles for maximum grip and tension when styling curls, waves, or root volume.',
      shortDescription: 'Rainbow metallic round brush for bouncy curls and volume',
      categoryId: 'cat-hair',
      price: 1450,
      salePrice: 1190,
      stock: 40,
      images: [
        '/src/assets/images/product_rainbow_hairbrush_1792058414278.jpg'
      ],
      isFeatured: false,
      isBestSeller: false,
      isTrending: true,
      isNewArrival: true,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-7',
      name: 'French Minimalist Amber & Gold Hair Claw Clips (4-Pack)',
      sku: 'AURA-ACC-CL07',
      description: 'Premium cellulose acetate non-slip claw clips with strong alloy spring mechanism. Holds thick, fine, or textured hair securely in half-up styles or chic French twists.',
      shortDescription: 'Set of 4 matte & tortoise shell strong-hold hair clamps',
      categoryId: 'cat-beauty',
      price: 890,
      salePrice: 690,
      stock: 85,
      images: [
        '/src/assets/images/hero_lifestyle_store_1792058412869.jpg'
      ],
      isFeatured: true,
      isBestSeller: true,
      isTrending: true,
      isNewArrival: false,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod-8',
      name: 'Modular Expandable Household Storage Organizers (6-Pack)',
      sku: 'AURA-HH-OR08',
      description: 'BPA-free durable modular organizing trays with non-skid rubber feet. Customizable layout for bathroom vanity, kitchen utensil drawers, or desk stationery.',
      shortDescription: 'Clear modular storage bins with anti-slip silicone feet',
      categoryId: 'cat-household',
      price: 1990,
      salePrice: 1650,
      stock: 28,
      images: [
        '/src/assets/images/product_makeup_organizer_1792058414597.jpg'
      ],
      isFeatured: false,
      isBestSeller: false,
      isTrending: false,
      isNewArrival: true,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  orders: [
    {
      id: 'ord-seed-1',
      orderNumber: 'ORD-8821',
      customer: {
        fullName: 'Fatima Tariq',
        phone: '03001234567',
        address: 'House 42-B, Sector Z, Phase 3 DHA',
        city: 'Lahore',
        area: 'DHA',
        notes: 'Please call before delivery'
      },
      items: [
        {
          productId: 'prod-1',
          name: 'Rose Gold Pro Thermal Styling Brush',
          price: 1290,
          quantity: 1,
          image: '/src/assets/images/product_rosegold_brush_1792058412656.jpg',
          sku: 'AURA-BR-RG01'
        },
        {
          productId: 'prod-7',
          name: 'French Minimalist Amber & Gold Hair Claw Clips (4-Pack)',
          price: 690,
          quantity: 2,
          image: '/src/assets/images/hero_lifestyle_store_1792058412869.jpg',
          sku: 'AURA-ACC-CL07'
        }
      ],
      subtotal: 2670,
      discount: 267,
      shippingFee: 200,
      total: 2603,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      fulfillmentStatus: 'processing',
      statusHistory: [
        { status: 'placed', timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), note: 'Order placed via Guest Checkout' },
        { status: 'confirmed', timestamp: new Date(Date.now() - 86400000 * 1.8).toISOString(), note: 'Confirmed with customer on WhatsApp' },
        { status: 'processing', timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), note: 'Sent to packing department' }
      ],
      trackingNumber: 'TCS-89320147',
      courierName: 'TCS Express',
      internalNotes: 'Customer requested evening delivery after 4pm.',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: 'ord-seed-2',
      orderNumber: 'ORD-9104',
      customer: {
        fullName: 'Zainab Bilal',
        phone: '03219876543',
        address: 'Apartment 502, Creek Vistas, Clifton',
        city: 'Karachi',
        area: 'Clifton'
      },
      items: [
        {
          productId: 'prod-4',
          name: 'Aesthetic Multi-Tier Cosmetic Vanity Organizer',
          price: 2490,
          quantity: 1,
          image: '/src/assets/images/product_makeup_organizer_1792058414597.jpg',
          sku: 'AURA-ORG-MK04'
        },
        {
          productId: 'prod-2',
          name: 'Ergonomic Natural Wood Grain Cushion Paddle Brush',
          price: 1450,
          quantity: 1,
          image: '/src/assets/images/product_wood_paddle_brush_1792058413065.jpg',
          sku: 'AURA-BR-WD02'
        }
      ],
      subtotal: 3940,
      discount: 500,
      shippingFee: 0,
      total: 3440,
      paymentMethod: 'COD',
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      statusHistory: [
        { status: 'placed', timestamp: new Date(Date.now() - 86400000 * 5).toISOString() },
        { status: 'confirmed', timestamp: new Date(Date.now() - 86400000 * 4.8).toISOString() },
        { status: 'shipped', timestamp: new Date(Date.now() - 86400000 * 3).toISOString() },
        { status: 'delivered', timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), note: 'Cash collected Rs. 3,440' }
      ],
      trackingNumber: 'LEO-4491028',
      courierName: 'Leopard Courier',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString()
    }
  ],
  inventoryMovements: [
    {
      id: 'inv-1',
      productId: 'prod-1',
      productName: 'Rose Gold Pro Thermal Styling Brush',
      type: 'order_deduction',
      quantityChange: -1,
      previousStock: 46,
      newStock: 45,
      reason: 'Order #ORD-8821 placed',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      performedBy: 'System (Checkout)'
    }
  ],
  auditLogs: [
    {
      id: 'aud-1',
      action: 'System Initialized',
      entityType: 'settings',
      entityId: 'aura-store',
      details: 'Store catalog and settings loaded successfully',
      performedBy: 'admin',
      timestamp: new Date().toISOString()
    }
  ]
};

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure all required collections exist
        return {
          ...INITIAL_DATA,
          ...parsed,
          adminAuth: parsed.adminAuth || INITIAL_DATA.adminAuth,
          settings: { ...INITIAL_DATA.settings, ...(parsed.settings || {}) },
          products: parsed.products || INITIAL_DATA.products,
          categories: parsed.categories || INITIAL_DATA.categories,
          orders: parsed.orders || INITIAL_DATA.orders,
          coupons: parsed.coupons || INITIAL_DATA.coupons,
          banners: parsed.banners || INITIAL_DATA.banners,
          inventoryMovements: parsed.inventoryMovements || INITIAL_DATA.inventoryMovements,
          auditLogs: parsed.auditLogs || INITIAL_DATA.auditLogs
        };
      }
    } catch (err) {
      console.error('Error loading database file, initializing defaults:', err);
    }
    this.save(INITIAL_DATA);
    return INITIAL_DATA;
  }

  private save(dataToSave: DatabaseSchema = this.data) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Error saving database to file:', err);
    }
  }

  // --- Auth ---
  verifyAdmin(username: string, passwordAttempt: string): boolean {
    if (username !== this.data.adminAuth.username) return false;
    const hash = hashPassword(passwordAttempt);
    return hash === this.data.adminAuth.passwordHash;
  }

  createSessionToken(username: string): string {
    const payload = `${username}:${Date.now()}:${this.data.adminAuth.tokenSecret}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  // --- Products ---
  getProducts(): Product[] {
    return this.data.products;
  }

  getProductById(id: string): Product | undefined {
    return this.data.products.find(p => p.id === id);
  }

  saveProduct(productData: Partial<Product> & { name: string; price: number; categoryId: string }): Product {
    const now = new Date().toISOString();
    const cleanSku = (productData.sku || '').trim();

    // Check SKU uniqueness (exclude the product being updated)
    if (cleanSku) {
      const existingSku = this.data.products.find(p => 
        p.sku.toLowerCase() === cleanSku.toLowerCase() && p.id !== productData.id
      );
      if (existingSku) {
        throw new Error(`SKU "${cleanSku}" is already in use by product "${existingSku.name}". Each SKU must be unique.`);
      }
    }

    // Validate sale price
    const numPrice = Number(productData.price) || 0;
    const numSalePrice = productData.salePrice ? Number(productData.salePrice) : undefined;
    if (numSalePrice !== undefined && numSalePrice >= numPrice) {
      throw new Error(`Sale price (Rs. ${numSalePrice}) must be less than regular price (Rs. ${numPrice}).`);
    }

    // Prepare image arrays
    const images = Array.isArray(productData.images) && productData.images.length > 0
      ? productData.images
      : ['/src/assets/images/product_rosegold_brush_1792058412656.jpg'];

    if (productData.id) {
      const idx = this.data.products.findIndex(p => p.id === productData.id);
      if (idx !== -1) {
        const oldProduct = this.data.products[idx];
        const stockDiff = (productData.stock !== undefined ? Number(productData.stock) : oldProduct.stock) - oldProduct.stock;
        
        const updated: Product = {
          ...oldProduct,
          ...productData,
          sku: cleanSku || oldProduct.sku,
          price: numPrice,
          salePrice: numSalePrice,
          stock: productData.stock !== undefined ? Math.max(0, Number(productData.stock)) : oldProduct.stock,
          images,
          imageMetadata: productData.imageMetadata || oldProduct.imageMetadata,
          updatedAt: now
        };
        this.data.products[idx] = updated;

        if (stockDiff !== 0) {
          this.logInventoryMovement({
            productId: updated.id,
            productName: updated.name,
            type: 'manual_adjustment',
            quantityChange: stockDiff,
            previousStock: oldProduct.stock,
            newStock: updated.stock,
            reason: 'Admin updated product stock',
            performedBy: 'admin'
          });
        }

        this.logAudit({
          action: 'Product Updated',
          entityType: 'product',
          entityId: updated.id,
          details: `Updated "${updated.name}" (Price: Rs. ${updated.price}, Stock: ${updated.stock})`,
          performedBy: 'admin'
        });

        this.save();
        return updated;
      }
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: productData.name.trim(),
      sku: cleanSku || `ZAM-${Date.now().toString(36).toUpperCase()}`,
      description: productData.description || '',
      shortDescription: productData.shortDescription || '',
      categoryId: productData.categoryId,
      price: numPrice,
      salePrice: numSalePrice,
      stock: Math.max(0, Number(productData.stock) || 0),
      images,
      imageMetadata: productData.imageMetadata || [],
      isFeatured: !!productData.isFeatured,
      isBestSeller: !!productData.isBestSeller,
      isTrending: !!productData.isTrending,
      isNewArrival: productData.isNewArrival ?? true,
      isActive: productData.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };

    this.data.products.unshift(newProduct);

    this.logInventoryMovement({
      productId: newProduct.id,
      productName: newProduct.name,
      type: 'restock',
      quantityChange: newProduct.stock,
      previousStock: 0,
      newStock: newProduct.stock,
      reason: 'Initial product stock creation',
      performedBy: 'admin'
    });

    this.logAudit({
      action: 'Product Created',
      entityType: 'product',
      entityId: newProduct.id,
      details: `Created "${newProduct.name}" (SKU: ${newProduct.sku})`,
      performedBy: 'admin'
    });

    this.save();
    return newProduct;
  }

  isProductInOrders(productId: string): { inOrders: boolean; orderCount: number; orderNumbers: string[] } {
    const matchedOrders = this.data.orders.filter(o => 
      o.items && o.items.some(item => item.productId === productId)
    );
    return {
      inOrders: matchedOrders.length > 0,
      orderCount: matchedOrders.length,
      orderNumbers: matchedOrders.map(o => o.orderNumber)
    };
  }

  archiveProduct(id: string): { success: boolean; product?: Product; error?: string } {
    const product = this.getProductById(id);
    if (!product) return { success: false, error: 'Product not found' };
    product.isActive = false;
    product.updatedAt = new Date().toISOString();
    this.logAudit({
      action: 'Product Archived',
      entityType: 'product',
      entityId: id,
      details: `Archived/Deactivated "${product.name}" to preserve order history`,
      performedBy: 'admin'
    });
    this.save();
    return { success: true, product };
  }

  getProductImagesForCleanup(productId: string): string[] {
    const product = this.getProductById(productId);
    if (!product) return [];
    const publicIds: string[] = [];
    if (product.imageMetadata) {
      for (const m of product.imageMetadata) {
        if (m.publicId) publicIds.push(m.publicId);
      }
    }
    // Check if any other product also references these publicIds
    const otherProducts = this.data.products.filter(p => p.id !== productId);
    return publicIds.filter(pid => {
      return !otherProducts.some(op => op.imageMetadata?.some(m => m.publicId === pid));
    });
  }

  deleteProduct(id: string, force: boolean = false): {
    success: boolean;
    error?: string;
    requiresArchive?: boolean;
    orderCount?: number;
    orderNumbers?: string[];
    cleanupPublicIds?: string[];
  } {
    const idx = this.data.products.findIndex(p => p.id === id);
    if (idx === -1) return { success: false, error: 'Product not found' };

    const product = this.data.products[idx];
    const orderCheck = this.isProductInOrders(id);

    // If product is in orders and force is not specified, require archival instead
    if (orderCheck.inOrders && !force) {
      return {
        success: false,
        requiresArchive: true,
        orderCount: orderCheck.orderCount,
        orderNumbers: orderCheck.orderNumbers,
        error: `Product appears in ${orderCheck.orderCount} historical order(s). It should be archived rather than permanently deleted.`
      };
    }

    const cleanupPublicIds = this.getProductImagesForCleanup(id);
    this.data.products.splice(idx, 1);

    this.logAudit({
      action: force && orderCheck.inOrders ? 'Product Force-Deleted' : 'Product Deleted',
      entityType: 'product',
      entityId: id,
      details: `Permanently removed product "${product.name}" (SKU: ${product.sku})`,
      performedBy: 'admin'
    });
    this.save();

    return {
      success: true,
      cleanupPublicIds
    };
  }

  bulkUpdateProducts(ids: string[], updates: { isActive?: boolean; categoryId?: string }): { updatedCount: number } {
    let count = 0;
    const now = new Date().toISOString();
    for (const p of this.data.products) {
      if (ids.includes(p.id)) {
        if (updates.isActive !== undefined) p.isActive = updates.isActive;
        if (updates.categoryId !== undefined) p.categoryId = updates.categoryId;
        p.updatedAt = now;
        count++;
      }
    }
    if (count > 0) {
      this.logAudit({
        action: 'Bulk Products Update',
        entityType: 'product',
        entityId: 'multiple',
        details: `Updated ${count} products (${JSON.stringify(updates)})`,
        performedBy: 'admin'
      });
      this.save();
    }
    return { updatedCount: count };
  }

  updateAdminPassword(currentPass: string, newPass: string): { success: boolean; error?: string } {
    if (!this.verifyAdmin(this.data.adminAuth.username, currentPass)) {
      return { success: false, error: 'Current password is incorrect' };
    }
    if (!newPass || newPass.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long' };
    }
    this.data.adminAuth.passwordHash = hashPassword(newPass);
    this.data.adminAuth.tokenSecret = crypto.randomBytes(32).toString('hex');
    this.logAudit({
      action: 'Admin Password Changed',
      entityType: 'settings',
      entityId: 'adminAuth',
      details: 'Administrator password was changed securely',
      performedBy: 'admin'
    });
    this.save();
    return { success: true };
  }

  // --- Categories ---
  getCategories(): Category[] {
    return this.data.categories.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  saveCategory(catData: Partial<Category> & { name: string }): Category {
    if (catData.id) {
      const idx = this.data.categories.findIndex(c => c.id === catData.id);
      if (idx !== -1) {
        this.data.categories[idx] = {
          ...this.data.categories[idx],
          ...catData
        };
        this.save();
        return this.data.categories[idx];
      }
    }
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: catData.name,
      slug: catData.slug || catData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: catData.description || '',
      image: catData.image,
      displayOrder: catData.displayOrder ?? (this.data.categories.length + 1),
      isActive: catData.isActive ?? true
    };
    this.data.categories.push(newCat);
    this.save();
    return newCat;
  }

  deleteCategory(id: string): { success: boolean; message?: string } {
    // Check if products belong to this category
    const count = this.data.products.filter(p => p.categoryId === id).length;
    if (count > 0) {
      return { success: false, message: `Cannot delete: ${count} products still belong to this category. Reassign them first.` };
    }
    const idx = this.data.categories.findIndex(c => c.id === id);
    if (idx === -1) return { success: false, message: 'Category not found' };
    this.data.categories.splice(idx, 1);
    this.save();
    return { success: true };
  }

  // --- Orders ---
  getOrders(): Order[] {
    return this.data.orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getOrderById(id: string): Order | undefined {
    return this.data.orders.find(o => o.id === id || o.orderNumber === id);
  }

  trackOrder(orderNumber: string, phone: string): Order | null {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').slice(-10);
    const order = this.data.orders.find(o => {
      if (o.orderNumber.toUpperCase() !== orderNumber.trim().toUpperCase()) return false;
      const orderCleanPhone = o.customer.phone.replace(/[\s\-\(\)]/g, '').slice(-10);
      return orderCleanPhone === cleanPhone;
    });
    return order || null;
  }

  createGuestOrder(orderInput: {
    customer: Order['customer'];
    items: OrderItem[];
    subtotal: number;
    discount: number;
    shippingFee: number;
    total: number;
    couponCode?: string;
  }): { success: boolean; order?: Order; error?: string } {
    // Atomic stock check and deduction
    for (const item of orderInput.items) {
      const prod = this.data.products.find(p => p.id === item.productId);
      if (!prod) {
        return { success: false, error: `Product "${item.name}" was not found.` };
      }
      if (prod.stock < item.quantity) {
        return { success: false, error: `Insufficient stock for "${prod.name}". Only ${prod.stock} available.` };
      }
    }

    // Deduct stock safely
    const now = new Date().toISOString();
    for (const item of orderInput.items) {
      const prod = this.data.products.find(p => p.id === item.productId)!;
      const prevStock = prod.stock;
      prod.stock -= item.quantity;
      prod.updatedAt = now;

      this.logInventoryMovement({
        productId: prod.id,
        productName: prod.name,
        type: 'order_deduction',
        quantityChange: -item.quantity,
        previousStock: prevStock,
        newStock: prod.stock,
        reason: 'Guest Checkout order placed',
        performedBy: 'System'
      });
    }

    // Increment coupon usage if used
    if (orderInput.couponCode) {
      const coupon = this.data.coupons.find(c => c.code.toUpperCase() === orderInput.couponCode?.toUpperCase());
      if (coupon) {
        coupon.timesUsed += 1;
      }
    }

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderNumber,
      customer: orderInput.customer,
      items: orderInput.items,
      subtotal: orderInput.subtotal,
      discount: orderInput.discount,
      shippingFee: orderInput.shippingFee,
      total: orderInput.total,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      fulfillmentStatus: 'placed',
      statusHistory: [
        {
          status: 'placed',
          timestamp: now,
          note: 'Order successfully placed via Guest Checkout'
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    this.data.orders.unshift(newOrder);

    this.logAudit({
      action: 'Order Placed',
      entityType: 'order',
      entityId: newOrder.id,
      details: `New order #${newOrder.orderNumber} for Rs. ${newOrder.total} by ${newOrder.customer.fullName} (${newOrder.customer.phone})`,
      performedBy: 'guest'
    });

    this.save();
    return { success: true, order: newOrder };
  }

  updateOrderStatus(orderId: string, newStatus: OrderStatus, trackingNumber?: string, courierName?: string, cancelReason?: string, internalNotes?: string): { success: boolean; order?: Order; error?: string } {
    const order = this.data.orders.find(o => o.id === orderId || o.orderNumber === orderId);
    if (!order) return { success: false, error: 'Order not found' };

    const oldStatus = order.fulfillmentStatus;
    const now = new Date().toISOString();

    // Safe stock restoration if cancelled and wasn't already cancelled
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      for (const item of order.items) {
        const prod = this.data.products.find(p => p.id === item.productId);
        if (prod) {
          const prev = prod.stock;
          prod.stock += item.quantity;
          prod.updatedAt = now;

          this.logInventoryMovement({
            productId: prod.id,
            productName: prod.name,
            type: 'order_cancellation_restock',
            quantityChange: item.quantity,
            previousStock: prev,
            newStock: prod.stock,
            reason: `Order #${order.orderNumber} cancelled (${cancelReason || 'Customer requested'})`,
            performedBy: 'admin'
          });
        }
      }
      order.paymentStatus = 'cancelled';
      order.cancelReason = cancelReason || 'Order cancelled by administrator';
    } else if (newStatus === 'delivered') {
      order.paymentStatus = 'paid';
    }

    order.fulfillmentStatus = newStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (courierName) order.courierName = courierName;
    if (internalNotes !== undefined) order.internalNotes = internalNotes;
    order.updatedAt = now;

    order.statusHistory.push({
      status: newStatus,
      timestamp: now,
      note: trackingNumber ? `Tracking: ${trackingNumber} (${courierName || 'Courier'})` : cancelReason || undefined
    });

    this.logAudit({
      action: 'Order Status Changed',
      entityType: 'order',
      entityId: order.id,
      details: `Order #${order.orderNumber} changed from ${oldStatus} to ${newStatus}`,
      performedBy: 'admin'
    });

    this.save();
    return { success: true, order };
  }

  // --- Coupons ---
  getCoupons(): Coupon[] {
    return this.data.coupons;
  }

  saveCoupon(couponData: Partial<Coupon> & { code: string; discountValue: number }): Coupon {
    const code = couponData.code.trim().toUpperCase();
    if (couponData.id) {
      const idx = this.data.coupons.findIndex(c => c.id === couponData.id);
      if (idx !== -1) {
        this.data.coupons[idx] = {
          ...this.data.coupons[idx],
          ...couponData,
          code
        };
        this.save();
        return this.data.coupons[idx];
      }
    }
    const newCoupon: Coupon = {
      id: `cpn-${Date.now()}`,
      code,
      discountType: couponData.discountType || 'percentage',
      discountValue: Number(couponData.discountValue),
      minSpend: couponData.minSpend ? Number(couponData.minSpend) : undefined,
      maxDiscount: couponData.maxDiscount ? Number(couponData.maxDiscount) : undefined,
      usageLimit: couponData.usageLimit ? Number(couponData.usageLimit) : undefined,
      timesUsed: 0,
      expiresAt: couponData.expiresAt,
      isActive: couponData.isActive ?? true
    };
    this.data.coupons.push(newCoupon);
    this.save();
    return newCoupon;
  }

  deleteCoupon(id: string): boolean {
    const idx = this.data.coupons.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this.data.coupons.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Banners ---
  getBanners(): Banner[] {
    return this.data.banners.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  saveBanner(bannerData: Partial<Banner> & { title: string; imageUrl: string }): Banner {
    if (bannerData.id) {
      const idx = this.data.banners.findIndex(b => b.id === bannerData.id);
      if (idx !== -1) {
        this.data.banners[idx] = { ...this.data.banners[idx], ...bannerData };
        this.save();
        return this.data.banners[idx];
      }
    }
    const newBanner: Banner = {
      id: `ban-${Date.now()}`,
      title: bannerData.title,
      subtitle: bannerData.subtitle || '',
      badgeText: bannerData.badgeText,
      imageUrl: bannerData.imageUrl,
      linkUrl: bannerData.linkUrl || '#collection',
      ctaText: bannerData.ctaText || 'Shop Now',
      isActive: bannerData.isActive ?? true,
      displayOrder: bannerData.displayOrder ?? (this.data.banners.length + 1)
    };
    this.data.banners.push(newBanner);
    this.save();
    return newBanner;
  }

  deleteBanner(id: string): boolean {
    const idx = this.data.banners.findIndex(b => b.id === id);
    if (idx === -1) return false;
    this.data.banners.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Settings ---
  getSettings(): StoreSettings {
    return this.data.settings;
  }

  updateSettings(settings: Partial<StoreSettings>): StoreSettings {
    this.data.settings = { ...this.data.settings, ...settings };
    this.logAudit({
      action: 'Store Settings Updated',
      entityType: 'settings',
      entityId: 'aura-store',
      details: 'Updated store name, shipping, or policies',
      performedBy: 'admin'
    });
    this.save();
    return this.data.settings;
  }

  // --- Reports & Analytics ---
  getReports() {
    const orders = this.data.orders;
    const completed = orders.filter(o => o.fulfillmentStatus === 'delivered');
    const cancelled = orders.filter(o => o.fulfillmentStatus === 'cancelled');
    const active = orders.filter(o => o.fulfillmentStatus !== 'cancelled');

    const grossSales = active.reduce((sum, o) => sum + o.total, 0);
    const completedSales = completed.reduce((sum, o) => sum + o.total, 0);

    const products = this.data.products;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10);
    const outOfStock = products.filter(p => p.stock <= 0);

    // Product sales calculation
    const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const order of active) {
      for (const item of order.items) {
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = { name: item.name, quantity: 0, revenue: 0 };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].revenue += item.price * item.quantity;
      }
    }

    const topSellingProducts = Object.entries(productSalesMap)
      .map(([id, val]) => ({ id, ...val }))
      .sort((a, b) => b.quantity - a.quantity);

    return {
      totalOrders: orders.length,
      placedOrders: orders.filter(o => o.fulfillmentStatus === 'placed').length,
      confirmedOrders: orders.filter(o => o.fulfillmentStatus === 'confirmed').length,
      processingOrders: orders.filter(o => o.fulfillmentStatus === 'processing').length,
      shippedOrders: orders.filter(o => o.fulfillmentStatus === 'shipped').length,
      deliveredOrders: completed.length,
      cancelledOrders: cancelled.length,
      grossSales,
      completedSales,
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock,
      topSellingProducts
    };
  }

  getAuditLogs(): AuditLog[] {
    return this.data.auditLogs.slice(0, 100);
  }

  getInventoryMovements(): InventoryMovement[] {
    return this.data.inventoryMovements.slice(0, 100);
  }

  private logInventoryMovement(movement: Omit<InventoryMovement, 'id' | 'timestamp'>) {
    this.data.inventoryMovements.unshift({
      id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...movement
    });
  }

  private logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    this.data.auditLogs.unshift({
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...log
    });
  }
}

export const db = new Database();
