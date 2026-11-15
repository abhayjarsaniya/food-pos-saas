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
  where 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Supplier } from '../../types';

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);
}

const LOCAL_SUPPLIERS_KEY = (businessId: string) => `food_pos_suppliers_${businessId}`;

function getLocalSuppliers(businessId: string): Supplier[] {
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIERS_KEY(businessId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSuppliers(businessId: string, suppliers: Supplier[]): void {
  try {
    localStorage.setItem(LOCAL_SUPPLIERS_KEY(businessId), JSON.stringify(suppliers));
  } catch {}
}

export async function getSuppliers(businessId: string): Promise<Supplier[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'suppliers');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await withTimeout(getDocs(q), 2000);
    if (!snap.empty) {
      const list: Supplier[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      saveLocalSuppliers(businessId, list);
      return list;
    }
  } catch (err) {
    console.warn('Failed or timed out fetching suppliers from cloud, loading locally:', err);
  }

  const local = getLocalSuppliers(businessId);
  if (local.length > 0) return local;

  // Initial starter suppliers if empty
  const initial: Supplier[] = [
    {
      id: `sup_dairy_${businessId}`,
      businessId,
      name: 'Ramesh Patel',
      companyName: 'Amul Dairy Distributors',
      mobile: '9825012345',
      whatsapp: '9825012345',
      email: 'ramesh.dairy@gmail.com',
      address: 'Shop 12, APMC Market, Ahmedabad',
      gstin: '24AABCA1234F1Z1',
      suppliedProducts: 'Milk, Butter, Paneer, Cheese, Cream',
      paymentTerms: 'Weekly Payment',
      notes: 'Delivers daily morning 6:30 AM',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `sup_veggies_${businessId}`,
      businessId,
      name: 'Gopal Saini',
      companyName: 'Fresh Farm Produce',
      mobile: '9898054321',
      whatsapp: '9898054321',
      email: 'gopal.freshveggies@yahoo.com',
      address: 'Sardar Patel Veg Market, Stall 45',
      gstin: '',
      suppliedProducts: 'Onions, Potatoes, Tomatoes, Capsicum, Green Chillies, Coriander',
      paymentTerms: 'Immediate / Cash on delivery',
      notes: 'Call night before for bulk orders',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `sup_grocery_${businessId}`,
      businessId,
      name: 'Mukeshbhai Shah',
      companyName: 'Shreeji Wholesale Provisions',
      mobile: '9879011223',
      whatsapp: '9879011223',
      email: 'shreeji.wholesale@outlook.com',
      address: 'Kalupur Grain Market, Ahmedabad',
      gstin: '24AAFPS5678B1Z3',
      suppliedProducts: 'Basmati Rice, Wheat Flour, Refined Oil, Spices, Sugar, Tea Leaves',
      paymentTerms: 'Net 15 Days',
      notes: 'Free tempo delivery above ₹5000',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  saveLocalSuppliers(businessId, initial);
  return initial;
}

export async function addSupplier(
  businessId: string, 
  data: Omit<Supplier, 'id' | 'businessId' | 'createdAt' | 'updatedAt' | 'isArchived'>
): Promise<Supplier> {
  const id = `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newSupplier: Supplier = {
    ...data,
    id,
    businessId,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  const local = getLocalSuppliers(businessId);
  saveLocalSuppliers(businessId, [newSupplier, ...local]);

  try {
    const docRef = doc(db, 'businesses', businessId, 'suppliers', id);
    await withTimeout(setDoc(docRef, newSupplier), 2000);
  } catch (err) {
    console.warn('Could not save supplier to cloud immediately, stored offline:', err);
  }

  return newSupplier;
}

export async function updateSupplier(
  businessId: string, 
  supplierId: string, 
  updates: Partial<Supplier>
): Promise<void> {
  const now = new Date().toISOString();
  const local = getLocalSuppliers(businessId);
  const updated = local.map((s) => (s.id === supplierId ? { ...s, ...updates, updatedAt: now } : s));
  saveLocalSuppliers(businessId, updated);

  try {
    const docRef = doc(db, 'businesses', businessId, 'suppliers', supplierId);
    await withTimeout(updateDoc(docRef, { ...updates, updatedAt: now }), 2000);
  } catch (err) {
    console.warn('Could not update supplier in cloud immediately:', err);
  }
}

export async function toggleArchiveSupplier(businessId: string, supplierId: string): Promise<boolean> {
  const local = getLocalSuppliers(businessId);
  const target = local.find((s) => s.id === supplierId);
  if (!target) return false;

  const nextArchived = !target.isArchived;
  await updateSupplier(businessId, supplierId, { isArchived: nextArchived });
  return nextArchived;
}

export async function deleteSupplier(
  businessId: string, 
  supplierId: string, 
  hasHistoricalRecords = false
): Promise<{ deleted: boolean; archived: boolean; message: string }> {
  const local = getLocalSuppliers(businessId);
  let target = local.find((s) => s.id === supplierId);
  if (!target) {
    try {
      const snap = await withTimeout(getDoc(doc(db, 'businesses', businessId, 'suppliers', supplierId)), 2000);
      if (snap.exists()) {
        target = { id: snap.id, ...(snap.data() as any) };
      }
    } catch {}
  }

  if (!target) {
    return { deleted: false, archived: false, message: 'Supplier not found' };
  }

  // If there are purchase orders or payments, protect historical records via archival
  if (hasHistoricalRecords) {
    await updateSupplier(businessId, supplierId, { isArchived: true });
    return { 
      deleted: false, 
      archived: true, 
      message: `"${target.companyName}" has historical purchase orders or payments and was safely archived to protect tax records.` 
    };
  }

  // Safe permanent deletion if no transactions exist
  const remaining = local.filter((s) => s.id !== supplierId);
  saveLocalSuppliers(businessId, remaining);

  try {
    const docRef = doc(db, 'businesses', businessId, 'suppliers', supplierId);
    await withTimeout(deleteDoc(docRef), 2000);
  } catch (err) {
    console.warn('Could not delete supplier from cloud immediately, deleted locally:', err);
  }

  return { deleted: true, archived: false, message: `"${target.companyName}" was permanently removed.` };
}
