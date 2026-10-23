/**
 * Zamzam Administrative Session & Authorization Service
 *
 * Keeps administrator authorization strictly segregated from customer authentication.
 * Even if a customer is authenticated in Firebase on the public storefront,
 * they do not gain administrative access to /adminportal without explicit
 * backend-verified administrator authentication.
 */

const ADMIN_SESSION_KEY = 'zamzam_admin_portal_session_v1';

export interface AdminSession {
  email: string;
  token?: string;
  verifiedAt: number;
  role: 'admin';
}

export function getAdminSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY) || localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    // Check if session has expired (e.g. 8 hours)
    if (Date.now() - session.verifiedAt > 8 * 60 * 60 * 1000) {
      clearAdminSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setAdminSession(email: string, token?: string, persist = true): void {
  const session: AdminSession = {
    email: email.trim(),
    token: token?.trim(),
    verifiedAt: Date.now(),
    role: 'admin'
  };
  try {
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    if (persist) {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    }
  } catch (err) {
    console.error('Failed to save admin session:', err);
  }
}

export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch (err) {
    console.error('Failed to clear admin session:', err);
  }
}

export function isVerifiedAdmin(): boolean {
  return getAdminSession() !== null;
}
