import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { BusinessProfile, BusinessSettings, Category, MenuItem, Order } from '../../types';

interface FoodPosDB extends DBSchema {
  orders: {
    key: string;
    value: Order;
    indexes: {
      'by-billNumber': string;
      'by-createdAt': string;
      'by-syncStatus': number; // 0 for pending, 1 for synced
    };
  };
  categories: {
    key: string;
    value: Category;
  };
  menuItems: {
    key: string;
    value: MenuItem;
    indexes: {
      'by-categoryId': string;
    };
  };
  profile: {
    key: string;
    value: BusinessProfile;
  };
  settings: {
    key: string;
    value: BusinessSettings;
  };
  meta: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'food_pos_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FoodPosDB>> | null = null;

const isIndexedDBAvailable = typeof indexedDB !== 'undefined';

const inMemoryStore = {
  orders: new Map<string, Order>(),
  categories: new Map<string, Category>(),
  menuItems: new Map<string, MenuItem>(),
  profile: new Map<string, BusinessProfile>(),
  settings: new Map<string, BusinessSettings>(),
};

export function getOfflineDB(): Promise<IDBPDatabase<FoodPosDB>> {
  if (!isIndexedDBAvailable) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }
  if (!dbPromise) {
    dbPromise = openDB<FoodPosDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Orders store
        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
          orderStore.createIndex('by-billNumber', 'billNumber');
          orderStore.createIndex('by-createdAt', 'createdAt');
          orderStore.createIndex('by-syncStatus', 'syncedWithCloud' as any);
        }

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }

        // Menu items store
        if (!db.objectStoreNames.contains('menuItems')) {
          const itemStore = db.createObjectStore('menuItems', { keyPath: 'id' });
          itemStore.createIndex('by-categoryId', 'categoryId');
        }

        // Profile store
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        // Meta store
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

// Helper methods for IndexedDB operations
export async function saveOrderToIndexedDB(order: Order): Promise<void> {
  if (!isIndexedDBAvailable) {
    inMemoryStore.orders.set(order.id, order);
    return;
  }
  const db = await getOfflineDB();
  await db.put('orders', order);
}

export async function getOrdersFromIndexedDB(): Promise<Order[]> {
  if (!isIndexedDBAvailable) {
    return Array.from(inMemoryStore.orders.values());
  }
  const db = await getOfflineDB();
  return db.getAll('orders');
}

export async function getPendingOrdersFromIndexedDB(): Promise<Order[]> {
  if (!isIndexedDBAvailable) {
    return Array.from(inMemoryStore.orders.values()).filter((o) => !o.syncedWithCloud);
  }
  const db = await getOfflineDB();
  const all = await db.getAll('orders');
  return all.filter((o) => !o.syncedWithCloud);
}

export async function deleteOrderFromIndexedDB(orderId: string): Promise<void> {
  if (!isIndexedDBAvailable) {
    inMemoryStore.orders.delete(orderId);
    return;
  }
  const db = await getOfflineDB();
  await db.delete('orders', orderId);
}

export async function markOrderSyncedInIndexedDB(orderId: string): Promise<void> {
  if (!isIndexedDBAvailable) {
    const o = inMemoryStore.orders.get(orderId);
    if (o) {
      o.syncedWithCloud = true;
      inMemoryStore.orders.set(orderId, o);
    }
    return;
  }
  const db = await getOfflineDB();
  const order = await db.get('orders', orderId);
  if (order) {
    order.syncedWithCloud = true;
    await db.put('orders', order);
  }
}

export async function cacheCategoriesToIndexedDB(categories: Category[]): Promise<void> {
  if (!isIndexedDBAvailable) {
    inMemoryStore.categories.clear();
    for (const cat of categories) {
      inMemoryStore.categories.set(cat.id, cat);
    }
    return;
  }
  const db = await getOfflineDB();
  const tx = db.transaction('categories', 'readwrite');
  await tx.store.clear();
  for (const cat of categories) {
    await tx.store.put(cat);
  }
  await tx.done;
}

export async function getCategoriesFromIndexedDB(businessId?: string): Promise<Category[]> {
  if (!isIndexedDBAvailable) {
    const list = Array.from(inMemoryStore.categories.values());
    return businessId ? list.filter(c => c.businessId === businessId) : list;
  }
  const db = await getOfflineDB();
  const all = await db.getAll('categories');
  return businessId ? all.filter(c => c.businessId === businessId) : all;
}

export async function cacheMenuItemsToIndexedDB(items: MenuItem[]): Promise<void> {
  if (!isIndexedDBAvailable) {
    inMemoryStore.menuItems.clear();
    for (const item of items) {
      inMemoryStore.menuItems.set(item.id, item);
    }
    return;
  }
  const db = await getOfflineDB();
  const tx = db.transaction('menuItems', 'readwrite');
  await tx.store.clear();
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function getMenuItemsFromIndexedDB(businessId?: string): Promise<MenuItem[]> {
  if (!isIndexedDBAvailable) {
    const list = Array.from(inMemoryStore.menuItems.values());
    return businessId ? list.filter(i => i.businessId === businessId) : list;
  }
  const db = await getOfflineDB();
  const all = await db.getAll('menuItems');
  return businessId ? all.filter(i => i.businessId === businessId) : all;
}

export async function cacheProfileToIndexedDB(profile: BusinessProfile): Promise<void> {
  if (!isIndexedDBAvailable) {
    inMemoryStore.profile.set(profile.id || 'current', profile);
    return;
  }
  const db = await getOfflineDB();
  await db.put('profile', profile);
}

export async function getProfileFromIndexedDB(businessId?: string): Promise<BusinessProfile | undefined> {
  if (!isIndexedDBAvailable) {
    const list = Array.from(inMemoryStore.profile.values());
    if (businessId) return list.find(p => p.id === businessId);
    return list[0];
  }
  const db = await getOfflineDB();
  if (businessId) {
    const item = await db.get('profile', businessId);
    if (item) return item;
  }
  const all = await db.getAll('profile');
  if (businessId) {
    return all.find(p => p.id === businessId);
  }
  return all[0];
}

export async function clearLocalShopCache(): Promise<void> {
  if (!isIndexedDBAvailable) {
    inMemoryStore.categories.clear();
    inMemoryStore.menuItems.clear();
    inMemoryStore.profile.clear();
    return;
  }
  try {
    const db = await getOfflineDB();
    const tx = db.transaction(['categories', 'menuItems', 'profile'], 'readwrite');
    await tx.objectStore('categories').clear();
    await tx.objectStore('menuItems').clear();
    await tx.objectStore('profile').clear();
    await tx.done;
  } catch (err) {
    console.warn('Error clearing offline shop cache:', err);
  }
}

export async function cacheSettingsToIndexedDB(settings: BusinessSettings): Promise<void> {
  if (!isIndexedDBAvailable) {
    inMemoryStore.settings.set('current', settings);
    return;
  }
  const db = await getOfflineDB();
  await db.put('settings', settings, 'current');
}

export async function getSettingsFromIndexedDB(): Promise<BusinessSettings | undefined> {
  if (!isIndexedDBAvailable) {
    return inMemoryStore.settings.get('current');
  }
  const db = await getOfflineDB();
  return db.get('settings', 'current');
}
