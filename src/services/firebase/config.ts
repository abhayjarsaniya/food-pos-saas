import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const getEnv = (key: string, fallback: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }
  const proc = (globalThis as any).process;
  if (proc?.env?.[key]) {
    return proc.env[key];
  }
  return fallback;
};

export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', 'AIzaSyBdmgn4i-SGlI1zVIUraugiq5ToyzbV1lM'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', 'food-pos-saas-prod-2026.firebaseapp.com'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', 'food-pos-saas-prod-2026'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', 'food-pos-saas-prod-2026.firebasestorage.app'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '57368799067'),
  appId: getEnv('VITE_FIREBASE_APP_ID', '1:57368799067:web:a05a173bb4fd9de6d49c7e'),
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
