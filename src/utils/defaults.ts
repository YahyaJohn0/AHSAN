import type {
  Category,
  StoreSettings,
  Banner,
  Coupon
} from '../types/store.ts';

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
