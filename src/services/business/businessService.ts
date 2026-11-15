import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { BusinessProfile, BusinessSettings, Category, MenuItem } from '../../types';
import { 
  cacheCategoriesToIndexedDB, 
  cacheMenuItemsToIndexedDB, 
  cacheProfileToIndexedDB, 
  cacheSettingsToIndexedDB, 
  getCategoriesFromIndexedDB, 
  getMenuItemsFromIndexedDB, 
  getProfileFromIndexedDB, 
  getSettingsFromIndexedDB 
} from '../offline/indexedDb';

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  tax: {
    enabled: false,
    gstin: '',
    defaultGstRate: 5,
    pricingMode: 'exclusive',
    isInterState: false,
  },
  receipt: {
    defaultFormat: 'compact80',
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showGstin: true,
    footerMessage: 'Thank you for your visit! Please visit again.',
  },
  billing: {
    defaultPaymentMethod: 'CASH',
    billNumberPrefix: 'BILL-',
    nextBillNumber: 1001,
  },
  tables: {
    enabled: true,
    availableTables: [
      'Table 01',
      'Table 02',
      'Table 03',
      'Table 04',
      'Table 05',
      'Table 06',
      'Takeaway',
      'Parcel',
    ],
  },
  permissions: {
    cashiersCanCollectPayments: true,
  },
};

/**
 * Wraps a promise with a timeout to avoid hanging if network/Firestore stream hangs
 */
function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore operation timed out')), ms)
    ),
  ]);
}

function isDemo(_businessId: string): boolean {
  return false; // Real Cloud Firestore connected for all business accounts
}

export async function getBusinessProfile(businessId: string): Promise<BusinessProfile | null> {
  try {
    const topRef = doc(db, 'businesses', businessId);
    let snap = await withTimeout(getDoc(topRef), 8000);
    if (!snap.exists()) {
      const profSubRef = doc(db, 'businesses', businessId, 'profile', 'current');
      snap = await withTimeout(getDoc(profSubRef), 5000);
    }
    if (!snap.exists()) {
      const metaRef = doc(db, 'businesses', businessId, 'meta', 'profile');
      snap = await withTimeout(getDoc(metaRef), 5000);
    }
    if (snap.exists()) {
      const rawData = snap.data();
      const data: BusinessProfile = {
        id: businessId,
        name: rawData.businessName || rawData.name || 'Food POS Shop',
        brandName: rawData.brandName || rawData.businessName || rawData.name || '',
        loginId: rawData.loginId || 'owner01',
        ownerName: rawData.ownerName || 'Shop Owner',
        ownerEmail: rawData.ownerEmail || rawData.email || '',
        phone: rawData.phone || '',
        category: (rawData.category as any) || 'Restaurant & Dining',
        address: rawData.address || '',
        currency: rawData.currency || 'INR',
        currencySymbol: rawData.currencySymbol || '₹',
        status: rawData.status || 'ACTIVE',
        plan: rawData.plan || 'PRO',
        subscriptionStatus: rawData.subscriptionStatus || 'ACTIVE',
        planExpiresAt: rawData.planExpiresAt,
        isArchived: rawData.isArchived || false,
        createdAt: rawData.createdAt || new Date().toISOString(),
        updatedAt: rawData.updatedAt || new Date().toISOString(),
      };
      await cacheProfileToIndexedDB(data);
      return data;
    }
  } catch (err) {
    console.warn('Failed or timed out loading profile from Firestore, checking offline DB:', err);
  }
  const cached = await getProfileFromIndexedDB(businessId);
  return cached || null;
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  // Always cache locally first
  await cacheProfileToIndexedDB(profile);

  try {
    const docRef = doc(db, 'businesses', profile.id, 'meta', 'profile');
    const profSubRef = doc(db, 'businesses', profile.id, 'profile', 'current');
    const payload = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    await withTimeout(
      Promise.all([
        setDoc(docRef, payload, { merge: true }),
        setDoc(profSubRef, payload, { merge: true })
      ])
    );
  } catch (err) {
    console.warn('Could not save profile to cloud immediately, stored offline:', err);
  }
}

export async function getBusinessSettings(businessId: string): Promise<BusinessSettings> {
  try {
    const settSubRef = doc(db, 'businesses', businessId, 'settings', 'current');
    let snap = await withTimeout(getDoc(settSubRef));
    if (!snap.exists()) {
      const metaRef = doc(db, 'businesses', businessId, 'meta', 'settings');
      snap = await withTimeout(getDoc(metaRef));
    }
    if (snap.exists()) {
      const data = snap.data() as BusinessSettings;
      await cacheSettingsToIndexedDB(data);
      return data;
    }
  } catch (err) {
    console.warn('Failed or timed out loading settings from Firestore, checking offline DB:', err);
  }
  const cached = await getSettingsFromIndexedDB();
  if (cached) return cached;
  return DEFAULT_BUSINESS_SETTINGS;
}

