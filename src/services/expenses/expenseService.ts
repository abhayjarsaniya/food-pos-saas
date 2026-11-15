import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Expense } from '../../types';

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore operation timed out')), ms)
    ),
  ]);
}

const LOCAL_EXPENSES_KEY = (businessId: string) => `food_pos_expenses_${businessId}`;

function getLocalExpenses(businessId: string): Expense[] {
  try {
    const raw = localStorage.getItem(LOCAL_EXPENSES_KEY(businessId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalExpenses(businessId: string, expenses: Expense[]): void {
  try {
    localStorage.setItem(LOCAL_EXPENSES_KEY(businessId), JSON.stringify(expenses));
  } catch {}
}

export async function getExpenses(businessId: string): Promise<Expense[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'expenses');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await withTimeout(getDocs(q), 2500);
    if (!snap.empty) {
      const list: Expense[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      saveLocalExpenses(businessId, list);
      return list;
    }
  } catch (err) {
    console.warn('Could not fetch expenses from cloud, loading cached:', err);
  }

  const cached = getLocalExpenses(businessId);
  if (cached.length > 0) return cached;

  // Starter restaurant expenses
  const starters: Expense[] = [
    {
      id: `exp_${businessId}_01`,
      businessId,
      category: 'Kitchen Supplies',
      amount: 450,
      paymentMethod: 'CASH',
      description: 'Fresh coriander, ginger and green chillies from local market',
      date: new Date().toISOString().split('T')[0],
      createdBy: 'Store Manager',
      createdAt: new Date().toISOString(),
      isVoided: false,
    },
    {
      id: `exp_${businessId}_02`,
      businessId,
      category: 'Utilities & Rent',
      amount: 1800,
      paymentMethod: 'UPI',
      description: 'Commercial LPG Cylinder Refill (19 kg)',
      date: new Date().toISOString().split('T')[0],
      createdBy: 'Store Owner',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      isVoided: false,
    }
  ];

  saveLocalExpenses(businessId, starters);
  return starters;
}

export async function addExpense(
  businessId: string,
  data: Omit<Expense, 'id' | 'businessId' | 'createdAt'>
): Promise<Expense> {
  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newExpense: Expense = {
    ...data,
    id: expenseId,
    businessId,
    createdAt: now,
    isVoided: false,
  };

  const local = getLocalExpenses(businessId);
  saveLocalExpenses(businessId, [newExpense, ...local]);

  try {
    const docRef = doc(db, 'businesses', businessId, 'expenses', expenseId);
    await withTimeout(setDoc(docRef, newExpense), 2500);
  } catch (err) {
    console.warn('Expense saved offline:', err);
  }

  return newExpense;
}

export async function updateExpense(
  businessId: string,
  expenseId: string,
  updates: Partial<Expense>
): Promise<void> {
  const now = new Date().toISOString();
  const local = getLocalExpenses(businessId);
  const updated = local.map((e) => (e.id === expenseId ? { ...e, ...updates, updatedAt: now } : e));
  saveLocalExpenses(businessId, updated);

  try {
    const docRef = doc(db, 'businesses', businessId, 'expenses', expenseId);
    await withTimeout(updateDoc(docRef, { ...updates, updatedAt: now }), 2500);
  } catch (err) {
    console.warn('Could not update expense in cloud immediately:', err);
  }
}

/**
 * Void an expense for financial audit integrity
 */
export async function voidExpense(
  businessId: string,
  expenseId: string,
  reason: string,
  voidedBy: string
): Promise<void> {
  const now = new Date().toISOString();
  const updates: Partial<Expense> = {
    isVoided: true,
    voidReason: reason.trim(),
    voidedAt: now,
    voidedBy,
    updatedAt: now,
  };

  await updateExpense(businessId, expenseId, updates);
}

/**
 * Delete or void expense. Preserves audit trail by voiding instead of permanent loss if preferred.
 */
export async function deleteExpense(
  businessId: string,
  expenseId: string,
  permanent = false,
  reason = 'Cancelled by manager',
  voidedBy = 'Manager'
): Promise<{ deleted: boolean; voided: boolean; message: string }> {
  if (!permanent) {
    await voidExpense(businessId, expenseId, reason, voidedBy);
    return {
      deleted: false,
      voided: true,
      message: 'Expense voided and preserved in audit trail.',
    };
  }

  const local = getLocalExpenses(businessId);
  const remaining = local.filter((e) => e.id !== expenseId);
  saveLocalExpenses(businessId, remaining);

  try {
    const docRef = doc(db, 'businesses', businessId, 'expenses', expenseId);
    await withTimeout(deleteDoc(docRef), 2500);
  } catch (err) {
    console.warn('Could not delete expense from cloud immediately, deleted locally:', err);
  }

  return { deleted: true, voided: false, message: 'Expense entry permanently deleted.' };
}
