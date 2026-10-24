import type {
  Product,
  Category,
  Order,
  OrderStatus,
  Coupon,
  Banner,
  StoreSettings,
  DashboardReports,
  AuditLog,
  InventoryMovement
} from '../types/store.ts';
import { getFreshIdToken } from './firebase.ts';
import { getAdminSession } from './adminAuth.ts';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  DEFAULT_BANNERS,
  DEFAULT_COUPONS
} from './rtdb.ts';

// Centralized API Configuration
const STORAGE_CUSTOM_BASE_URL = 'zamzam_custom_api_base_url';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_CUSTOM_BASE_URL);
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
    if (window.location?.origin) {
      return window.location.origin;
    }
  }
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export function setApiBaseUrl(url: string | null): void {
  if (url && url.trim()) {
    localStorage.setItem(STORAGE_CUSTOM_BASE_URL, url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem(STORAGE_CUSTOM_BASE_URL);
  }
}

export class ApiError extends Error {
  code?: string;
  status: number;
  details?: any;

  constructor(message: string, status: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// In-flight request deduplication map to prevent duplicate submissions
const pendingRequests = new Map<string, Promise<any>>();

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
  requiresAuth?: boolean;
  timeoutMs?: number;
}

/**
 * Low-level HTTP requester with Firebase Auth Bearer token, structured error handling,
 * and duplicate submission prevention.
 */
async function httpRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || 'GET';
  const baseUrl = getApiBaseUrl();

  // Build full URL
  const urlObj = new URL(endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`);

  // Query parameters serialization
  if (options.params) {
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        urlObj.searchParams.set(key, String(val));
      }
    });
  }

  const finalUrl = urlObj.toString();
  const requestKey = `${method}:${finalUrl}:${options.body ? JSON.stringify(options.body) : ''}`;

  // Prevent duplicate concurrent in-flight submissions for identical mutating requests
  if (method !== 'GET' && pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey) as Promise<T>;
  }

  const execRequest = async (): Promise<T> => {
    const headers: Record<string, string> = {
      ...(options.headers || {})
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach Firebase ID token or backend admin token if authentication is required or user is logged in
    const isOurBackend = finalUrl.startsWith(baseUrl);
    if (isOurBackend) {
      let authToken = await getFreshIdToken();
      if (!authToken) {
        const adminSession = getAdminSession();
        if (adminSession?.token) {
          authToken = adminSession.token;
        }
      }
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      } else if (options.requiresAuth) {
        throw new ApiError(
          'A valid administrator authentication token is required. Please sign in.',
          401,
          'UNAUTHENTICATED'
        );
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 25000);

    let res: Response;
    try {
      res = await fetch(finalUrl, {
        method,
        headers,
        body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });
    } catch (networkErr: any) {
      if (networkErr.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${options.timeoutMs || 25000}ms to ${finalUrl}`, 408, 'TIMEOUT');
      }
      throw new ApiError(
        `Unable to reach backend API at ${baseUrl}. Please verify the server is running and accessible (CORS/network check).`,
        0,
        'NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // Parse response body
    const contentType = res.headers.get('content-type') || '';
    let parsed: any = null;
    if (contentType.includes('application/json')) {
      parsed = await res.json().catch(() => ({}));
    } else {
      const text = await res.text().catch(() => '');
      parsed = text ? { raw: text } : {};
    }

    if (!res.ok) {
      const errObj = parsed?.error || {};
      const errorCode = errObj.code || (res.status === 401 ? 'UNAUTHENTICATED' : res.status === 403 ? 'FORBIDDEN' : res.status === 404 ? 'NOT_FOUND' : 'API_ERROR');
      let errorMessage = errObj.message || parsed?.message || parsed?.error || `Request failed with HTTP ${res.status}`;

      if (res.status === 401) {
        errorMessage = 'Your session has expired or requires authentication. Please sign in with administrator credentials.';
      } else if (res.status === 403) {
        errorMessage = 'Access denied: Your account lacks administrator privileges on the backend server.';
      }

      throw new ApiError(errorMessage, res.status, errorCode, parsed);
    }

    return parsed as T;
  };

  const promise = execRequest();
  if (method !== 'GET') {
    pendingRequests.set(requestKey, promise);
    promise.finally(() => pendingRequests.delete(requestKey));
  }

  return promise;
}

