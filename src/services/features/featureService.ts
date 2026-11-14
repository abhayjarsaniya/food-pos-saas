import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { BusinessFeatures, DEFAULT_BUSINESS_FEATURES, FeatureFlagKey } from '../../types';

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Feature operation timed out')), ms)
    ),
  ]);
}

const LOCAL_FEATURES_KEY = (bId: string) => `food_pos_features_${bId}`;

export function getLocalFeatures(businessId: string): BusinessFeatures {
  try {
    const raw = localStorage.getItem(LOCAL_FEATURES_KEY(businessId));
    if (raw) {
      return { ...DEFAULT_BUSINESS_FEATURES, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_BUSINESS_FEATURES };
}

export function saveLocalFeatures(businessId: string, features: BusinessFeatures): void {
  try {
    localStorage.setItem(LOCAL_FEATURES_KEY(businessId), JSON.stringify(features));
  } catch {}
}

export interface FeatureAuditLog {
  id?: string;
  businessId: string;
  featureKey: string;
  previousValue: boolean;
  newValue: boolean;
  updatedBy: string;
  timestamp: string;
  reason?: string;
}

/**
 * Fetch business features from Firestore with platform default fallback
 */
export async function getBusinessFeatures(businessId: string): Promise<BusinessFeatures> {
  const local = getLocalFeatures(businessId);

  try {
    const docRef = doc(db, 'businesses', businessId, 'settings', 'features');
    const snap = await withTimeout(getDoc(docRef), 2000);

    if (snap.exists()) {
      const data = snap.data() as Partial<BusinessFeatures>;
      const merged: BusinessFeatures = {
        ...DEFAULT_BUSINESS_FEATURES,
        ...data,
      };
      saveLocalFeatures(businessId, merged);
      return merged;
    }
  } catch (err) {
    console.warn('Could not fetch cloud features, using local/default:', err);
  }

  return local;
}

/**
 * Update business features (Super Admin override) and record audit log
 */
export async function updateBusinessFeatures(
  businessId: string,
  updates: Partial<BusinessFeatures>,
  updatedBy = 'Super Admin'
): Promise<BusinessFeatures> {
  const current = await getBusinessFeatures(businessId);
  const updated: BusinessFeatures = {
    ...current,
    ...updates,
  };

  saveLocalFeatures(businessId, updated);

  try {
    const docRef = doc(db, 'businesses', businessId, 'settings', 'features');
    await withTimeout(setDoc(docRef, updated, { merge: true }), 2500);

    // Record audit entries for changed features
    const now = new Date().toISOString();
    for (const key of Object.keys(updates) as FeatureFlagKey[]) {
      if (current[key] !== updates[key]) {
        const auditEntry: FeatureAuditLog = {
          businessId,
          featureKey: key,
          previousValue: !!current[key],
          newValue: !!updates[key],
          updatedBy,
          timestamp: now,
        };
        try {
          await addDoc(collection(db, 'businesses', businessId, 'activityLogs'), {
            type: 'FEATURE_FLAG_UPDATE',
            ...auditEntry,
          });
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Could not persist features to Firestore immediately, saved locally:', err);
  }

  return updated;
}

/**
 * Reset business features to platform defaults
 */
export async function resetBusinessFeaturesToDefault(
  businessId: string,
  updatedBy = 'Super Admin'
): Promise<BusinessFeatures> {
  return updateBusinessFeatures(businessId, DEFAULT_BUSINESS_FEATURES, updatedBy);
}

/**
 * Retrieve recent feature change audit logs
 */
export async function getFeatureChangeHistory(businessId: string): Promise<FeatureAuditLog[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'activityLogs');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(20));
    const snap = await withTimeout(getDocs(q), 2000);

    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((l: any) => l.type === 'FEATURE_FLAG_UPDATE') as FeatureAuditLog[];
  } catch {
    return [];
  }
}

/**
 * Feature names and descriptions for display
 */
export const FEATURE_METADATA: Record<FeatureFlagKey, { name: string; description: string; category: string }> = {
  billing: { name: 'POS & Billing', description: 'Core billing counter, cart & item pricing', category: 'Core POS' },
  orders: { name: 'Orders History', description: 'Past order records, details & reprinting', category: 'Core POS' },
  pendingPayments: { name: 'Pending Payments', description: 'Unpaid bills, partial balances & collection', category: 'Counter Ops' },
  menuManagement: { name: 'Menu Management', description: 'Food items, categories, taxes & pricing', category: 'Catalog' },
  tableManagement: { name: 'Table Management', description: 'Custom tables, live occupancy & floor plan', category: 'Counter Ops' },
  suppliers: { name: 'Suppliers & Vendors', description: 'Vendor directory, WhatsApp PO & ledger', category: 'Procurement' },
  inventory: { name: 'Inventory & Materials', description: 'Raw materials, stock alerts & wastage', category: 'Procurement' },
  purchaseOrders: { name: 'Purchase Orders', description: 'Vendor procurement, receiving & payments', category: 'Procurement' },
  reports: { name: 'Reports & Analytics', description: 'Sales reports, tax breakdown & summaries', category: 'Analytics' },
  gst: { name: 'GST Tax Engine', description: 'CGST, SGST, IGST calculation & invoicing', category: 'Compliance' },
  whatsapp: { name: 'WhatsApp Receipts', description: 'Instant digital bill dispatch to customers', category: 'Communications' },
  printing: { name: 'Thermal Printing', description: 'Browser thermal 80mm/58mm/A4 receipt prints', category: 'Hardware' },
  customerManagement: { name: 'Customer Directory', description: 'Save customer phone & name with orders', category: 'CRM' },
  memberManagement: { name: 'Staff & Members', description: 'Manage cashier permissions & staff login IDs', category: 'Team' },
  expenses: { name: 'Expense Tracking', description: 'Daily counter petty cash and overhead expenses', category: 'Accounting' },
  offlineBilling: { name: 'Offline PWA Billing', description: 'Offline cache and background cloud sync', category: 'System' },
};
