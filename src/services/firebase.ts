import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  updateProfile,
  type User
} from 'firebase/auth';

const env: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env
    : (typeof process !== 'undefined' && process.env ? process.env : {});

const firebaseConfig = {
  apiKey:
    env.VITE_FIREBASE_API_KEY ||
    env.FIREBASE_API_KEY ||
    'AIzaSyDummyKeyForEnvironmentTesting000000',
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    env.FIREBASE_AUTH_DOMAIN ||
    'mobapp-4454b.firebaseapp.com',
  projectId:
    env.VITE_FIREBASE_PROJECT_ID ||
    env.FIREBASE_PROJECT_ID ||
    'mobapp-4454b',
  appId:
    env.VITE_FIREBASE_APP_ID ||
    env.FIREBASE_APP_ID ||
    ''
};

// Initialize Firebase App strictly for Authentication
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Retrieves a fresh Firebase ID token for the currently authenticated user.
 * Sends forceRefresh = true if expired or explicitly requested.
 */
export async function getFreshIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch (err) {
    console.warn('[Firebase Auth] Failed to retrieve fresh ID token:', err);
    return null;
  }
}

// ==========================================
// CUSTOMER AUTHENTICATION (EMAIL/PASSWORD & GOOGLE)
// ==========================================

/**
 * Customer sign-up with Email, Password and optional Full Name
 */
export async function customerSignUpWithEmail(email: string, pass: string, fullName?: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (fullName && fullName.trim() && credential.user) {
    try {
      await updateProfile(credential.user, { displayName: fullName.trim() });
    } catch (e) {
      console.warn('Failed to update customer displayName:', e);
    }
  }
  return credential.user;
}

/**
 * Customer sign-in with Email and Password
 */
export async function customerSignInWithEmail(email: string, pass: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return credential.user;
}

/**
 * Customer sign-in with Google OAuth popup (with redirect fallback)
 */
export async function customerSignInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    // If popup was blocked by browser or failed, fallback to redirect flow
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      try {
        await signInWithRedirect(auth, googleProvider);
        const redirectRes = await getRedirectResult(auth);
        if (redirectRes?.user) return redirectRes.user;
      } catch (redirectErr) {
        throw redirectErr;
      }
    }
    throw err;
  }
}

/**
 * Customer password reset via email
 */
export async function customerSendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Customer sign-out
 */
export async function customerSignOut(): Promise<void> {
  await signOut(auth);
}

// ==========================================
// ADMINISTRATOR AUTHENTICATION
// ==========================================

/**
 * Sign in administrator using Firebase Email and Password.
 */
export async function adminSignIn(email: string, pass: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return credential.user;
}

/**
 * Sign out administrator from Firebase session.
 */
export async function adminSignOut(): Promise<void> {
  await signOut(auth);
}

/**
 * Subscribe to Firebase authentication state changes.
 */
export function onAdminAuthStateChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
