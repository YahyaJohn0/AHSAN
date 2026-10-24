import type { Product } from '../types/store.ts';

/**
 * Normalizes a raw product record from the backend or database
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
      categoryId: 'cat-beauty',
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
      else if (img?.secureUrl && typeof img.secureUrl === 'string') images.push(img.secureUrl.trim());
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
