import { collection, doc, getDocs, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Expense } from '../../types';

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore operation timed out')), ms)
    ),
  ]);
}

export async function addExpense(expense: Expense): Promise<Expense> {
  try {
    const docRef = doc(db, 'businesses', expense.businessId, 'expenses', expense.id);
    await withTimeout(setDoc(docRef, expense));
  } catch (err) {
    console.warn('Expense saved offline:', err);
  }
  return expense;
}

export async function getExpenses(businessId: string): Promise<Expense[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'expenses');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await withTimeout(getDocs(q));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  } catch (err) {
    console.warn('Could not fetch expenses from cloud:', err);
    return [];
  }
}
