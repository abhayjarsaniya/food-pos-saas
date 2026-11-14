import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  where 
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db } from '../firebase/config';
import { 
  BusinessCategory, 
  BusinessProfile, 
  BusinessSettings, 
  Order, 
  PlatformMetrics, 
  ShopSummary, 
  AccountStatus, 
  AccessPlan 
} from '../../types';
import { DEFAULT_BUSINESS_SETTINGS } from '../business/businessService';

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);
}

export interface CreateShopParams {
  name: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  category: BusinessCategory;
  address: string;
  plan: AccessPlan;
  planExpiresAt?: string;
  temporaryPassword?: string;
}

export interface CreateShopResult {
  businessId: string;
  ownerUid: string;
  email: string;
  temporaryPassword?: string;
  onboardingLink: string;
  profile: BusinessProfile;
}

const LOCAL_SHOPS_KEY = 'food_pos_platform_shops';

// Helper to get local mock shops store for offline/demo resilience
function getLocalPlatformShops(): ShopSummary[] {
  try {
    const raw = localStorage.getItem(LOCAL_SHOPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPlatformShops(shops: ShopSummary[]): void {
  try {
    localStorage.setItem(LOCAL_SHOPS_KEY, JSON.stringify(shops));
  } catch {}
}

/**
 * Creates a new independent business tenant without signing out the Super Admin
 */
export async function createNewShop(params: CreateShopParams): Promise<CreateShopResult> {
  const businessId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const defaultPassword = params.temporaryPassword || `FoodPOS@${Math.floor(1000 + Math.random() * 9000)}`;

  let ownerUid = `usr_${businessId}`;

  // Attempt to create auth user in secondary Firebase app instance
  try {
    const proc = (globalThis as any).process;
    const secondaryApp = initializeApp(
      {
        apiKey: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_API_KEY) || proc?.env?.VITE_FIREBASE_API_KEY || 'AIzaSyBdmgn4i-SGlI1zVIUraugiq5ToyzbV1lM',
        authDomain: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN) || proc?.env?.VITE_FIREBASE_AUTH_DOMAIN || 'food-pos-saas-prod-2026.firebaseapp.com',
        projectId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID) || proc?.env?.VITE_FIREBASE_PROJECT_ID || 'food-pos-saas-prod-2026',
      },
      `SecondaryApp_${Date.now()}`
    );
    const secondaryAuth = getAuth(secondaryApp);
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, params.ownerEmail, defaultPassword);
    ownerUid = userCred.user.uid;
    await deleteApp(secondaryApp);
  } catch (authErr) {
    console.warn('Firebase secondary auth creation failed or bypassed:', authErr);
  }

  const profile: BusinessProfile = {
    id: businessId,
    name: params.name,
    ownerName: params.ownerName,
    ownerEmail: params.ownerEmail,
    phone: params.phone,
    category: params.category,
    address: params.address,
    currency: 'INR',
    currencySymbol: '₹',
    status: 'ACTIVE',
    plan: params.plan,
    planExpiresAt: params.planExpiresAt || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Save in Firestore if reachable
  try {
    const profRef = doc(db, 'businesses', businessId, 'meta', 'profile');
    const settRef = doc(db, 'businesses', businessId, 'meta', 'settings');
    const platRef = doc(db, 'platform', 'shops', 'directory', businessId);

    await withTimeout(
      Promise.all([
        setDoc(profRef, profile),
        setDoc(settRef, DEFAULT_BUSINESS_SETTINGS),
        setDoc(platRef, profile),
      ]),
      2000
    );
  } catch (err) {
    console.warn('Could not reach cloud Firestore for platform shop creation, persisting locally:', err);
  }

  // 2. Persist in Local Directory for offline/demo access
  const localShops = getLocalPlatformShops();
  const shopSummary: ShopSummary = {
    ...profile,
    totalOrders: 0,
    totalSales: 0,
  };
  saveLocalPlatformShops([shopSummary, ...localShops]);

  const onboardingLink = `${window.location.origin}/login?shop=${businessId}`;

  return {
    businessId,
    ownerUid,
    email: params.ownerEmail,
    temporaryPassword: defaultPassword,
    onboardingLink,
    profile,
  };
}

/**
 * Fetch all registered shops
 */
