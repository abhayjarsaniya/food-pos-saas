import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
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
  AccessPlan,
  BillingCycle,
  BusinessMember,
  SubscriptionStatus
} from '../../types';
import { DEFAULT_BUSINESS_SETTINGS } from '../business/businessService';
import { assignShopSubscription, getShopSubscription } from '../subscription/subscriptionService';

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);
}

export interface CreateShopParams {
  name: string;
  brandName?: string;
  loginId?: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  category: BusinessCategory;
  address: string;
  plan: AccessPlan;
  billingCycle?: BillingCycle;
  planExpiresAt?: string;
  temporaryPassword?: string;
}

export interface CreateShopResult {
  businessId: string;
  loginId: string;
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
 * Check if a login ID is available across all businesses and staff
 */
export async function isLoginIdAvailable(loginId: string, currentBusinessId?: string): Promise<boolean> {
  const cleanId = loginId.trim().toLowerCase();
  if (!cleanId) return false;

  // Reserved IDs
  if (['admin', 'superadmin', 'root', 'support', 'help'].includes(cleanId)) {
    return false;
  }

  try {
    const docRef = doc(db, 'loginIds', cleanId);
    const snap = await withTimeout(getDoc(docRef), 2000);
    if (snap.exists()) {
      const data = snap.data();
      if (currentBusinessId && data.businessId === currentBusinessId) {
        return true; // Already belongs to this business
      }
      return false;
    }
  } catch (err) {
    console.warn('Could not query loginIds from cloud Firestore:', err);
  }

  // Check local fallback
  try {
    const rawLocal = localStorage.getItem(`food_pos_login_id_${cleanId}`);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (currentBusinessId && parsed.businessId === currentBusinessId) {
        return true;
      }
      return false;
    }
  } catch {}

  return true;
}

/**
 * Creates a new independent business tenant without signing out the Super Admin
 */