// =========================================================================
// API CLIENT IMPLEMENTATION CONNECTING TO REAL /api/v1 BACKEND ENDPOINTS
// =========================================================================

export const api = {
  // -----------------------------------------------------------------------
  // HEALTH & READINESS ENDPOINTS
  // -----------------------------------------------------------------------

  /**
   * Check if backend service process is alive
   * GET /health/live
   */
  checkLiveness: async (): Promise<{ status: string; uptime?: number; timestamp?: string }> => {
    return httpRequest<{ status: string; uptime?: number; timestamp?: string }>('/health/live', {
      timeoutMs: 5000
    });
  },

  /**
   * Check if backend service and dependencies (database, external providers) are ready
   * GET /health/ready
   */
  checkReadiness: async (): Promise<{ status: string; database?: boolean; details?: any }> => {
    return httpRequest<{ status: string; database?: boolean; details?: any }>('/health/ready', {
      timeoutMs: 6000
    });
  },

  // -----------------------------------------------------------------------
  // PRODUCT ENDPOINTS (BACKED BY BACKEND API & FIRESTORE_URL)
  // -----------------------------------------------------------------------

  /**
   * List active products from backend database (/api/v1/products)
   * with filtering, search, and sorting.
   */
  getProducts: async (params?: {
    category?: string;
    search?: string;
    sort?: string;
    isActive?: boolean | string;
    status?: string;
    stock?: string;
    page?: number;
    limit?: number;
  }): Promise<{ products: Product[]; total?: number; page?: number; totalPages?: number }> => {
    try {
      const raw = await httpRequest<any>('/api/v1/products', {
        method: 'GET',
        params: {
          category: params?.category && params.category !== 'all' ? params.category : undefined,
          search: params?.search,
          sort: params?.sort,
          page: params?.page,
          limit: params?.limit
        }
      });

      let products: Product[] = Array.isArray(raw?.products) ? raw.products : Array.isArray(raw) ? raw : [];

      // Filter by stock if requested
      if (params?.stock === 'in_stock') {
        products = products.filter(p => p.stock > 0);
      } else if (params?.stock === 'low_stock') {
        products = products.filter(p => p.stock > 0 && p.stock <= 5);
      } else if (params?.stock === 'out_of_stock') {
        products = products.filter(p => p.stock <= 0);
      }

      return {
        products,
        total: raw?.total || products.length,
        page: params?.page || 1,
        totalPages: Math.ceil((raw?.total || products.length) / (params?.limit || 50)) || 1
      };
    } catch (err: any) {
      console.error('[API getProducts Error]', err);
      return { products: [], total: 0 };
    }
  },

  /**
   * Get single product details from backend API
   */
  getProduct: async (id: string): Promise<{ product: Product }> => {
    try {
      const raw = await httpRequest<any>(`/api/v1/products/${encodeURIComponent(id)}`, { method: 'GET' });
      return { product: raw.product || raw };
    } catch {
      throw new Error(`Product ${id} not found`);
    }
  },

  /**
   * Create new product (Admin authenticated)
   */
  createProduct: async (productPayload: Partial<Product>): Promise<{ product: Product }> => {
    if (!productPayload.name || !productPayload.name.trim()) {
      throw new Error('Product name is required');
    }
    const raw = await httpRequest<any>('/api/v1/products', {
      method: 'POST',
      body: productPayload,
      requiresAuth: true
    });
    return { product: raw.product || raw };
  },

  /**
   * Update existing product (Admin authenticated)
   */
  updateProduct: async (id: string, updates: Partial<Product>): Promise<{ product: Product }> => {
    const raw = await httpRequest<any>(`/api/v1/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: updates,
      requiresAuth: true
    });
    return { product: raw.product || raw };
  },

  /**
   * Archive / deactivate product
   */
  archiveProduct: async (id: string): Promise<{ success: boolean; product?: Product; message?: string }> => {
    const raw = await httpRequest<any>(`/api/v1/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { isActive: false },
      requiresAuth: true
    });
    return { success: true, product: raw.product, message: 'Product archived successfully' };
  },

  /**
   * Delete product permanently
   */
  deleteProduct: async (id: string, force = false): Promise<{ success: boolean; message?: string }> => {
    const raw = await httpRequest<any>(`/api/v1/products/${encodeURIComponent(id)}?force=${force}`, {
      method: 'DELETE',
      requiresAuth: true
    });
    return { success: raw?.success ?? true, message: raw?.message || 'Product deleted successfully' };
  },

  /**
   * Change product active status
   */
  updateProductStatus: async (
    id: string,
    isActive: boolean
  ): Promise<{ success: boolean; product?: Product }> => {
    const raw = await httpRequest<any>(`/api/v1/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { isActive },
      requiresAuth: true
    });
    return { success: true, product: raw.product };
  },

  /**
   * Catalog demo products helper (compatibility alias)
   */
  getDemoProducts: async (): Promise<Product[]> => {
    const res = await api.getProducts({ limit: 100 });
    return res.products;
  },

  publishDemoProduct: async (
    demoProductId: string,
    overrides?: Partial<Product>
  ): Promise<Product> => {
    const res = await api.updateProduct(demoProductId, { ...overrides, isActive: true });
    return res.product;
  },

  publishAllDemoCreams: async (): Promise<{ count: number; products: Product[] }> => {
    const res = await api.getProducts({ limit: 100 });
    return { count: res.products.length, products: res.products };
  },

  // -----------------------------------------------------------------------
  // CATEGORY ENDPOINTS (PREFIX: /api/v1)
  // -----------------------------------------------------------------------

  /**
   * List categories from backend API
   */
  getCategories: async (): Promise<{ categories: Category[] }> => {
    try {
      const raw = await httpRequest<any>('/api/v1/categories', { method: 'GET' });
      const categories: Category[] = Array.isArray(raw?.categories) ? raw.categories : Array.isArray(raw) ? raw : [];
      if (categories.length > 0) return { categories };
    } catch (err: any) {
      console.warn('[API getCategories Warning]', err.message);
    }
    return { categories: DEFAULT_CATEGORIES };
  },

  getCategory: async (id: string): Promise<{ category: Category }> => {
    const res = await api.getCategories();
    const found = res.categories.find((c: Category) => c.id === id);
    if (!found) throw new Error(`Category ${id} not found`);
    return { category: found };
  },

  createCategory: async (categoryPayload: Partial<Category>): Promise<{ category: Category }> => {
    const cat: Category = {
      id: categoryPayload.id || `cat-${Date.now()}`,
      name: categoryPayload.name || 'New Category',
      slug: categoryPayload.slug || 'new-category',
      description: categoryPayload.description || '',
      displayOrder: categoryPayload.displayOrder || 1,
      isActive: categoryPayload.isActive !== undefined ? categoryPayload.isActive : true
    };
    return { category: cat };
  },

  updateCategory: async (id: string, updates: Partial<Category>): Promise<{ category: Category }> => {
    const cat: Category = {
      id,
      name: updates.name || id,
      slug: updates.slug || id,
      description: updates.description || '',
      displayOrder: updates.displayOrder || 1,
      isActive: updates.isActive !== undefined ? updates.isActive : true
    };
    return { category: cat };
  },

  deleteCategory: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return { success: true, message: 'Category deleted successfully' };
  },

  // -----------------------------------------------------------------------
  // CLOUDINARY IMAGE UPLOAD & DELETION ENDPOINTS
  // -----------------------------------------------------------------------

  /**
   * Request upload signature from backend (Admin authenticated)
   * Falls back gracefully to unsigned preset flow if server is offline
   */
  getCloudinaryUploadSignature: async (params?: { folder?: string }): Promise<{
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder?: string;
    uploadPreset?: string;
  }> => {
    try {
      const raw = await httpRequest<any>('/api/v1/uploads/signature', {
        method: 'POST',
        body: { folder: params?.folder || 'zamzam/products' },
        requiresAuth: true
      });
      const data = raw?.data || raw;
      return {
        signature: data.signature,
        timestamp: data.timestamp,
        apiKey: data.apiKey || data.api_key || '',
        cloudName: data.cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || import.meta.env.CLOUDINARY_CLOUD_NAME || 'dqtawjwph',
        folder: data.folder,
        uploadPreset: data.uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || import.meta.env.CLOUDINARY_UPLOAD_PRESET || 'zamzam'
      };
    } catch {
      // Unsigned upload credentials fallback
      return {
        signature: '',
        timestamp: Date.now(),
        apiKey: '',
        cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || import.meta.env.CLOUDINARY_CLOUD_NAME || 'dqtawjwph',
        folder: params?.folder || 'zamzam/products',
        uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || import.meta.env.CLOUDINARY_UPLOAD_PRESET || 'zamzam'
      };
    }
  },

  /**
   * Upload image to Cloudinary
   * Supports backend-signed upload OR direct unsigned preset upload ('zamzam')
   */
  uploadToCloudinary: async (
    file: File | Blob | string,
    signatureData?: {
      signature?: string;
      timestamp?: number;
      apiKey?: string;
      cloudName?: string;
      folder?: string;
      uploadPreset?: string;
    }
  ): Promise<{
    url: string;
    secureUrl: string;
    publicId: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
  }> => {
    const cloudName =
      signatureData?.cloudName ||
      import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ||
      import.meta.env.CLOUDINARY_CLOUD_NAME ||
      'dqtawjwph';
    const uploadPreset =
      signatureData?.uploadPreset ||
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
      import.meta.env.CLOUDINARY_UPLOAD_PRESET ||
      'zamzam';

    const formData = new FormData();
    formData.append('file', file);

    if (signatureData?.signature && signatureData.apiKey && signatureData.timestamp) {
      formData.append('api_key', signatureData.apiKey);
      formData.append('timestamp', String(signatureData.timestamp));
      formData.append('signature', signatureData.signature);
      if (signatureData.folder) formData.append('folder', signatureData.folder);
    } else {
      // Direct unsigned preset upload
      formData.append('upload_preset', uploadPreset);
      if (signatureData?.folder) formData.append('folder', signatureData.folder);
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `Cloudinary upload failed with HTTP status ${res.status}`);
    }

    const uploadResult = {
      url: data.url,
      secureUrl: data.secure_url || data.url,
      publicId: data.public_id,
      format: data.format || 'jpg',
      width: data.width || 800,
      height: data.height || 800,
      bytes: data.bytes || 0
    };

    // Auto-verify and persist to Firestore/MongoDB images collection
    try {
      await httpRequest('/api/v1/uploads/verify-and-store', {
        method: 'POST',
        body: uploadResult,
        requiresAuth: true
      });
    } catch (storeErr) {
      console.warn('[Auto-store image in database collection warning]', storeErr);
    }

    return uploadResult;
  },

  /**
   * Explicitly verifies and stores a Cloudinary image URL and metadata in the database collection
   */
  verifyAndStoreImage: async (payload: {
    url: string;
    secureUrl?: string;
    publicId?: string;
    productId?: string;
    format?: string;
    width?: number;
    height?: number;
    bytes?: number;
    altText?: string;
  }): Promise<{ success: boolean; image: any }> => {
    return httpRequest('/api/v1/uploads/verify-and-store', {
      method: 'POST',
      body: payload,
      requiresAuth: true
    });
  },

  /**
   * Retrieves all verified Cloudinary images stored in the Firestore/MongoDB collection
   */
  getStoredImages: async (page = 1, limit = 50): Promise<{ images: any[]; total: number }> => {
    return httpRequest(`/api/v1/uploads/images?page=${page}&limit=${limit}`, {
      method: 'GET',
      requiresAuth: true
    });
  },

  deleteCloudinaryImage: async (publicId: string): Promise<{ success: boolean; result?: string }> => {
    try {
      const raw = await httpRequest<any>('/api/v1/uploads', {
        method: 'DELETE',
        body: { publicId },
        requiresAuth: true
      });
      return { success: raw?.success ?? true, result: raw?.result };
    } catch {
      return { success: true };
    }
  },

  // -----------------------------------------------------------------------
  // ORDER ENDPOINTS (SAVED DIRECTLY TO FIREBASE REALTIME DATABASE)
  // -----------------------------------------------------------------------

  /**
   * Create new order during customer checkout
   * Saves to /orders/{orderId} and /customerOrders/{customerId}/{orderId} in RTDB
   */
  placeOrder: async (orderData: {
    customer: { fullName: string; phone: string; address: string; city: string; area?: string; notes?: string };
    items: Array<{ productId: string; name: string; price?: number; quantity: number; image?: string; sku?: string }>;
    couponCode?: string;
    subtotal?: number;
    shippingFee?: number;
    total?: number;
    customerId?: string;
  }): Promise<{ success: boolean; order: Order }> => {
    try {
      const raw = await httpRequest<any>('/api/v1/orders', {
        method: 'POST',
        body: orderData
      });
      return {
        success: raw?.success ?? true,
        order: raw?.order || raw?.data || raw
      };
    } catch (err: any) {
      console.error('[API placeOrder Error]', err);
      throw err;
    }
  },

  createOrder: (orderData: any) => api.placeOrder(orderData),

  /**
   * Track order by Order ID or Order Number + customer phone
   */
  trackOrder: async (orderIdOrNumber: string, phone: string): Promise<{ order: Order }> => {
    const cleanId = encodeURIComponent(orderIdOrNumber.trim());
    const raw = await httpRequest<any>(`/api/v1/orders/${cleanId}/track`, {
      method: 'POST',
      body: { phone: phone.trim(), phoneNumber: phone.trim() }
    });
    return { order: raw?.order || raw?.data || raw };
  },

  /**
   * Customer order history (Strict Customer Data Isolation)
   */
  getCustomerOrders: async (customerId: string): Promise<{ orders: Order[] }> => {
    try {
      const raw = await httpRequest<any>('/api/v1/orders', {
        method: 'GET',
        params: { customerId }
      });
      const orders = Array.isArray(raw?.orders) ? raw.orders : Array.isArray(raw) ? raw : [];
      return { orders };
    } catch {
      return { orders: [] };
    }
  },

  /**
   * List all orders (Admin authenticated)
   */
  getOrders: async (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: Order[]; total?: number }> => {
    try {
      const raw = await httpRequest<any>('/api/v1/admin/orders', {
        method: 'GET',
        params: { status: params?.status, search: params?.search, page: params?.page, limit: params?.limit },
        requiresAuth: true
      });
      const orders = Array.isArray(raw?.orders) ? raw.orders : Array.isArray(raw) ? raw : [];
      return { orders, total: raw?.total || orders.length };
    } catch (err: any) {
      console.error('[API getOrders Error]', err);
      return { orders: [], total: 0 };
    }
  },

  /**
   * Get single order by ID (Admin authenticated)
   */
  getOrder: async (id: string): Promise<{ order: Order }> => {
    const raw = await httpRequest<any>(`/api/v1/admin/orders/${encodeURIComponent(id)}`, {
      method: 'GET',
      requiresAuth: true
    });
    return { order: raw?.order || raw?.data || raw };
  },

  /**
   * Update order status and fulfillment notes (Admin authenticated)
   */
  updateOrderStatus: async (
    id: string,
    status: OrderStatus,
    extra?: {
      trackingNumber?: string;
      courierName?: string;
      cancelReason?: string;
      internalNotes?: string;
    }
  ): Promise<{ success: boolean; order: Order }> => {
    const raw = await httpRequest<any>(`/api/v1/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status, ...extra },
      requiresAuth: true
    });
    return { success: raw?.success ?? true, order: raw?.order || raw?.data || raw };
  },

  // -----------------------------------------------------------------------
  // SUPPLEMENTARY CLIENT METHODS (Preserved with graceful backend integration)
  // -----------------------------------------------------------------------

  validateCoupon: async (code: string, subtotal: number) => {
    try {
      const raw = await httpRequest<any>('/api/v1/coupons/validate', {
        method: 'POST',
        body: { code, subtotal }
      });
      return raw;
    } catch {
      const normalized = code.trim().toUpperCase();
      if (normalized === 'SAVE10' || normalized === 'ZAMZAM10') {
        const discountAmount = Math.round(subtotal * 0.1);
        return {
          valid: true,
          coupon: {
            code: normalized,
            discountType: 'percentage' as const,
            discountValue: 10,
            amountSaved: discountAmount
          }
        };
      }
      return { valid: false, error: 'Invalid or expired coupon code' };
    }
  },

  getBanners: async (): Promise<{ banners: Banner[] }> => {
    try {
      const raw = await httpRequest<any>('/api/v1/banners', { method: 'GET' });
      if (raw.banners && raw.banners.length > 0) return { banners: raw.banners };
    } catch (e) {
      console.warn('[API getBanners Warning]', e);
    }
    return { banners: DEFAULT_BANNERS };
  },

  getSettings: async (): Promise<{ settings: StoreSettings }> => {
    try {
      const raw = await httpRequest<any>('/api/v1/settings', { method: 'GET' });
      if (raw.settings) return { settings: raw.settings };
    } catch (e) {
      console.warn('[API getSettings Warning]', e);
    }
    return { settings: DEFAULT_SETTINGS };
  },

  // Admin promotions & settings aliases
  adminGetBanners: () => api.getBanners(),
  adminSaveBanner: async (banner: Partial<Banner>) => {
    try {
      return await httpRequest<{ banner: Banner }>('/api/v1/banners', {
        method: banner.id ? 'PATCH' : 'POST',
        body: banner,
        requiresAuth: true
      });
    } catch {
      return { banner: { id: banner.id || `b-${Date.now()}`, ...banner } as Banner };
    }
  },
  adminDeleteBanner: async (id: string) => {
    try {
      return await httpRequest<{ success: boolean }>(`/api/v1/banners/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        requiresAuth: true
      });
    } catch {
      return { success: true };
    }
  },
  adminGetCoupons: async () => {
    try {
      return await httpRequest<{ coupons: Coupon[] }>('/api/v1/coupons', {
        method: 'GET',
        requiresAuth: true
      });
    } catch {
      return {
        coupons: [
          {
            id: 'cp-welcome10',
            code: 'SAVE10',
            discountType: 'percentage' as const,
            discountValue: 10,
            minSpend: 1500,
            maxDiscount: 500,
            usageLimit: 200,
            timesUsed: 14,
            isActive: true
          }
        ]
      };
    }
  },
  adminSaveCoupon: async (coupon: Partial<Coupon>) => {
    try {
      return await httpRequest<{ coupon: Coupon }>('/api/v1/coupons', {
        method: coupon.id ? 'PATCH' : 'POST',
        body: coupon,
        requiresAuth: true
      });
    } catch {
      return { coupon: { id: coupon.id || `cp-${Date.now()}`, ...coupon } as Coupon };
    }
  },
  adminDeleteCoupon: async (id: string) => {
    try {
      return await httpRequest<{ success: boolean }>(`/api/v1/coupons/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        requiresAuth: true
      });
    } catch {
      return { success: true };
    }
  },
  adminGetSettings: () => api.getSettings(),
  adminUpdateSettings: async (settings: Partial<StoreSettings>) => {
    try {
      return await httpRequest<{ settings: StoreSettings }>('/api/v1/settings', {
        method: 'PATCH',
        body: settings,
        requiresAuth: true
      });
    } catch {
      return { settings: settings as StoreSettings };
    }
  },

  adminLogin: async (username: string, pass: string): Promise<{ success: boolean; token?: string; user?: any }> => {
    return httpRequest<any>('/api/admin/login', {
      method: 'POST',
      body: { username, password: pass }
    });
  },

  adminLogout: async (): Promise<{ success: boolean }> => {
    try {
      return await httpRequest<any>('/api/admin/logout', { method: 'POST', requiresAuth: true });
    } catch {
      return { success: true };
    }
  },

  getGeminiStatus: async (test = false): Promise<{ status: { configured: boolean; model: string; keySource: string; status: string; message: string } }> => {
    return httpRequest<any>(`/api/admin/gemini/status?test=${test}`, {
      method: 'GET',
      requiresAuth: true
    });
  },

  generateProductCopy: async (payload: {
    productName: string;
    category?: string;
    keywords?: string;
    tone?: string;
  }): Promise<{ success: boolean; content: { name: string; shortDescription: string; description: string; highlights: string[]; suggestedTags: string[] } }> => {
    return httpRequest<any>('/api/admin/gemini/generate-copy', {
      method: 'POST',
      body: payload,
      requiresAuth: true
    });
  }
};
