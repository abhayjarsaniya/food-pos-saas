import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { InventoryItem, StockMovement, StockStatus, InventoryUnit, StockMovementType } from '../../types';

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);
}

const LOCAL_INVENTORY_KEY = (bId: string) => `food_pos_inventory_${bId}`;
const LOCAL_MOVEMENTS_KEY = (bId: string) => `food_pos_stock_movements_${bId}`;

function getLocalInventory(bId: string): InventoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_INVENTORY_KEY(bId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalInventory(bId: string, items: InventoryItem[]): void {
  try {
    localStorage.setItem(LOCAL_INVENTORY_KEY(bId), JSON.stringify(items));
  } catch {}
}

function getLocalMovements(bId: string): StockMovement[] {
  try {
    const raw = localStorage.getItem(LOCAL_MOVEMENTS_KEY(bId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMovements(bId: string, movements: StockMovement[]): void {
  try {
    localStorage.setItem(LOCAL_MOVEMENTS_KEY(bId), JSON.stringify(movements));
  } catch {}
}

export function computeStockStatus(currentStock: number, minimumStock: number): StockStatus {
  if (currentStock <= 0) return 'OUT_OF_STOCK';
  if (currentStock <= minimumStock) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export async function getInventoryItems(businessId: string): Promise<InventoryItem[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'inventory');
    const q = query(colRef, orderBy('name', 'asc'));
    const snap = await withTimeout(getDocs(q), 2000);
    if (!snap.empty) {
      const list: InventoryItem[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      saveLocalInventory(businessId, list);
      return list;
    }
  } catch (err) {
    console.warn('Failed or timed out fetching inventory from cloud, loading locally:', err);
  }

  const local = getLocalInventory(businessId);
  if (local.length > 0) return local;

  // Starter inventory items for cafe / restaurant
  const starters: InventoryItem[] = [
    {
      id: `inv_milk_${businessId}`,
      businessId,
      name: 'Full Cream Milk',
      category: 'Dairy',
      sku: 'DRY-MILK-01',
      unit: 'l',
      currentStock: 18,
      minimumStock: 10,
      purchasePrice: 62,
      supplierName: 'Amul Dairy Distributors',
      stockStatus: 'IN_STOCK',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `inv_paneer_${businessId}`,
      businessId,
      name: 'Fresh Malai Paneer',
      category: 'Dairy',
      sku: 'DRY-PAN-02',
      unit: 'kg',
      currentStock: 3.5,
      minimumStock: 5,
      purchasePrice: 380,
      supplierName: 'Amul Dairy Distributors',
      stockStatus: 'LOW_STOCK',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `inv_cheese_${businessId}`,
      businessId,
      name: 'Mozzarella & Cheddar Blend',
      category: 'Dairy',
      sku: 'DRY-CHS-03',
      unit: 'kg',
      currentStock: 1.2,
      minimumStock: 3,
      purchasePrice: 480,
      supplierName: 'Amul Dairy Distributors',
      stockStatus: 'LOW_STOCK',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `inv_oil_${businessId}`,
      businessId,
      name: 'Refined Cottonseed / Sunflower Oil',
      category: 'Provisions',
      sku: 'PRO-OIL-15',
      unit: 'l',
      currentStock: 45,
      minimumStock: 20,
      purchasePrice: 135,
      supplierName: 'Shreeji Wholesale Provisions',
      stockStatus: 'IN_STOCK',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `inv_onions_${businessId}`,
      businessId,
      name: 'Red Onions (Pyaaz)',
      category: 'Vegetables',
      sku: 'VEG-ONI-01',
      unit: 'kg',
      currentStock: 0,
      minimumStock: 15,
      purchasePrice: 35,
      supplierName: 'Fresh Farm Produce',
      stockStatus: 'OUT_OF_STOCK',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `inv_potatoes_${businessId}`,
      businessId,
      name: 'Fresh Potatoes (Aloo)',
      category: 'Vegetables',
      sku: 'VEG-POT-02',
      unit: 'kg',
      currentStock: 30,
      minimumStock: 20,
      purchasePrice: 28,
      supplierName: 'Fresh Farm Produce',
      stockStatus: 'IN_STOCK',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `inv_coffee_${businessId}`,
      businessId,
      name: 'Classic Espresso Coffee Powder',
      category: 'Beverage Raw Materials',
      sku: 'BEV-COF-01',
      unit: 'kg',
      currentStock: 4,
      minimumStock: 2,
      purchasePrice: 750,
      supplierName: 'Shreeji Wholesale Provisions',
      stockStatus: 'IN_STOCK',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  saveLocalInventory(businessId, starters);
  return starters;
}

export async function addInventoryItem(
  businessId: string,
  data: Omit<InventoryItem, 'id' | 'businessId' | 'stockStatus' | 'createdAt' | 'updatedAt'>
): Promise<InventoryItem> {
  const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const stockStatus = computeStockStatus(data.currentStock, data.minimumStock);

  const newItem: InventoryItem = {
    ...data,
    id,
    businessId,
    stockStatus,
    createdAt: now,
    updatedAt: now,
  };

  const local = getLocalInventory(businessId);
  saveLocalInventory(businessId, [newItem, ...local]);

  // Log initial stock movement
  if (data.currentStock > 0) {
    await logStockMovement(businessId, {
      inventoryItemId: id,
      itemName: data.name,
      type: 'PURCHASE_RECEIPT',
      quantityChange: data.currentStock,
      previousStock: 0,
      newStock: data.currentStock,
      reason: 'Initial stock intake on item registration',
    });
  }

  try {
    const docRef = doc(db, 'businesses', businessId, 'inventory', id);
    await withTimeout(setDoc(docRef, newItem), 2000);
  } catch (err) {
    console.warn('Could not save inventory item to cloud immediately, saved offline:', err);
  }

  return newItem;
}

export async function updateInventoryItem(
  businessId: string,
  itemId: string,
  updates: Partial<InventoryItem>
): Promise<void> {
  const now = new Date().toISOString();
  const local = getLocalInventory(businessId);
  const updated = local.map((i) => {
    if (i.id === itemId) {
      const merged = { ...i, ...updates, updatedAt: now };
      merged.stockStatus = computeStockStatus(merged.currentStock, merged.minimumStock);
      return merged;
    }
    return i;
  });
  saveLocalInventory(businessId, updated);

  try {
    const docRef = doc(db, 'businesses', businessId, 'inventory', itemId);
    const item = updated.find((i) => i.id === itemId);
    if (item) {
      await withTimeout(updateDoc(docRef, { ...item }), 2000);
    }
  } catch (err) {
    console.warn('Could not update inventory in cloud immediately:', err);
  }
}

/**
 * Adjust stock manually with a mandatory reason and immutable audit record
 */
export async function adjustStock(
  businessId: string,
  itemId: string,
  newQuantity: number,
  reason: string
): Promise<void> {
  if (!reason || reason.trim().length === 0) {
    throw new Error('A mandatory reason is required for manual stock adjustments.');
  }

  const local = getLocalInventory(businessId);
  const item = local.find((i) => i.id === itemId);
  if (!item) throw new Error('Inventory item not found');

  const previousStock = item.currentStock;
  const quantityChange = newQuantity - previousStock;
  const movementType: StockMovementType = quantityChange >= 0 ? 'MANUAL_ADJUSTMENT' : 'WASTAGE';

  await updateInventoryItem(businessId, itemId, { currentStock: newQuantity });

  await logStockMovement(businessId, {
    inventoryItemId: itemId,
    itemName: item.name,
    type: movementType,
    quantityChange,
    previousStock,
    newStock: newQuantity,
    reason: reason.trim(),
  });
}

/**
 * Log immutable stock movement
 */
export async function logStockMovement(
  businessId: string,
  data: Omit<StockMovement, 'id' | 'businessId' | 'createdAt'>
): Promise<StockMovement> {
  const id = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const movement: StockMovement = {
    ...data,
    id,
    businessId,
    createdAt: now,
  };

  const local = getLocalMovements(businessId);
  saveLocalMovements(businessId, [movement, ...local].slice(0, 100)); // keep last 100 movements locally

  try {
    const docRef = doc(db, 'businesses', businessId, 'stockMovements', id);
    await withTimeout(setDoc(docRef, movement), 2000);
  } catch (err) {
    console.warn('Could not save stock movement to cloud immediately:', err);
  }

  return movement;
}

export async function getStockMovements(businessId: string, limitCount = 30): Promise<StockMovement[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'stockMovements');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await withTimeout(getDocs(q), 2000);
    if (!snap.empty) {
      const list: StockMovement[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return list;
    }
  } catch (err) {
    console.warn('Failed to load stock movements from cloud, loading locally:', err);
  }

  return getLocalMovements(businessId).slice(0, limitCount);
}
