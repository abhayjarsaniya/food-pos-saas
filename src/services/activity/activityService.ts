import { collection, doc, getDocs, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ActivityLog } from '../../types';

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore operation timed out')), ms)
    ),
  ]);
}

export async function logActivity(log: ActivityLog): Promise<void> {
  try {
    const docRef = doc(db, 'businesses', log.businessId, 'activityLogs', log.id);
    await withTimeout(setDoc(docRef, log));
  } catch (err) {
    console.warn('Activity log write bypassed or offline:', err);
  }
}

export async function getActivityLogs(businessId: string, maxLogs = 50): Promise<ActivityLog[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'activityLogs');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(maxLogs));
    const snap = await withTimeout(getDocs(q));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  } catch (err) {
    console.warn('Could not fetch activity logs from cloud:', err);
    return [];
  }
}
