import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getDatabase, type Database } from 'firebase-admin/database';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSchema, Product, Category, Order } from './db.ts';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Database | null = null;

export const FIREBASE_CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || 'mobapp-4454b.firebaseapp.com',
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || 'https://mobapp-4454b-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'mobapp-4454b',
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '',
  adminUids: (process.env.ADMIN_UIDS || 'R2RBdEGxUzZsTN08662JQdvwsSG2').split(',').map(s => s.trim()).filter(Boolean)
};

/**
 * Initializes Firebase Admin SDK in trusted server environment.
 * Supports service account JSON credentials if provided, or default application credentials.
 */
export function initFirebaseAdmin(): {
  app: App | null;
  auth: Auth | null;
  db: Database | null;
} {
  if (adminApp) {
    return { app: adminApp, auth: adminAuth, db: adminDb };
  }

  try {
    let credential: any = undefined;
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credPath && fs.existsSync(credPath)) {
      try {
        const keyFile = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        credential = cert(keyFile);
      } catch (err: any) {
        console.warn('[Firebase Admin Credential Warning]', err.message);
      }
    }

    const apps = getApps();
    if (apps.length > 0 && apps[0]) {
      adminApp = apps[0];
    } else {
      adminApp = initializeApp({
        credential: credential || applicationDefault(),
        projectId: FIREBASE_CONFIG.projectId,
        databaseURL: FIREBASE_CONFIG.databaseURL
      });
    }

    adminAuth = getAuth(adminApp);
    adminDb = getDatabase(adminApp);

    return { app: adminApp, auth: adminAuth, db: adminDb };
  } catch (err: any) {
    // If running in development without credentials, log warning gracefully
    console.info('[Firebase Admin Init Notice] Admin SDK running in project mode:', err.message);
    return { app: null, auth: null, db: null };
  }
}

/**
 * Verifies a client-provided Firebase ID token and determines whether the UID is an authorized administrator.
 */
export async function verifyFirebaseIdToken(token: string): Promise<{
  valid: boolean;
  uid?: string;
  email?: string;
  isAdmin: boolean;
  error?: string;
}> {
  if (!token || typeof token !== 'string') {
    return { valid: false, isAdmin: false, error: 'Token is required' };
  }

  // 1. Try Firebase Admin SDK verification
  const { auth } = initFirebaseAdmin();
  if (auth) {
    try {
      const decoded = await auth.verifyIdToken(token);
      const isAdmin =
        Boolean(decoded.admin) ||
        FIREBASE_CONFIG.adminUids.includes(decoded.uid) ||
        Boolean(decoded.email && decoded.email.endsWith('@zamzam.internal'));

      return {
        valid: true,
        uid: decoded.uid,
        email: decoded.email,
        isAdmin
      };
    } catch (err: any) {
      console.warn('[Firebase Token Verification Warning]', err.message);
    }
  }

  // 2. Direct Google Auth REST token verification fallback (when Admin SDK lacks private key)
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_CONFIG.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });

    if (res.ok) {
      const data = await res.json();
      const user = data.users?.[0];
      if (user) {
        const isAdmin =
          FIREBASE_CONFIG.adminUids.includes(user.localId) ||
          Boolean(user.email && user.email.endsWith('@zamzam.internal'));

        return {
          valid: true,
          uid: user.localId,
          email: user.email,
          isAdmin
        };
      }
    }
  } catch (restErr: any) {
    console.warn('[Google Auth REST Warning]', restErr.message);
  }

  return { valid: false, isAdmin: false, error: 'Invalid or expired Firebase ID token' };
}

export interface RTDBStatus {
  configured: boolean;
  connected: boolean;
  projectId: string;
  databaseURL: string;
  demoProductsCount: number;
  liveProductsCount: number;
  message: string;
}

/**
 * Checks connectivity to Firebase Realtime Database
 */
export async function checkRtdbStatus(): Promise<RTDBStatus> {
  const dbUrl = FIREBASE_CONFIG.databaseURL;

  try {
    const [demoRes, liveRes] = await Promise.all([
      fetch(`${dbUrl}/demoProducts.json?shallow=true`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${dbUrl}/products.json?shallow=true`, { signal: AbortSignal.timeout(5000) })
    ]);

    const demoData = await demoRes.json().catch(() => ({}));
    const liveData = await liveRes.json().catch(() => ({}));

    const demoCount = demoData && typeof demoData === 'object' ? Object.keys(demoData).length : 0;
    const liveCount = liveData && typeof liveData === 'object' ? Object.keys(liveData).length : 0;

    return {
      configured: true,
      connected: true,
      projectId: FIREBASE_CONFIG.projectId,
      databaseURL: dbUrl,
      demoProductsCount: demoCount,
      liveProductsCount: liveCount,
      message: `Connected to Firebase Realtime Database (${demoCount} demo products, ${liveCount} live products)`
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      projectId: FIREBASE_CONFIG.projectId,
      databaseURL: dbUrl,
      demoProductsCount: 0,
      liveProductsCount: 0,
      message: err.message || 'Could not connect to Firebase Realtime Database'
    };
  }
}

/**
 * Saves or updates a product in Firebase Realtime Database (/products/{id})
 */
export async function syncProductToRtdb(product: Product): Promise<boolean> {
  try {
    const { db } = initFirebaseAdmin();
    if (db) {
      await db.ref(`products/${product.id}`).set(product);
      return true;
    }

    // Direct REST write with API Key if available
    const url = `${FIREBASE_CONFIG.databaseURL}/products/${product.id}.json`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    return res.ok;
  } catch (err: any) {
    console.warn(`[RTDB Sync Warning] Failed to sync product ${product.id}:`, err.message);
    return false;
  }
}

/**
 * Deletes a product from Firebase Realtime Database (/products/{id})
 */
export async function deleteProductFromRtdb(productId: string): Promise<boolean> {
  try {
    const { db } = initFirebaseAdmin();
    if (db) {
      await db.ref(`products/${productId}`).remove();
      return true;
    }

    const url = `${FIREBASE_CONFIG.databaseURL}/products/${productId}.json`;
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
  } catch (err: any) {
    console.warn(`[RTDB Delete Warning] Failed to delete product ${productId}:`, err.message);
    return false;
  }
}

/**
 * Migrates local store data to Firebase Realtime Database
 */
export async function migrateStoreToRtdb(data: DatabaseSchema): Promise<{
  success: boolean;
  migrated: { products: number; categories: number; orders: number };
  errors: string[];
}> {
  const result = {
    success: true,
    migrated: { products: 0, categories: 0, orders: 0 },
    errors: [] as string[]
  };

  const dbUrl = FIREBASE_CONFIG.databaseURL;

  // 1. Categories
  for (const c of data.categories) {
    try {
      await fetch(`${dbUrl}/categories/${c.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c)
      });
      result.migrated.categories++;
    } catch (e: any) {
      result.errors.push(`Category ${c.id}: ${e.message}`);
    }
  }

  // 2. Settings
  try {
    await fetch(`${dbUrl}/settings.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.settings)
    });
  } catch (e: any) {
    result.errors.push(`Settings: ${e.message}`);
  }

  result.success = result.errors.length === 0;
  return result;
}
