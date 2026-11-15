import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order, RestaurantTable, TableStatus, TableWithStatus } from '../../types';
import { normalizePaymentStatus, normalizeOrderStatus } from '../orders/orderService';

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);
}

const LOCAL_TABLES_KEY = (bId: string) => `food_pos_tables_${bId}`;

function getLocalTables(businessId: string): RestaurantTable[] {
  try {
    const raw = localStorage.getItem(LOCAL_TABLES_KEY(businessId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTables(businessId: string, tables: RestaurantTable[]): void {
  try {
    localStorage.setItem(LOCAL_TABLES_KEY(businessId), JSON.stringify(tables));
  } catch {}
}

export const STARTER_TABLES: Omit<RestaurantTable, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Table 01', description: 'Window 2-seater table', seatingCapacity: 2, isActive: true, sortOrder: 1 },
  { name: 'Table 02', description: 'Central 4-seater dining', seatingCapacity: 4, isActive: true, sortOrder: 2 },
  { name: 'Table 03', description: 'Central 4-seater dining', seatingCapacity: 4, isActive: true, sortOrder: 3 },
  { name: 'Table 04', description: 'Spacious 6-seater booth', seatingCapacity: 6, isActive: true, sortOrder: 4 },
  { name: 'Table 05', description: 'Corner 4-seater booth', seatingCapacity: 4, isActive: true, sortOrder: 5 },
  { name: 'Table 06', description: 'Large group 8-seater table', seatingCapacity: 8, isActive: true, sortOrder: 6 },
  { name: 'Family Booth', description: 'Cozy private family booth', seatingCapacity: 6, isActive: true, sortOrder: 7 },
  { name: 'Garden Table 01', description: 'Outdoor open-air table', seatingCapacity: 4, isActive: true, sortOrder: 8 },
  { name: 'VIP Lounge Table', description: 'Executive plush sofa lounge', seatingCapacity: 8, isActive: true, sortOrder: 9 },
  { name: 'Counter 01', description: 'Express quick-dining counter stool', seatingCapacity: 1, isActive: true, sortOrder: 10 },
];

/**
 * Fetch all tables for a business from Cloud Firestore with local cache fallback
 */
export async function getTables(businessId: string): Promise<RestaurantTable[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'tables');
    const q = query(colRef, orderBy('sortOrder', 'asc'));
    const snap = await withTimeout(getDocs(q), 2500);

    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as RestaurantTable[];
      saveLocalTables(businessId, list);
      return list;
    }
  } catch (err) {
    console.warn('Could not fetch tables from Cloud Firestore, falling back to local cache:', err);
  }

  // Local cache check
  const local = getLocalTables(businessId);
  if (local.length > 0) return local;

  // Initialize starter tables if empty
  const now = new Date().toISOString();
  const initialized: RestaurantTable[] = STARTER_TABLES.map((t, idx) => ({
    ...t,
    id: `tbl_${businessId}_${idx + 1}`,
    businessId,
    createdAt: now,
    updatedAt: now,
  }));

  saveLocalTables(businessId, initialized);

  // Background seed to Firestore
  try {
    Promise.all(
      initialized.map(t => setDoc(doc(db, 'businesses', businessId, 'tables', t.id), t))
    ).catch(() => {});
  } catch {}

  return initialized;
}

/**
 * Real-time listener for tables using Firestore onSnapshot
 */
export function subscribeToTables(
  businessId: string,
  onUpdate: (tables: RestaurantTable[]) => void,
  onError?: (err: Error) => void
): () => void {
  // First emit local cache if present
  const local = getLocalTables(businessId);
  if (local.length > 0) {
    onUpdate(local);
  }

  const colRef = collection(db, 'businesses', businessId, 'tables');
  const q = query(colRef, orderBy('sortOrder', 'asc'));

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as RestaurantTable[];
        saveLocalTables(businessId, list);
        onUpdate(list);
      } else {
        // Fallback to local or initialized
        getTables(businessId).then(onUpdate).catch(() => {});
      }
    },
    (err) => {
      console.warn('subscribeToTables listener error, falling back to local cache:', err);
      if (onError) onError(err);
      getTables(businessId).then(onUpdate).catch(() => {});
    }
  );

  return unsubscribe;
}

