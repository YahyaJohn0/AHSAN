import dotenv from 'dotenv';
dotenv.config({ override: true });

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
export const isProduction = process.env.NODE_ENV === 'production';

export const CLOUDINARY_CONFIG = {
  cloudName: process.env.VITE_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'dqtawjwph',
  uploadPreset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET || 'zamzam',
  assetFolder: 'samples/ecommerce'
};

export const FIREBASE_CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || 'mobapp-4454b.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'mobapp-4454b',
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '',
  adminUids: (process.env.ADMIN_UIDS || 'R2RBdEGxUzZsTN08662JQdvwsSG2').split(',').map(s => s.trim()).filter(Boolean)
};

export const MONGO_CONFIG = {
  uri: process.env.FIRESTORE_URL || process.env.MONGO_URL || null,
  dbName: 'default'
};
