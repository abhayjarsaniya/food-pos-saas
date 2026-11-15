import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Customer } from '../../types';

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);
}

const LOCAL_CUSTOMERS_KEY = (businessId: string) => `food_pos_customers_${businessId}`;

function getLocalCustomers(businessId: string): Customer[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY(businessId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCustomers(businessId: string, customers: Customer[]): void {
  try {
    localStorage.setItem(LOCAL_CUSTOMERS_KEY(businessId), JSON.stringify(customers));
  } catch {}
}

export async function getCustomers(businessId: string): Promise<Customer[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'customers');
    const q = query(colRef, orderBy('name', 'asc'));
    const snap = await withTimeout(getDocs(q), 2500);
    if (!snap.empty) {
      const list: Customer[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      saveLocalCustomers(businessId, list);
      return list;
    }
  } catch (err) {
    console.warn('Could not fetch customers from Firestore immediately, loading cached:', err);
  }

  const cached = getLocalCustomers(businessId);
  if (cached.length > 0) return cached;

  // Starter demo customer for newly created shop
  const starterCustomers: Customer[] = [
    {
      id: `cust_${businessId}_01`,
      businessId,
      name: 'Rohan Sharma',
      phone: '9876543210',
      email: 'rohan.sharma@example.com',
      address: 'Prahlad Nagar, Ahmedabad',
      notes: 'Prefers butter pav well roasted',
      totalOrders: 3,
      totalSpent: 840,
      lastVisit: new Date().toISOString(),
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `cust_${businessId}_02`,
      businessId,
      name: 'Priya Mehta',
      phone: '9825123456',
      email: 'priya.m@example.com',
      address: 'Makarba, Ahmedabad',
      notes: 'Regular weekend takeaway',
      totalOrders: 5,
      totalSpent: 1250,
      lastVisit: new Date().toISOString(),
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  saveLocalCustomers(businessId, starterCustomers);
  return starterCustomers;
}

export async function addCustomer(
  businessId: string,
  data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
  }
): Promise<Customer> {
  const custId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newCustomer: Customer = {
    id: custId,
    businessId,
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || undefined,
    address: data.address?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    totalOrders: 0,
    totalSpent: 0,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  const local = getLocalCustomers(businessId);
  saveLocalCustomers(businessId, [newCustomer, ...local]);

  try {
    const docRef = doc(db, 'businesses', businessId, 'customers', custId);
    await withTimeout(setDoc(docRef, newCustomer), 2500);
  } catch (err) {
    console.warn('Customer saved locally, cloud sync pending:', err);
  }

  return newCustomer;
}

export async function updateCustomer(
  businessId: string,
  customerId: string,
  updates: Partial<Customer>
): Promise<void> {
  const now = new Date().toISOString();
  const local = getLocalCustomers(businessId);
  const updated = local.map((c) => (c.id === customerId ? { ...c, ...updates, updatedAt: now } : c));
  saveLocalCustomers(businessId, updated);

  try {
    const docRef = doc(db, 'businesses', businessId, 'customers', customerId);
    await withTimeout(updateDoc(docRef, { ...updates, updatedAt: now }), 2500);
  } catch (err) {
    console.warn('Could not update customer in cloud immediately:', err);
  }
}

export async function toggleArchiveCustomer(businessId: string, customerId: string): Promise<boolean> {
  const local = getLocalCustomers(businessId);
  const target = local.find((c) => c.id === customerId);
  if (!target) return false;

  const nextArchived = !target.isArchived;
  await updateCustomer(businessId, customerId, { isArchived: nextArchived });
  return nextArchived;
}

export async function deleteCustomer(
  businessId: string,
  customerId: string,
  hasHistoricalOrders = false
): Promise<{ deleted: boolean; archived: boolean; message: string }> {
  const local = getLocalCustomers(businessId);
  let target = local.find((c) => c.id === customerId);
  if (!target) {
    try {
      const snap = await withTimeout(getDoc(doc(db, 'businesses', businessId, 'customers', customerId)), 2500);
      if (snap.exists()) {
        target = { id: snap.id, ...(snap.data() as any) };
      }
    } catch {}
  }

  if (!target) {
    return { deleted: false, archived: false, message: 'Customer record not found' };
  }

  // Preserve historical order data by archiving rather than deleting
  if (hasHistoricalOrders || (target.totalOrders && target.totalOrders > 0)) {
    await updateCustomer(businessId, customerId, { isArchived: true });
    return {
      deleted: false,
      archived: true,
      message: `"${target.name}" has previous order history. The customer was safely archived to maintain historical order accuracy.`,
    };
  }

  const remaining = local.filter((c) => c.id !== customerId);
  saveLocalCustomers(businessId, remaining);

  try {
    const docRef = doc(db, 'businesses', businessId, 'customers', customerId);
    await withTimeout(deleteDoc(docRef), 2500);
  } catch (err) {
    console.warn('Could not delete customer from cloud immediately, deleted locally:', err);
  }

  return { deleted: true, archived: false, message: `Customer "${target.name}" was permanently removed.` };
}