export async function createNewShop(params: CreateShopParams): Promise<CreateShopResult> {
  const businessId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const defaultPassword = params.temporaryPassword || `FoodPOS@${Math.floor(1000 + Math.random() * 9000)}`;

  // Generate or sanitize Login ID
  let chosenLoginId = (params.loginId || params.name.toLowerCase().replace(/[^a-z0-9]/g, '')).substring(0, 20);
  if (!chosenLoginId || chosenLoginId.length < 3) {
    chosenLoginId = `shop_${Math.random().toString(36).substring(2, 7)}`;
  }
  chosenLoginId = chosenLoginId.toLowerCase();

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
    brandName: params.brandName || params.name,
    loginId: chosenLoginId,
    ownerName: params.ownerName,
    ownerEmail: params.ownerEmail,
    phone: params.phone,
    category: params.category,
    address: params.address,
    currency: 'INR',
    currencySymbol: '₹',
    status: 'ACTIVE',
    plan: params.plan,
    subscriptionStatus: 'ACTIVE',
    planExpiresAt: params.planExpiresAt || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Save in Firestore if reachable
  try {
    const bTopRef = doc(db, 'businesses', businessId);
    const profRef = doc(db, 'businesses', businessId, 'meta', 'profile');
    const settRef = doc(db, 'businesses', businessId, 'meta', 'settings');
    const platRef = doc(db, 'platform', 'shops', 'directory', businessId);
    const loginIdRef = doc(db, 'loginIds', chosenLoginId);
    const memberRef = doc(db, 'businesses', businessId, 'members', `mem_owner_${businessId}`);

    const bTopData = {
      id: businessId,
      name: params.name,
      businessName: params.name,
      brandName: params.brandName || params.name,
      ownerName: params.ownerName,
      ownerEmail: params.ownerEmail,
      email: params.ownerEmail,
      ownerUid,
      loginId: chosenLoginId,
      phone: params.phone,
      category: params.category,
      address: params.address,
      status: 'ACTIVE',
      plan: params.plan,
      createdAt: now,
      updatedAt: now,
    };

    const ownerMember: BusinessMember = {
      id: `mem_owner_${businessId}`,
      businessId,
      name: params.ownerName,
      email: params.ownerEmail,
      loginId: chosenLoginId,
      role: 'OWNER',
      canCollectPayment: true,
      status: 'ACTIVE',
      invitedAt: now,
      joinedAt: now,
      temporaryPassword: defaultPassword,
    };

    const loginIdRecord = {
      loginId: chosenLoginId,
      email: params.ownerEmail,
      role: 'OWNER',
      businessId,
      canCollectPayment: true,
      status: 'ACTIVE',
      name: params.ownerName,
      createdAt: now,
    };

    await withTimeout(
      Promise.all([
        setDoc(bTopRef, bTopData, { merge: true }),
        setDoc(profRef, profile, { merge: true }),
        setDoc(settRef, DEFAULT_BUSINESS_SETTINGS, { merge: true }),
        setDoc(platRef, profile, { merge: true }),
        setDoc(loginIdRef, loginIdRecord, { merge: true }),
        setDoc(memberRef, ownerMember, { merge: true }),
      ]),
      3000
    );
  } catch (err) {
    console.warn('Could not reach cloud Firestore for platform shop creation, persisting locally:', err);
  }

  // Also record local fallback for loginId
  try {
    localStorage.setItem(`food_pos_login_id_${chosenLoginId}`, JSON.stringify({
      loginId: chosenLoginId,
      email: params.ownerEmail,
      role: 'OWNER',
      businessId,
      canCollectPayment: true,
      status: 'ACTIVE',
      name: params.ownerName,
    }));
  } catch {}

  // 2. Assign initial subscription
  try {
    await assignShopSubscription(businessId, {
      planId: params.plan === 'enterprise' ? 'plan_enterprise' : params.plan === 'starter' ? 'plan_starter' : 'plan_pro',
      billingCycle: params.billingCycle || 'MONTHLY',
      pricePaid: 0,
      autoRenew: false,
      notes: 'Initial account setup by Super Admin',
    });
  } catch (subErr) {
    console.warn('Could not assign initial subscription:', subErr);
  }

  // 3. Persist in Local Directory for offline/demo access
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
    loginId: chosenLoginId,
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
    const snap = await withTimeout(getDocs(colRef), 2500);
    if (!snap.empty) {
      const list: ShopSummary[] = snap.docs.map((d) => {
        const data = d.data() as BusinessProfile;
        return {
          ...data,
          totalOrders: (data as any).totalOrders || 0,
          totalSales: (data as any).totalSales || 0,
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
      id: 'biz_prince_pavbhaji_01',
      name: 'Prince Pavbhaji',
      brandName: 'Prince Bhajipav Manekchowkwala',
      ownerName: 'Prince Owner',
      ownerEmail: 'princebhajipav16@gmail.com',
      loginId: 'princeowner',
      phone: '+91 6355 432 020',
      category: 'restaurant',
      address: 'Echelon Complex, Near Torrent Power, Makarba, Prahlad Nagar, Ahmedabad, Gujarat - 380051',
      currency: 'INR',
      currencySymbol: '₹',
      status: 'ACTIVE',
      plan: 'pro',
      subscriptionStatus: 'ACTIVE',
      planExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      isDemo: false,
      totalOrders: 0,
      totalSales: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'demo-business-owner-101',
      name: 'The Royal Bistro & Cafe',
      brandName: 'Royal Bistro Cafe',
      ownerName: 'Jenish Kanani',
      ownerEmail: 'owner@foodpos.app',
      loginId: 'owner01',
      phone: '9876543210',
      category: 'cafe',
      address: '506 Sahajanand Trade Center, Ahmedabad',
      currency: 'INR',
      currencySymbol: '₹',
      status: 'ACTIVE',
      plan: 'pro',
      subscriptionStatus: 'ACTIVE',
      planExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      isDemo: true,
      totalOrders: 0,
      totalSales: 0,
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  saveLocalPlatformShops(initialShops);
  return initialShops;
}

/**
 * Update full shop profile details (name, brandName, phone, category, address, etc.)
 */
export async function updateShopDetails(
  businessId: string, 
  updates: Partial<BusinessProfile>
): Promise<void> {
  const local = getLocalPlatformShops();
  const now = new Date().toISOString();
  const updated = local.map((s) => (s.id === businessId ? { ...s, ...updates, updatedAt: now } : s));
  saveLocalPlatformShops(updated);

  try {
    const profRef = doc(db, 'businesses', businessId, 'meta', 'profile');
    const platRef = doc(db, 'platform', 'shops', 'directory', businessId);
    await withTimeout(
      Promise.all([
        updateDoc(profRef, { ...updates, updatedAt: now }),
        updateDoc(platRef, { ...updates, updatedAt: now }),
      ]),
      2500
    );
  } catch (err) {
    console.warn('Could not sync shop updates to cloud:', err);
  }
}

/**
 * Change shop owner login ID atomically in `loginIds` and shop profile
 */
export async function changeShopOwnerLoginId(
  businessId: string, 
  newLoginId: string
): Promise<{ success: boolean; message: string }> {
  const cleanNewId = newLoginId.trim().toLowerCase();
  if (!cleanNewId || cleanNewId.length < 3) {
    return { success: false, message: 'Login ID must be at least 3 characters long.' };
  }

  // Check availability
  const isAvail = await isLoginIdAvailable(cleanNewId, businessId);
  if (!isAvail) {
    return { success: false, message: `Login ID "${cleanNewId}" is already taken. Please choose another.` };
  }

  // Find shop
  const shops = await getAllShops();
  const shop = shops.find(s => s.id === businessId);
  const oldLoginId = shop?.loginId?.trim().toLowerCase();

  const now = new Date().toISOString();
  const loginRecord = {
    loginId: cleanNewId,
    email: shop?.ownerEmail || `${cleanNewId}@foodpos.app`,
    role: 'OWNER',
    businessId,
    canCollectPayment: true,
    status: 'ACTIVE',
    name: shop?.ownerName || 'Business Owner',
    updatedAt: now,
  };

  try {
    const newDocRef = doc(db, 'loginIds', cleanNewId);
    await setDoc(newDocRef, loginRecord);

    // Delete old login ID if different
    if (oldLoginId && oldLoginId !== cleanNewId) {
      const oldDocRef = doc(db, 'loginIds', oldLoginId);
      await deleteDoc(oldDocRef);
      try {
        localStorage.removeItem(`food_pos_login_id_${oldLoginId}`);
      } catch {}
    }

    // Update profile
    await updateShopDetails(businessId, { loginId: cleanNewId });

    // Update member record if exists
    try {
      const memberRef = doc(db, 'businesses', businessId, 'members', `mem_owner_${businessId}`);
      await updateDoc(memberRef, { loginId: cleanNewId, updatedAt: now });
    } catch {}
  } catch (err) {
    console.warn('Cloud sync error changing login ID, saving locally:', err);
  }

  // Local storage cache
  try {
    localStorage.setItem(`food_pos_login_id_${cleanNewId}`, JSON.stringify(loginRecord));
  } catch {}

  return { success: true, message: `Login ID successfully changed to "${cleanNewId}".` };
}

/**
 * Change shop owner email
 */
export async function changeShopOwnerEmail(
  businessId: string, 
  newEmail: string
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = newEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  const shops = await getAllShops();
  const shop = shops.find(s => s.id === businessId);
  const loginId = shop?.loginId?.trim().toLowerCase();
  const now = new Date().toISOString();

  await updateShopDetails(businessId, { ownerEmail: cleanEmail });

  try {
    if (loginId) {
      const loginDoc = doc(db, 'loginIds', loginId);
      await updateDoc(loginDoc, { email: cleanEmail, updatedAt: now });
    }
    const memberRef = doc(db, 'businesses', businessId, 'members', `mem_owner_${businessId}`);
    await updateDoc(memberRef, { email: cleanEmail, updatedAt: now });
  } catch (err) {
    console.warn('Could not sync email update to cloud:', err);
  }

  return { success: true, message: `Owner email updated to ${cleanEmail}.` };
}

/**
 * Generate a strong temporary password for a shop owner
 */
export async function generateShopOwnerTemporaryPassword(
  businessId: string
): Promise<{ temporaryPassword: string; message: string }> {
  const tempPassword = `FoodPOS@${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  try {
    const memberRef = doc(db, 'businesses', businessId, 'members', `mem_owner_${businessId}`);
    await updateDoc(memberRef, { temporaryPassword: tempPassword, updatedAt: now });
  } catch (err) {
    console.warn('Could not update temporary password in member record:', err);
  }

  return {
    temporaryPassword: tempPassword,
    message: 'Temporary password generated successfully. Please share it securely with the shop owner.',
  };
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
 * Soft delete / Archive a shop
 * Checks order count; protects existing orders while suspending access
 */
export async function softDeleteOrArchiveShop(
  businessId: string, 
  reason: string = 'Archived by platform super admin'
): Promise<{ archived: boolean; orderCount: number; message: string }> {
  // Check order count
  let orderCount = 0;
  try {
    const { getOrders } = await import('../orders/orderService');
    const orders = await getOrders(businessId);
    orderCount = orders.length;
  } catch {}

  const now = new Date().toISOString();
  const updates: Partial<BusinessProfile> = {
    status: 'SUSPENDED',
    isArchived: true,
    archivedAt: now,
    archivedReason: reason,
    updatedAt: now,
  };

  await updateShopDetails(businessId, updates);

  // Deactivate loginId record
  const shops = await getAllShops();
  const shop = shops.find(s => s.id === businessId);
  if (shop?.loginId) {
    try {
      const loginDoc = doc(db, 'loginIds', shop.loginId.toLowerCase());
      await updateDoc(loginDoc, { status: 'DEACTIVATED', updatedAt: now });
    } catch {}
  }

  return {
    archived: true,
    orderCount,
    message: orderCount > 0 
      ? `Shop successfully archived. ${orderCount} historical order records have been preserved safely.`
      : 'Shop archived successfully.',
  };
}

/**
 * Reactivate an archived or suspended shop
 */
export async function reactivateShop(businessId: string): Promise<void> {
  const now = new Date().toISOString();
  await updateShopDetails(businessId, {
    status: 'ACTIVE',
    isArchived: false,
    updatedAt: now,
  });

  const shops = await getAllShops();
  const shop = shops.find(s => s.id === businessId);
  if (shop?.loginId) {
    try {
      const loginDoc = doc(db, 'loginIds', shop.loginId.toLowerCase());
      await updateDoc(loginDoc, { status: 'ACTIVE', updatedAt: now });
    } catch {}
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
  const activeShops = shops.filter((s) => s.status === 'ACTIVE' && !s.isArchived).length;
  const suspendedShops = shops.filter((s) => s.status === 'SUSPENDED' || s.isArchived).length;

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
