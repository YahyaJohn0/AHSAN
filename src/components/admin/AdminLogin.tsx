import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Info, KeyRound } from 'lucide-react';
import { adminSignIn } from '../../services/firebase.ts';
import { api } from '../../services/api.ts';
import { setAdminSession } from '../../services/adminAuth.ts';
import type { User } from 'firebase/auth';

interface AdminLoginProps {
  onLoginSuccess: (user: { email: string; displayName?: string }) => void;
  onExit: () => void;
  initialError?: string;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onExit, initialError }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(initialError || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setError('Please provide both your administrator email/username and password.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      // 1. If identifier looks like an email, try Firebase Authentication first
      if (cleanId.includes('@')) {
        try {
          const user = await adminSignIn(cleanId, password);
          const idToken = await user.getIdToken().catch(() => undefined);
          setAdminSession(user.email || cleanId, idToken);
          onLoginSuccess({ email: user.email || cleanId, displayName: user.displayName || 'Administrator' });
          return;
        } catch (fbErr: any) {
          // If Firebase failed with user-not-found or invalid-credential, fallback to backend login
          console.warn('[Firebase Admin Login Fallback]', fbErr?.code || fbErr?.message);
          if (fbErr?.code === 'auth/wrong-password' || fbErr?.code === 'auth/invalid-credential') {
            // Check backend just in case
            try {
              const bRes = await api.adminLogin(cleanId, password);
              if (bRes.success) {
                setAdminSession(cleanId, bRes.token);
                onLoginSuccess({ email: cleanId, displayName: 'Administrator' });
                return;
              }
            } catch {
              // Ignore and report invalid credentials
            }
          }
          throw fbErr;
        }
      } else {
        // 2. Non-email username (e.g. "admin"), authenticate against backend API
        const res = await api.adminLogin(cleanId, password);
        if (res.success) {
          setAdminSession(cleanId, res.token);
          onLoginSuccess({ email: `${cleanId}@zamzam.internal`, displayName: 'Administrator' });
          return;
        } else {
          throw new Error('Invalid administrator credentials.');
        }
      }
    } catch (err: any) {
      console.error('[Admin Login Error]', err);
      let msg = err.message || 'Authentication failed. Please verify credentials.';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        msg = 'Invalid administrator credentials. Please check your admin username/email and password.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Access temporarily disabled due to multiple failed login attempts. Please try again later.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection failed. Please check your internet connection.';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mobapp-4454b';

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-amber-400 mx-auto flex items-center justify-center mb-3 shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Admin Access Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Sign in with your verified administrator credentials to access the Zamzam Management Console.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Admin Email or Username
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin or admin@zamzam.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Admin Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{isLoading ? 'Verifying Administrator Session...' : 'Sign In as Administrator'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-5 p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-xl space-y-1.5 text-[11px] text-amber-900">
          <div className="flex items-center gap-1.5 font-semibold text-amber-950">
            <KeyRound className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Administrator Credentials</span>
          </div>
          <p className="text-amber-800 leading-snug">
            Username: <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-bold">admin</code> | Password: <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-bold">admin12345</code> (or your verified Firebase admin email).
          </p>
        </div>

        <div className="mt-4 p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            Firebase Project: <span className="font-mono font-semibold text-slate-700">{firebaseProjectId}</span>
          </span>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={onExit}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            ← Return to Customer Storefront
          </button>
        </div>
      </div>
    </div>
  );
};
