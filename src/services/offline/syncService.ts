import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getPendingOrdersFromIndexedDB, markOrderSyncedInIndexedDB } from './indexedDb';

export type NetworkStatus = 'ONLINE' | 'OFFLINE';

class SyncManager {
  private isSyncing = false;
  private listeners: Array<(status: { online: boolean; pendingCount: number }) => void> = [];
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
        this.syncPendingOrders();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });

      // Periodically check queue if online
      setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.syncPendingOrders();
        }
      }, 15000);
    }
  }

  public subscribe(cb: (status: { online: boolean; pendingCount: number }) => void) {
    this.listeners.push(cb);
    this.getPendingCount().then((count) => cb({ online: this.isOnline, pendingCount: count }));
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public async getPendingCount(): Promise<number> {
    try {
      const pending = await getPendingOrdersFromIndexedDB();
      return pending.length;
    } catch {
      return 0;
    }
  }

  private async notify() {
    const count = await this.getPendingCount();
    for (const listener of this.listeners) {
      listener({ online: this.isOnline, pendingCount: count });
    }
  }

  public async syncPendingOrders(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing || !this.isOnline) return { synced: 0, failed: 0 };
    this.isSyncing = true;

    let synced = 0;
    let failed = 0;

    try {
      const pendingOrders = await getPendingOrdersFromIndexedDB();
      for (const order of pendingOrders) {
        try {
          const docRef = doc(db, 'businesses', order.businessId, 'orders', order.id);
          await setDoc(docRef, {
            ...order,
            syncedWithCloud: true,
          }, { merge: true });

          await markOrderSyncedInIndexedDB(order.id);
          synced++;
        } catch (err) {
          console.warn(`Failed to sync pending order ${order.id}:`, err);
          failed++;
        }
      }
    } finally {
      this.isSyncing = false;
      this.notify();
    }

    return { synced, failed };
  }
}

export const syncManager = new SyncManager();