export async function getAllShops(): Promise<ShopSummary[]> {
  try {
    const colRef = collection(db, 'platform', 'shops', 'directory');
    const snap = await withTimeout(getDocs(colRef), 2000);
    if (!snap.empty) {
      const list: ShopSummary[] = snap.docs.map((d) => {
        const data = d.data() as BusinessProfile;
        return {
          ...data,
          totalOrders: 0,
          totalSales: 0,
        };
      });
      saveLocalPlatformShops(list);
      return list;
    }
  } catch (err) {
    console.warn('Failed to load cloud shops directory, checking local store:', err);
  }

  // Fallback to local platform shops
  const local = getLocalPlatformShops();
  if (local.length > 0) return local;

  // Initial sample shops if empty
  const initialShops: ShopSummary[] = [
    {
      id: 'demo-business-owner-101',
      name: 'The Royal Bistro & Cafe',
      ownerName: 'Jenish Kanani',
      ownerEmail: 'owner@foodpos.app',
      phone: '9876543210',
      category: 'cafe',
      address: '506 Sahajanand Trade Center, Ahmedabad',
      currency: 'INR',
      currencySymbol: '₹',
      status: 'ACTIVE',
      plan: 'pro',
      planExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      isDemo: true,
      totalOrders: 0,
      totalSales: 0,
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'biz_street_food_99',
      name: 'Ahmedabad Street Bites',
      ownerName: 'Kishan Patel',
      ownerEmail: 'kishan@streetbites.com',
      phone: '9825100200',
      category: 'food_stall',
      address: 'Law Garden Khau Gali, Ahmedabad',
      currency: 'INR',
      currencySymbol: '₹',
      status: 'ACTIVE',
      plan: 'starter',
      planExpiresAt: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
      isDemo: false,
      totalOrders: 14,
      totalSales: 2150,
      createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  saveLocalPlatformShops(initialShops);
  return initialShops;
}

/**
 * Toggle shop status: ACTIVE or SUSPENDED
 */
export async function updateShopStatus(businessId: string, status: AccountStatus): Promise<void> {
  const local = getLocalPlatformShops();
  const updated = local.map((s) => (s.id === businessId ? { ...s, status } : s));
  saveLocalPlatformShops(updated);

  // If modifying the currently active local demo profile
  const demoUserRaw = localStorage.getItem('food_pos_demo_user');
  if (demoUserRaw) {
    try {
      const parsed = JSON.parse(demoUserRaw);
      if (parsed.user?.uid === businessId) {
        // Also update IndexedDB profile
        const { getProfileFromIndexedDB, cacheProfileToIndexedDB } = await import('../offline/indexedDb');
        const prof = await getProfileFromIndexedDB();
        if (prof) {
          prof.status = status;
          await cacheProfileToIndexedDB(prof);
        }
      }
    } catch {}
  }

  try {
    const profRef = doc(db, 'businesses', businessId, 'meta', 'profile');
    const platRef = doc(db, 'platform', 'shops', 'directory', businessId);
    await withTimeout(
      Promise.all([
        updateDoc(profRef, { status, updatedAt: new Date().toISOString() }),
        updateDoc(platRef, { status, updatedAt: new Date().toISOString() }),
      ]),
      2000
    );
  } catch (err) {
    console.warn('Could not sync status update to cloud immediately:', err);
  }
}

/**
 * Update shop subscription plan & expiration
 */
export async function updateShopPlan(
  businessId: string, 
  plan: AccessPlan, 
  planExpiresAt: string
): Promise<void> {
  const local = getLocalPlatformShops();
  const updated = local.map((s) => (s.id === businessId ? { ...s, plan, planExpiresAt } : s));
  saveLocalPlatformShops(updated);

  try {
    const profRef = doc(db, 'businesses', businessId, 'meta', 'profile');
    const platRef = doc(db, 'platform', 'shops', 'directory', businessId);
    await withTimeout(
      Promise.all([
        updateDoc(profRef, { plan, planExpiresAt, updatedAt: new Date().toISOString() }),
        updateDoc(platRef, { plan, planExpiresAt, updatedAt: new Date().toISOString() }),
      ]),
      2000
    );
  } catch (err) {
    console.warn('Could not sync plan update to cloud immediately:', err);
  }
}

/**
 * Triggers a password reset email via Firebase Auth
 */
export async function sendShopPasswordReset(email: string): Promise<void> {
  const { auth } = await import('../firebase/config');
  await sendPasswordResetEmail(auth, email);
}

/**
 * Compute overall platform analytics
 */
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const shops = await getAllShops();
  const totalShops = shops.length;
  const activeShops = shops.filter((s) => s.status === 'ACTIVE').length;
  const suspendedShops = shops.filter((s) => s.status === 'SUSPENDED').length;

  // Tally orders from local storage / demo seeder
  let totalOrders = 0;
  let totalSalesVolume = 0;

  try {
    const { getOrdersFromIndexedDB } = await import('../offline/indexedDb');
    const localOrders = await getOrdersFromIndexedDB();
    const validOrders = localOrders.filter((o) => o.status !== 'VOIDED');
    totalOrders = validOrders.length;
    totalSalesVolume = validOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  } catch {}

  return {
    totalShops,
    activeShops,
    suspendedShops,
    totalOrders,
    totalSalesVolume,
    newRegistrationsThisMonth: totalShops,
    activeToday: activeShops,
  };
}
