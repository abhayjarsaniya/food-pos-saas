import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  PurchaseOrder, 
  PurchaseOrderItem, 
  PurchaseOrderStatus, 
  SupplierPayment, 
  PaymentMethod, 
  PaymentStatus 
} from '../../types';
import { updateInventoryItem, logStockMovement, getInventoryItems } from '../inventory/inventoryService';
import { round2 } from '../../utils/calculations';

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);
}

const LOCAL_POS_KEY = (bId: string) => `food_pos_purchase_orders_${bId}`;
const LOCAL_PAYMENTS_KEY = (bId: string) => `food_pos_supplier_payments_${bId}`;

function getLocalPOs(bId: string): PurchaseOrder[] {
  try {
    const raw = localStorage.getItem(LOCAL_POS_KEY(bId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPOs(bId: string, pos: PurchaseOrder[]): void {
  try {
    localStorage.setItem(LOCAL_POS_KEY(bId), JSON.stringify(pos));
  } catch {}
}

function getLocalSupplierPayments(bId: string): SupplierPayment[] {
  try {
    const raw = localStorage.getItem(LOCAL_PAYMENTS_KEY(bId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSupplierPayments(bId: string, payments: SupplierPayment[]): void {
  try {
    localStorage.setItem(LOCAL_PAYMENTS_KEY(bId), JSON.stringify(payments));
  } catch {}
}

export async function getPurchaseOrders(businessId: string): Promise<PurchaseOrder[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'purchaseOrders');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await withTimeout(getDocs(q), 2000);
    if (!snap.empty) {
      const list: PurchaseOrder[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      saveLocalPOs(businessId, list);
      return list;
    }
  } catch (err) {
    console.warn('Failed or timed out fetching purchase orders from cloud, loading locally:', err);
  }

  return getLocalPOs(businessId);
}

export async function createPurchaseOrder(
  businessId: string,
  data: {
    supplierId: string;
    supplierName: string;
    items: PurchaseOrderItem[];
    subtotal: number;
    discount?: number;
    taxAmount?: number;
    totalAmount: number;
    status: PurchaseOrderStatus;
    orderDate?: string;
    expectedDeliveryDate?: string;
    notes?: string;
  }
): Promise<PurchaseOrder> {
  const localPOs = getLocalPOs(businessId);
  const nextSeq = 1001 + localPOs.length;
  const poNumber = `PO-${nextSeq}`;
  const poId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newPO: PurchaseOrder = {
    id: poId,
    poNumber,
    businessId,
    supplierId: data.supplierId,
    supplierName: data.supplierName,
    items: data.items.map((i) => ({ ...i, quantityReceived: 0 })),
    subtotal: round2(data.subtotal),
    discount: round2(data.discount || 0),
    taxAmount: round2(data.taxAmount || 0),
    totalAmount: round2(data.totalAmount),
    status: data.status,
    amountPaid: 0,
    balanceDue: round2(data.totalAmount),
    paymentStatus: 'UNPAID',
    orderDate: data.orderDate || now,
    expectedDeliveryDate: data.expectedDeliveryDate || '',
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now,
  };

  saveLocalPOs(businessId, [newPO, ...localPOs]);

  try {
    const docRef = doc(db, 'businesses', businessId, 'purchaseOrders', poId);
    await withTimeout(setDoc(docRef, newPO), 2000);
  } catch (err) {
    console.warn('Could not save PO to cloud immediately, stored offline:', err);
  }

  return newPO;
}

/**
 * Record actual received quantities against a Purchase Order and update inventory.
 * Only received quantities increase inventory!
 */
export async function recordGoodsReceipt(
  businessId: string,
  poId: string,
  receivedQuantities: { inventoryItemId: string; receivedNow: number }[]
): Promise<PurchaseOrder> {
  const localPOs = getLocalPOs(businessId);
  const poIndex = localPOs.findIndex((p) => p.id === poId);
  if (poIndex === -1) throw new Error('Purchase Order not found');

  const po = localPOs[poIndex];
  if (po.status === 'CANCELLED') {
    throw new Error('Cannot receive items for a cancelled purchase order');
  }

  const inventoryItems = await getInventoryItems(businessId);
  const now = new Date().toISOString();

  // Update item received quantities
  let allFullyReceived = true;
  let anyReceived = false;

  const updatedItems = po.items.map((item) => {
    const rMatch = receivedQuantities.find((r) => r.inventoryItemId === item.inventoryItemId);
    const addition = rMatch ? Math.max(0, rMatch.receivedNow) : 0;
    const newQtyReceived = Math.min(item.quantityOrdered, item.quantityReceived + addition);

    if (addition > 0) {
      anyReceived = true;
      // Increment inventory stock
      const inv = inventoryItems.find((i) => i.id === item.inventoryItemId);
      if (inv) {
        const nextStock = inv.currentStock + addition;
        updateInventoryItem(businessId, inv.id, {
          currentStock: nextStock,
          lastPurchaseDate: now,
        });

        // Log movement
        logStockMovement(businessId, {
          inventoryItemId: inv.id,
          itemName: inv.name,
          type: 'PURCHASE_RECEIPT',
          quantityChange: addition,
          previousStock: inv.currentStock,
          newStock: nextStock,
          reason: `Goods received against PO ${po.poNumber}`,
          referenceId: po.poNumber,
        });
      }
    }

    if (newQtyReceived < item.quantityOrdered) {
      allFullyReceived = false;
    }

    return {
      ...item,
      quantityReceived: newQtyReceived,
    };
  });

  const nextStatus: PurchaseOrderStatus = allFullyReceived
    ? 'RECEIVED'
    : anyReceived
    ? 'PARTIALLY_RECEIVED'
    : po.status;

  const updatedPO: PurchaseOrder = {
    ...po,
    items: updatedItems,
    status: nextStatus,
    receivedDate: now,
    updatedAt: now,
  };

  localPOs[poIndex] = updatedPO;
  saveLocalPOs(businessId, localPOs);

  try {
    const docRef = doc(db, 'businesses', businessId, 'purchaseOrders', poId);
    await withTimeout(updateDoc(docRef, { ...updatedPO }), 2000);
  } catch (err) {
    console.warn('Could not sync PO goods receipt to cloud immediately:', err);
  }

  return updatedPO;
}

/**
 * Record payment to supplier for a PO
 */
export async function recordSupplierPayment(
  businessId: string,
  params: {
    supplierId: string;
    supplierName: string;
    purchaseOrderId?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    notes?: string;
  }
): Promise<SupplierPayment> {
  const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const payment: SupplierPayment = {
    id: payId,
    businessId,
    supplierId: params.supplierId,
    supplierName: params.supplierName,
    purchaseOrderId: params.purchaseOrderId || '',
    amount: round2(params.amount),
    paymentDate: now,
    paymentMethod: params.paymentMethod,
    paymentReference: params.paymentReference || '',
    notes: params.notes || '',
    createdAt: now,
  };

  const localPayments = getLocalSupplierPayments(businessId);
  saveLocalSupplierPayments(businessId, [payment, ...localPayments]);

  // If tied to a specific PO, update its payment status & balance
  if (params.purchaseOrderId) {
    const localPOs = getLocalPOs(businessId);
    const poIndex = localPOs.findIndex((p) => p.id === params.purchaseOrderId);
    if (poIndex >= 0) {
      const po = localPOs[poIndex];
      const newPaid = round2(po.amountPaid + params.amount);
      const newBalance = Math.max(0, round2(po.totalAmount - newPaid));
      const payStatus: PaymentStatus = newBalance === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';

      localPOs[poIndex] = {
        ...po,
        amountPaid: newPaid,
        balanceDue: newBalance,
        paymentStatus: payStatus,
        updatedAt: now,
      };
      saveLocalPOs(businessId, localPOs);

      try {
        const poRef = doc(db, 'businesses', businessId, 'purchaseOrders', po.id);
        await withTimeout(updateDoc(poRef, { amountPaid: newPaid, balanceDue: newBalance, paymentStatus: payStatus, updatedAt: now }), 2000);
      } catch {}
    }
  }

  try {
    const docRef = doc(db, 'businesses', businessId, 'supplierPayments', payId);
    await withTimeout(setDoc(docRef, payment), 2000);
  } catch (err) {
    console.warn('Could not save supplier payment to cloud immediately:', err);
  }

  return payment;
}

export async function cancelPurchaseOrder(
  businessId: string,
  poId: string,
  reason?: string
): Promise<void> {
  const now = new Date().toISOString();
  const localPOs = getLocalPOs(businessId);
  let po = localPOs.find((p) => p.id === poId);
  if (!po) {
    try {
      const snap = await withTimeout(getDoc(doc(db, 'businesses', businessId, 'purchaseOrders', poId)), 2000);
      if (snap.exists()) {
        po = { id: snap.id, ...(snap.data() as any) };
      }
    } catch {}
  }
  if (!po) throw new Error('Purchase order not found');

  if (po.status === 'RECEIVED') {
    throw new Error('Cannot cancel a fully received purchase order. Goods have already been added to inventory.');
  }

  const updatedPOs = localPOs.map((p) => 
    p.id === poId ? { ...p, status: 'CANCELLED' as const, notes: reason ? `${p.notes || ''} [Cancelled: ${reason}]` : p.notes, updatedAt: now } : p
  );
  saveLocalPOs(businessId, updatedPOs);

  try {
    const poRef = doc(db, 'businesses', businessId, 'purchaseOrders', poId);
    await withTimeout(updateDoc(poRef, { 
      status: 'CANCELLED', 
      notes: reason ? `${po.notes || ''} [Cancelled: ${reason}]` : po.notes, 
      updatedAt: now 
    }), 2000);
  } catch (err) {
    console.warn('Could not cancel PO in cloud immediately, saved offline:', err);
  }
}

export async function updatePurchaseOrder(
  businessId: string,
  poId: string,
  updates: Partial<PurchaseOrder>
): Promise<void> {
  const now = new Date().toISOString();
  const localPOs = getLocalPOs(businessId);
  const updatedPOs = localPOs.map((p) => 
    p.id === poId ? { ...p, ...updates, updatedAt: now } : p
  );
  saveLocalPOs(businessId, updatedPOs);

  try {
    const poRef = doc(db, 'businesses', businessId, 'purchaseOrders', poId);
    await withTimeout(updateDoc(poRef, { ...updates, updatedAt: now }), 2000);
  } catch (err) {
    console.warn('Could not update PO in cloud immediately, saved offline:', err);
  }
}

export async function getSupplierPayments(businessId: string, supplierId?: string): Promise<SupplierPayment[]> {
  try {
    const colRef = collection(db, 'businesses', businessId, 'supplierPayments');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await withTimeout(getDocs(q), 2000);
    if (!snap.empty) {
      const list: SupplierPayment[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      saveLocalSupplierPayments(businessId, list);
      return supplierId ? list.filter((p) => p.supplierId === supplierId) : list;
    }
  } catch (err) {
    console.warn('Failed or timed out fetching supplier payments, loading locally:', err);
  }

  const local = getLocalSupplierPayments(businessId);
  return supplierId ? local.filter((p) => p.supplierId === supplierId) : local;
}
