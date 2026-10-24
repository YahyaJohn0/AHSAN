import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import fs from 'node:fs';
import { FIREBASE_CONFIG } from './config.ts';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

/**
 * Initializes Firebase Admin SDK in trusted server environment strictly for Authentication.
 */
export function initFirebaseAdminAuth(): {
  app: App | null;
  auth: Auth | null;
} {
  if (adminApp && adminAuth) {
    return { app: adminApp, auth: adminAuth };
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
        projectId: FIREBASE_CONFIG.projectId
      });
    }

    adminAuth = getAuth(adminApp);
    return { app: adminApp, auth: adminAuth };
  } catch (err: any) {
    console.info('[Firebase Admin Auth Notice] Admin SDK running in public/token verification mode:', err.message);
    return { app: null, auth: null };
  }
}

/**
 * Verifies a client-provided Firebase ID token and determines whether the UID is an authorized administrator.
 * Strictly used for Firebase Auth session validation.
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
  const { auth } = initFirebaseAdminAuth();
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

  // 2. Direct Google Identity Toolkit REST token verification fallback (when Admin SDK lacks private key)
  try {
    const apiKey = FIREBASE_CONFIG.apiKey;
    if (apiKey) {
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
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
    }
  } catch (restErr: any) {
    console.warn('[Google Auth REST Warning]', restErr.message);
  }

  return { valid: false, isAdmin: false, error: 'Invalid or expired Firebase ID token' };
}