/**
 * Create a new table with unique name validation (case-insensitive & trimmed)
 */
export async function createTable(
  businessId: string,
  data: {
    name: string;
    description?: string;
    seatingCapacity?: number;
    isActive?: boolean;
    sortOrder?: number;
    createdBy?: string;
  }
): Promise<RestaurantTable> {
  const cleanName = data.name.trim();
  if (!cleanName) {
    throw new Error('Table name is required.');
  }

  const existingTables = await getTables(businessId);
  const isDuplicate = existingTables.some(
    t => t.name.trim().toLowerCase() === cleanName.toLowerCase()
  );

  if (isDuplicate) {
    throw new Error(`Table "${cleanName}" already exists. Please choose a unique table name.`);
  }

  const now = new Date().toISOString();
  const tableId = `tbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sortOrder = typeof data.sortOrder === 'number' ? data.sortOrder : existingTables.length + 1;

  const newTable: RestaurantTable = {
    id: tableId,
    businessId,
    name: cleanName,
    description: data.description?.trim() || '',
    seatingCapacity: data.seatingCapacity && data.seatingCapacity > 0 ? Number(data.seatingCapacity) : undefined,
    isActive: data.isActive !== undefined ? data.isActive : true,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || '',
  };

  const updatedList = [...existingTables, newTable];
  saveLocalTables(businessId, updatedList);

  try {
    const docRef = doc(db, 'businesses', businessId, 'tables', tableId);
    await withTimeout(setDoc(docRef, newTable), 2500);
  } catch (err) {
    console.warn('Could not save table to cloud immediately, saved to offline cache:', err);
  }

  return newTable;
}

/**
 * Update an existing table
 */
export async function updateTable(
  businessId: string,
  tableId: string,
  updates: Partial<Omit<RestaurantTable, 'id' | 'businessId' | 'createdAt'>>
): Promise<RestaurantTable> {
  const existingTables = await getTables(businessId);
  const target = existingTables.find(t => t.id === tableId);
  if (!target) {
    throw new Error('Table not found.');
  }

  if (updates.name) {
    const cleanName = updates.name.trim();
    if (!cleanName) throw new Error('Table name cannot be empty.');

    const isDuplicate = existingTables.some(
      t => t.id !== tableId && t.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`Another table named "${cleanName}" already exists. Please choose a unique name.`);
    }
    updates.name = cleanName;
  }

  const updatedTable: RestaurantTable = {
    ...target,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const updatedList = existingTables.map(t => (t.id === tableId ? updatedTable : t));
  saveLocalTables(businessId, updatedList);

  try {
    const docRef = doc(db, 'businesses', businessId, 'tables', tableId);
    await withTimeout(updateDoc(docRef, { ...updates, updatedAt: updatedTable.updatedAt }), 2500);
  } catch (err) {
    console.warn('Could not update table in cloud immediately, updated offline:', err);
  }

  return updatedTable;
}

/**
 * Delete a table. Prevents deletion if table has active or payment pending orders!
 */
export async function deleteTable(
  businessId: string,
  tableId: string,
  activeOrders: Order[] = []
): Promise<void> {
  const existingTables = await getTables(businessId);
  const target = existingTables.find(t => t.id === tableId);
  if (!target) return;

  // Check if any active order is linked to this table
  const hasActiveOrders = activeOrders.some(o => {
    if (o.status === 'CANCELLED' || o.status === 'VOIDED') return false;
    const matchesTable = o.tableId === tableId || 
                         (o.tableName && o.tableName.toLowerCase() === target.name.toLowerCase()) ||
                         (o.tableNumber && o.tableNumber.toLowerCase() === target.name.toLowerCase());
    if (!matchesTable) return false;

    // Active if open or unpaid or partially paid
    return o.status === 'OPEN' || o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PARTIAL';
  });

  if (hasActiveOrders) {
    throw new Error(
      `Cannot delete "${target.name}" because it currently has active or unpaid orders. Please complete or reassign the orders first.`
    );
  }

  const remaining = existingTables.filter(t => t.id !== tableId);
  saveLocalTables(businessId, remaining);

  try {
    const docRef = doc(db, 'businesses', businessId, 'tables', tableId);
    await withTimeout(deleteDoc(docRef), 2500);
  } catch (err) {
    console.warn('Could not delete table from cloud immediately, deleted offline:', err);
  }
}

/**
 * Reorder tables
 */
export async function reorderTables(
  businessId: string,
  orderedIds: string[]
): Promise<RestaurantTable[]> {
  const existingTables = await getTables(businessId);
  const updatedList = existingTables.map(t => {
    const newIdx = orderedIds.indexOf(t.id);
    return {
      ...t,
      sortOrder: newIdx !== -1 ? newIdx + 1 : t.sortOrder,
      updatedAt: new Date().toISOString(),
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  saveLocalTables(businessId, updatedList);

  try {
    Promise.all(
      updatedList.map(t =>
        updateDoc(doc(db, 'businesses', businessId, 'tables', t.id), {
          sortOrder: t.sortOrder,
          updatedAt: t.updatedAt,
        })
      )
    ).catch(() => {});
  } catch {}

  return updatedList;
}

/**
 * Calculates real-time table status (AVAILABLE, OCCUPIED, PAYMENT_PENDING) based on current orders.
 * Rules:
 * - Table occupancy is derived ONLY from active dining orders: (status === 'OPEN' || status === 'DRAFT').
 * - When an order is COMPLETED, CANCELLED, or VOIDED, the guests have left the table; the table is released (AVAILABLE).
 * - If occupying orders have paymentStatus UNPAID or PARTIAL -> PAYMENT_PENDING.
 * - If occupying orders have paymentStatus PAID -> OCCUPIED.
 */
export function calculateTableStatuses(
  tables: RestaurantTable[],
  orders: Order[]
): TableWithStatus[] {
  return tables.map(table => {
    // Find active orders currently occupying this table
    const activeOrders = orders.filter(o => {
      // Must be an active dining order occupying the table
      const ordStatus = normalizeOrderStatus(o.orderStatus || o.status);
      const isOccupying = ordStatus === 'Open' || ordStatus === 'Draft';
      if (!isOccupying) return false;

      const isLinked = o.tableId === table.id || 
                       (o.tableName && o.tableName.trim().toLowerCase() === table.name.trim().toLowerCase()) ||
                       (o.tableNumber && o.tableNumber.trim().toLowerCase() === table.name.trim().toLowerCase());
      return isLinked;
    });

    let status: TableStatus = 'AVAILABLE';
    let totalOutstanding = 0;

    if (activeOrders.length > 0) {
      totalOutstanding = activeOrders.reduce((sum, o) => {
        const bal = o.balanceDue !== undefined && o.balanceDue !== null 
          ? o.balanceDue 
          : Math.max(0, (o.grandTotal || 0) - (o.amountPaid || 0));
        return sum + bal;
      }, 0);

      const hasPaymentPending = activeOrders.some(o => {
        const payStatus = normalizePaymentStatus(o.canonicalPaymentStatus || o.paymentStatus);
        return payStatus === 'Unpaid' || payStatus === 'Partially Paid';
      });

      if (hasPaymentPending) {
        status = 'PAYMENT_PENDING';
      } else {
        status = 'OCCUPIED';
      }
    }

    return {
      ...table,
      status,
      activeOrders,
      totalOutstanding,
    };
  });
}