export async function saveBusinessSettings(businessId: string, settings: BusinessSettings): Promise<void> {
  await cacheSettingsToIndexedDB(settings);

  try {
    const docRef = doc(db, 'businesses', businessId, 'meta', 'settings');
    const settSubRef = doc(db, 'businesses', businessId, 'settings', 'current');
    await withTimeout(
      Promise.all([
        setDoc(docRef, settings, { merge: true }),
        setDoc(settSubRef, settings, { merge: true })
      ])
    );
  } catch (err) {
    console.warn('Could not save settings to cloud immediately, stored offline:', err);
  }
}

// Categories
export async function getCategories(businessId: string): Promise<Category[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'categories');
    const q = query(colRef, orderBy('sortOrder', 'asc'));
    const snap = await withTimeout(getDocs(q), 8000);
    if (!snap.empty) {
      const list: Category[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      await cacheCategoriesToIndexedDB(list);
      return list;
    }
  } catch (err) {
    console.warn('Categories from cloud failed or timed out, loading offline:', err);
  }
  return getCategoriesFromIndexedDB(businessId);
}

export async function addCategory(businessId: string, name: string, sortOrder: number): Promise<Category> {
  const catId = `cat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const docData: Category = {
    id: catId,
    businessId,
    name,
    sortOrder,
    isActive: true,
  };

  const current = await getCategoriesFromIndexedDB();
  await cacheCategoriesToIndexedDB([...current, docData]);

  if (!isDemo(businessId)) {
    try {
      const docRef = doc(db, 'businesses', businessId, 'categories', catId);
      await withTimeout(setDoc(docRef, docData));
    } catch (err) {
      console.warn('Failed to add category to Firestore, saved offline:', err);
    }
  }

  return docData;
}

export async function updateCategory(businessId: string, categoryId: string, updates: Partial<Category>): Promise<void> {
  const current = await getCategoriesFromIndexedDB();
  const updated = current.map(c => c.id === categoryId ? { ...c, ...updates } : c);
  await cacheCategoriesToIndexedDB(updated);

  if (!isDemo(businessId)) {
    try {
      const docRef = doc(db, 'businesses', businessId, 'categories', categoryId);
      await withTimeout(updateDoc(docRef, updates));
    } catch (err) {
      console.warn('Failed to update category in Firestore, saved offline:', err);
    }
  }
}

export async function deleteCategory(businessId: string, categoryId: string): Promise<void> {
  const current = await getCategoriesFromIndexedDB();
  await cacheCategoriesToIndexedDB(current.filter(c => c.id !== categoryId));

  if (!isDemo(businessId)) {
    try {
      const docRef = doc(db, 'businesses', businessId, 'categories', categoryId);
      await withTimeout(deleteDoc(docRef));
    } catch (err) {
      console.warn('Failed to delete category from Firestore, deleted offline:', err);
    }
  }
}

// Menu Items
export async function getMenuItems(businessId: string): Promise<MenuItem[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'menuItems');
    const q = query(colRef, orderBy('sortOrder', 'asc'));
    const snap = await withTimeout(getDocs(q), 8000);
    if (!snap.empty) {
      const list: MenuItem[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      await cacheMenuItemsToIndexedDB(list);
      return list;
    }
  } catch (err) {
    console.warn('MenuItems from cloud failed or timed out, loading offline:', err);
  }
  return getMenuItemsFromIndexedDB(businessId);
}

export async function addMenuItem(businessId: string, item: Omit<MenuItem, 'id'>): Promise<MenuItem> {
  const itemId = `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newItem: MenuItem = { id: itemId, ...item };

  const current = await getMenuItemsFromIndexedDB();
  await cacheMenuItemsToIndexedDB([...current, newItem]);

  if (!isDemo(businessId)) {
    try {
      const docRef = doc(db, 'businesses', businessId, 'menuItems', itemId);
      await withTimeout(setDoc(docRef, newItem));
    } catch (err) {
      console.warn('Failed to add menuItem to Firestore, saved offline:', err);
    }
  }

  return newItem;
}

export async function updateMenuItem(businessId: string, itemId: string, updates: Partial<MenuItem>): Promise<void> {
  const current = await getMenuItemsFromIndexedDB();
  const updated = current.map(i => i.id === itemId ? { ...i, ...updates } : i);
  await cacheMenuItemsToIndexedDB(updated);

  if (!isDemo(businessId)) {
    try {
      const docRef = doc(db, 'businesses', businessId, 'menuItems', itemId);
      await withTimeout(updateDoc(docRef, updates));
    } catch (err) {
      console.warn('Failed to update menuItem in Firestore, saved offline:', err);
    }
  }
}

export async function deleteMenuItem(businessId: string, itemId: string): Promise<void> {
  const current = await getMenuItemsFromIndexedDB();
  await cacheMenuItemsToIndexedDB(current.filter(i => i.id !== itemId));

  if (!isDemo(businessId)) {
    try {
      const docRef = doc(db, 'businesses', businessId, 'menuItems', itemId);
      await withTimeout(deleteDoc(docRef));
    } catch (err) {
      console.warn('Failed to delete menuItem from Firestore, deleted offline:', err);
    }
  }
}
