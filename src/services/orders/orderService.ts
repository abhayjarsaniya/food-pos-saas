import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  runTransaction, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order, OrderPayment, OrderStatus, PaymentMethod, PaymentStatus, KitchenOrderStatus } from '../../types';
import { 
  getOrdersFromIndexedDB, 
  saveOrderToIndexedDB, 
  getOfflineDB,
  markOrderSyncedInIndexedDB
} from '../offline/indexedDb';
import { round2 } from '../../utils/calculations';
import { logActivity } from '../activity/activityService';

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore operation timed out')), ms)
    ),
  ]);
}

/**
 * Recursively removes undefined fields and converts undefined to null,
 * guaranteeing Firestore setDoc and updateDoc never fail with unsupported field value errors.
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFirestoreData(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value === undefined) {
      clean[key] = null;
    } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      clean[key] = sanitizeFirestoreData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean as T;
}

/**
 * Normalizes payment statuses across case, legacy values, and variations to canonical values:
 * 'Unpaid' | 'Partially Paid' | 'Paid'
 */
export function normalizePaymentStatus(status: any): 'Unpaid' | 'Partially Paid' | 'Paid' {
  if (!status) return 'Unpaid';
  const s = String(status).trim().toUpperCase();
  if (s === 'PAID') return 'Paid';
  if (s === 'PARTIAL' || s === 'PARTIALLY_PAID' || s === 'PARTIALLY PAID' || s === 'PARTIALLY-PAID') return 'Partially Paid';
  return 'Unpaid';
}

/**
 * Normalizes order statuses across case, legacy values, and variations to canonical values:
 * 'Draft' | 'Open' | 'Completed' | 'Cancelled'
 */
export function normalizeOrderStatus(status: any): 'Draft' | 'Open' | 'Completed' | 'Cancelled' {
  if (!status) return 'Open';
  const s = String(status).trim().toUpperCase();
  if (s === 'COMPLETED') return 'Completed';
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'VOIDED') return 'Cancelled';
  if (s === 'DRAFT') return 'Draft';
  return 'Open';
}

/**
 * Determines strictly whether an order record is eligible to appear in Pending Payments.
 * Requirement 5:
 *   - paymentStatus is 'Unpaid' or 'Partially Paid'
 *   - Excludes fully paid orders (balanceDue <= 0 or Paid)
 *   - Excludes cancelled orders
 *   - Order status and payment status are treated independently (Open or Completed does not block unpaid dues)
 */
export function isEligiblePendingPayment(order: any): boolean {
  if (!order) return false;

  const ordStatus = normalizeOrderStatus(order.orderStatus || order.status);
  if (ordStatus === 'Cancelled') return false;

  const payStatus = normalizePaymentStatus(order.canonicalPaymentStatus || order.paymentStatus);
  if (payStatus === 'Paid') return false;

  const grandTotal = typeof order.grandTotal === 'number' ? order.grandTotal : parseFloat(order.grandTotal) || 0;
  const amountPaid = typeof order.amountPaid === 'number' ? order.amountPaid : parseFloat(order.amountPaid) || 0;
  const balanceDue = order.balanceDue !== undefined && order.balanceDue !== null
    ? (typeof order.balanceDue === 'number' ? order.balanceDue : parseFloat(order.balanceDue) || 0)
    : Math.max(0, grandTotal - amountPaid);

  if (balanceDue <= 0) return false;

  return payStatus === 'Unpaid' || payStatus === 'Partially Paid';
}

/**
 * Dispatches an immediate event to synchronize in-memory React state
 * across all mounted contexts without waiting for asynchronous network roundtrips.
 */
export function onOrderSaved(order: Order): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('food_pos_order_saved', { detail: order }));
  }
}

function isDemo(_businessId: string): boolean {
  return false;
}

/**
 * Generates an atomically incremented bill number or offline fallback
 */
export async function getNextBillNumber(businessId: string): Promise<string> {
  if (isDemo(businessId)) {
    const localOrders = await getOrdersFromIndexedDB();
    const count = 1001 + localOrders.length;
    return `BILL-${count}`;
  }

  const counterRef = doc(db, 'businesses', businessId, 'meta', 'counters');
  
  try {
    const nextNum = await withTimeout(
      runTransaction(db, async (transaction) => {
        const snap = await transaction.get(counterRef);
        let currentNumber = 1001;
        let prefix = 'BILL-';

        if (snap.exists()) {
          const data = snap.data();
          currentNumber = (data.lastBillNumber || 1000) + 1;
          prefix = data.prefix || 'BILL-';
        }

        transaction.set(counterRef, {
          lastBillNumber: currentNumber,
          prefix: prefix,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        return `${prefix}${currentNumber}`;
      }),
      3000
    );

    return nextNum;
  } catch (err) {
    console.warn('Network unavailable for bill number transaction, generating offline bill number:', err);
    const localOrders = await getOrdersFromIndexedDB();
    const count = localOrders.length + 1001;
    const rand = Math.floor(100 + Math.random() * 900);
    return `BILL-${count}-${rand}`;
  }
}

/**
 * Saves a bill (Draft, Open & Unpaid, or Paid) both to Firestore and IndexedDB
 */
export async function createOrder(
  businessId: string, 
  orderData: Omit<Order, 'id' | 'billNumber' | 'createdAt' | 'updatedAt' | 'businessId'>
): Promise<Order> {
  const billNumber = await getNextBillNumber(businessId);
  const now = new Date().toISOString();
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const grandTotal = round2(orderData.grandTotal || 0);
  const amountPaid = round2(orderData.amountPaid || 0);
  const balanceDue = Math.max(0, round2(grandTotal - amountPaid));

  // Determine exact statuses
  let paymentStatus: PaymentStatus = 'UNPAID';
  let canonicalPaymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid' = 'Unpaid';
  if (amountPaid >= grandTotal && grandTotal > 0) {
    paymentStatus = 'PAID';
    canonicalPaymentStatus = 'Paid';
  } else if (amountPaid > 0) {
    paymentStatus = 'PARTIAL';
    canonicalPaymentStatus = 'Partially Paid';
  }

  let status: OrderStatus = orderData.status || (paymentStatus === 'PAID' ? 'COMPLETED' : 'OPEN');
  const orderStatusStr: 'Draft' | 'Open' | 'Completed' | 'Cancelled' = 
    status === 'COMPLETED' ? 'Completed' : status === 'CANCELLED' || status === 'VOIDED' ? 'Cancelled' : status === 'DRAFT' ? 'Draft' : 'Open';

  const subtotal = round2(orderData.subtotal || 0);
  const discountVal = round2(orderData.discountAmount || (orderData as any).discount || 0);
  const taxVal = round2(orderData.gstAmount || (orderData as any).tax || 0);
  const customerId = orderData.customer?.phone || (orderData as any).customerId || null;
  const customerName = orderData.customer?.name || (orderData as any).customerName || null;
  const tableId = orderData.tableId || null;
  const tableName = orderData.tableName || orderData.tableNumber || null;

  const itemsWithKitchenStatus = (orderData.items || []).map((it) => ({
    ...it,
    kitchenStatus: it.kitchenStatus || 'NEW' as KitchenOrderStatus,
  }));

  const order: Order = {
    ...orderData,
    id: orderId,
    orderId,
    billNumber,
    businessId,
    items: itemsWithKitchenStatus,
    extras: orderData.extras || [],
    payments: orderData.payments || [],
    subtotal,
    discount: discountVal,
    discountAmount: discountVal,
    tax: taxVal,
    gstAmount: taxVal,
    grandTotal,
    amountPaid,
    balanceDue,
    status,
    orderStatus: orderStatusStr,
    kitchenStatus: orderData.kitchenStatus || ('NEW' as KitchenOrderStatus),
    paymentStatus,
    canonicalPaymentStatus,
    paymentMethod: orderData.paymentMethod || 'CASH',
    paymentMethodSummary: orderData.paymentMethod || 'CASH',
    customerId,
    customerName,
    tableId,
    tableName,
    tableNumber: tableName,
    orderType: orderData.orderType || 'DINE_IN',
    createdBy: orderData.createdBy || 'cashier',
    createdByName: orderData.createdByName || 'Counter Cashier',
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    syncedWithCloud: false,
  };

  // If initial payment was made upfront, add payment record
  if (amountPaid > 0) {
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const initialPayment: OrderPayment = {
      id: paymentId,
      orderId,
      businessId,
      amount: amountPaid,
      paymentMethod: orderData.paymentMethod || 'CASH',
      receivedBy: orderData.createdBy || 'cashier',
      receivedByName: orderData.createdByName || 'Counter Cashier',
      receivedAt: now,
      notes: 'Initial payment recorded at bill creation',
    };
    order.payments = [initialPayment];
  }

  // 1. Immediately cache to local IndexedDB for zero latency & offline resilience
  await saveOrderToIndexedDB(order);

  // 2. Persist to Firestore: businesses/{businessId}/orders/{orderId}
  if (!isDemo(businessId)) {
    try {
      const orderDocRef = doc(db, 'businesses', businessId, 'orders', orderId);
      const sanitizedDoc = sanitizeFirestoreData({
        ...order,
        syncedWithCloud: true,
      });

      await withTimeout(
        setDoc(orderDocRef, sanitizedDoc),
        8000
      );

      // If initial payment exists, save subcollection document
      if (order.payments && order.payments.length > 0) {
        const payment = order.payments[0];
        const payRef = doc(db, 'businesses', businessId, 'orders', orderId, 'payments', payment.id);
        await setDoc(payRef, sanitizeFirestoreData(payment)).catch(() => {});
      }

      await markOrderSyncedInIndexedDB(orderId);
      order.syncedWithCloud = true;
      onOrderSaved(order);
    } catch (err: any) {
      console.error('Firestore save failed:', err);
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        throw new Error(`Failed to save bill to cloud database: ${err.message || 'Write timed out or was rejected'}`);
      }
      order.syncedWithCloud = false;
      onOrderSaved(order);
    }
  } else {
    await markOrderSyncedInIndexedDB(orderId);
    order.syncedWithCloud = true;
    onOrderSaved(order);
  }

  return order;

  return order;
}

/**
 * Real-time listener for all orders of a business.
 * Updates immediately when any order is created, modified, or payment is recorded.
 */
export function subscribeToOrders(
  businessId: string,
  callback: (orders: Order[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!businessId) {
    callback([]);
    return () => {};
  }

  const colRef = collection(db, 'businesses', businessId, 'orders');
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const cloudOrders: Order[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          orderId: docSnap.id,
          ...(data as any),
          syncedWithCloud: true,
        };
      });

      // Synchronize into IndexedDB cache in background
      for (const ord of cloudOrders) {
        saveOrderToIndexedDB(ord).catch(() => {});
      }

      callback(cloudOrders);
    },
    (err) => {
      console.warn('Firestore orders onSnapshot failed or timed out, reading local fallback:', err);
      if (onError) onError(err);
      getOrdersFromIndexedDB().then((local) => {
        callback(
          local
            .filter((o) => !o.businessId || o.businessId === businessId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
      });
    }
  );
}

/**
 * Fetch all orders for a business
 */
export async function getOrders(businessId: string): Promise<Order[]> {
  if (!isDemo(businessId)) {
    try {
      const colRef = collection(db, 'businesses', businessId, 'orders');
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snap = await withTimeout(getDocs(q), 6000);
      const cloudOrders: Order[] = snap.docs.map(d => ({ 
        id: d.id, 
        orderId: d.id, 
        ...(d.data() as any), 
        syncedWithCloud: true 
      }));

      for (const ord of cloudOrders) {
        await saveOrderToIndexedDB(ord);
      }
      return cloudOrders;
    } catch (err) {
      console.warn('Could not fetch cloud orders or timed out, returning local IndexedDB orders:', err);
    }
  }
  const local = await getOrdersFromIndexedDB();
  return local
    .filter((o) => !o.businessId || o.businessId === businessId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Record a payment against an order (supports full or partial payments).
 * Atomically updates order balance and writes to payments subcollection.
 */
export async function recordOrderPayment(
  businessId: string,
  orderId: string,
  params: {
    amount: number;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    receivedBy: string;
    receivedByName?: string;
    notes?: string;
    memberPermissions?: {
      canCollectPayment?: boolean;
      collectCash?: boolean;
      collectUpi?: boolean;
      collectCard?: boolean;
      collectOther?: boolean;
      partialPayment?: boolean;
      [key: string]: any;
    };
  }
): Promise<{ order: Order; payment: OrderPayment }> {
  if (params.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  // Enforce payment collection permissions at service boundary
  if (params.memberPermissions) {
    if (params.memberPermissions.canCollectPayment === false) {
      throw new Error('Permission Denied: Your staff account is not authorized to collect customer payments.');
    }
    if (params.paymentMethod === 'CASH' && params.memberPermissions.collectCash === false) {
      throw new Error('Permission Denied: Your staff account is not authorized to collect Cash payments.');
    }
    if (params.paymentMethod === 'UPI' && params.memberPermissions.collectUpi === false) {
      throw new Error('Permission Denied: Your staff account is not authorized to collect UPI payments.');
    }
    if (params.paymentMethod === 'CARD' && params.memberPermissions.collectCard === false) {
      throw new Error('Permission Denied: Your staff account is not authorized to collect Card payments.');
    }
  }

  // 1. Fetch current order from Firestore first (or IndexedDB if offline)
  let existing: Order | null = null;
  const orderDocRef = doc(db, 'businesses', businessId, 'orders', orderId);

  try {
    const snap = await withTimeout(getDoc(orderDocRef), 3000);
    if (snap.exists()) {
      existing = { id: snap.id, ...(snap.data() as any) };
    }
  } catch {}

  if (!existing) {
    const localOrders = await getOrdersFromIndexedDB();
    existing = localOrders.find((o) => o.id === orderId) || null;
  }

  if (!existing) {
    throw new Error('Order not found');
  }

  const roundedAmount = round2(params.amount);
  if (roundedAmount > existing.balanceDue + 0.05) {
    throw new Error(`Payment ₹${roundedAmount} cannot exceed the outstanding balance of ₹${existing.balanceDue}`);
  }

  const now = new Date().toISOString();
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const payment: OrderPayment = {
    id: paymentId,
    orderId,
    businessId,
    amount: roundedAmount,
    paymentMethod: params.paymentMethod,
    paymentReference: params.paymentReference || '',
    receivedBy: params.receivedBy,
    receivedByName: params.receivedByName || '',
    receivedAt: now,
    notes: params.notes || '',
  };

  const newAmountPaid = round2((existing.amountPaid || 0) + roundedAmount);
  const newBalanceDue = Math.max(0, round2(existing.grandTotal - newAmountPaid));
  const newPaymentStatus: PaymentStatus = newBalanceDue === 0 ? 'PAID' : 'PARTIAL';
  const newCanonicalPaymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid' = 
    newBalanceDue === 0 ? 'Paid' : 'Partially Paid';
  const newOrderStatus: OrderStatus = newBalanceDue === 0 ? 'COMPLETED' : existing.status;

  const existingPayments = existing.payments || [];
  const updatedOrderStatusStr = newOrderStatus === 'COMPLETED' ? 'Completed' : 'Open';

  const updatedOrder: Order = {
    ...existing,
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    paymentStatus: newPaymentStatus,
    canonicalPaymentStatus: newCanonicalPaymentStatus,
    paymentMethod: params.paymentMethod, // last used method
    paymentMethodSummary: params.paymentMethod,
    status: newOrderStatus,
    orderStatus: updatedOrderStatusStr,
    payments: [...existingPayments, payment],
    updatedAt: now,
    syncedWithCloud: true,
  };

  // 1. Update in IndexedDB
  await saveOrderToIndexedDB(updatedOrder);

  // 2. Persist payment subcollection and update order doc in Firestore
  if (!isDemo(businessId)) {
    try {
      const paymentDocRef = doc(db, 'businesses', businessId, 'orders', orderId, 'payments', paymentId);
      const updatePayload = sanitizeFirestoreData({
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        paymentStatus: newPaymentStatus,
        canonicalPaymentStatus: newCanonicalPaymentStatus,
        status: newOrderStatus,
        orderStatus: updatedOrderStatusStr,
        paymentMethod: params.paymentMethod,
        paymentMethodSummary: params.paymentMethod,
        payments: updatedOrder.payments,
        updatedAt: now,
      });

      await Promise.all([
        setDoc(paymentDocRef, sanitizeFirestoreData(payment)),
        updateDoc(orderDocRef, updatePayload)
      ]);
    } catch (err: any) {
      console.warn('Could not sync payment to cloud immediately, stored locally:', err);
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        throw new Error(`Failed to record payment in cloud database: ${err.message || 'Network timeout or permission error'}`);
      }
    }
  }

  logActivity({
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    businessId,
    action: `Payment Recorded: ₹${roundedAmount} via ${params.paymentMethod} for Bill #${existing.billNumber}`,
    module: 'PAYMENTS',
    performedBy: params.receivedByName || params.receivedBy,
    details: { orderId, billNumber: existing.billNumber, amount: roundedAmount, method: params.paymentMethod, balanceDue: newBalanceDue },
    createdAt: now,
  });

  onOrderSaved(updatedOrder);
  return { order: updatedOrder, payment };
}

/**
 * Updates Kitchen preparation status independently of payment/order financial status.
 * Life cycle: NEW -> ACCEPTED -> PREPARING -> READY -> SERVED
 */
export async function updateOrderKitchenStatus(
  businessId: string,
  orderId: string,
  kitchenStatus: KitchenOrderStatus,
  options?: {
    itemIndex?: number;
    itemStatus?: KitchenOrderStatus;
    performedBy?: string;
    notes?: string;
  }
): Promise<Order> {
  let existing: Order | null = null;
  const orderDocRef = doc(db, 'businesses', businessId, 'orders', orderId);

  try {
    const snap = await withTimeout(getDoc(orderDocRef), 3000);
    if (snap.exists()) {
      existing = { id: snap.id, ...(snap.data() as any) };
    }
  } catch {}

  if (!existing) {
    const localOrders = await getOrdersFromIndexedDB();
    existing = localOrders.find((o) => o.id === orderId) || null;
  }

  if (!existing) {
    throw new Error('Order not found');
  }

  const now = new Date().toISOString();
  const updatedItems = [...existing.items];

  // Update specific item if itemIndex provided
  if (options?.itemIndex !== undefined && updatedItems[options.itemIndex]) {
    updatedItems[options.itemIndex] = {
      ...updatedItems[options.itemIndex],
      kitchenStatus: options.itemStatus || kitchenStatus,
    };
  } else {
    // Update all items when changing whole order preparation status
    for (let i = 0; i < updatedItems.length; i++) {
      updatedItems[i] = {
        ...updatedItems[i],
        kitchenStatus,
      };
    }
  }

  const timestamps: Partial<Order> = {};
  if (kitchenStatus === 'ACCEPTED') timestamps.kitchenAcceptedAt = now;
  else if (kitchenStatus === 'PREPARING') timestamps.kitchenPreparingAt = now;
  else if (kitchenStatus === 'READY') timestamps.kitchenReadyAt = now;
  else if (kitchenStatus === 'SERVED') timestamps.kitchenServedAt = now;

  const updatedOrder: Order = {
    ...existing,
    kitchenStatus,
    items: updatedItems,
    kitchenNotes: options?.notes !== undefined ? options.notes : existing.kitchenNotes,
    ...timestamps,
    updatedAt: now,
  };

  // 1. Update IndexedDB
  await saveOrderToIndexedDB(updatedOrder);

  // 2. Persist to Firestore
  if (!isDemo(businessId)) {
    try {
      const payload = sanitizeFirestoreData({
        kitchenStatus,
        items: updatedItems,
        kitchenNotes: updatedOrder.kitchenNotes || null,
        ...timestamps,
        updatedAt: now,
      });
      await withTimeout(updateDoc(orderDocRef, payload), 3000);
    } catch (err) {
      console.warn('Could not sync kitchen status to cloud immediately:', err);
    }
  }

  // 3. Log Activity
  logActivity({
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    businessId,
    action: `Kitchen Order #${existing.billNumber} marked ${kitchenStatus}`,
    module: 'KITCHEN',
    performedBy: options?.performedBy || 'Kitchen Staff',
    details: { orderId, billNumber: existing.billNumber, kitchenStatus },
    createdAt: now,
  });

  onOrderSaved(updatedOrder);
  return updatedOrder;
}

/**
 * One-tap full payment receipt action for Owner / authorized members
 */
export async function markOrderReceived(
  businessId: string,
  orderId: string,
  paymentMethod: PaymentMethod = 'CASH',
  receivedBy = 'owner',
  receivedByName = 'Owner'
): Promise<Order> {
  const orders = await getOrders(businessId);
  const existing = orders.find((o) => o.id === orderId);
  if (!existing) {
    throw new Error('Order not found');
  }

  if (existing.balanceDue <= 0) {
    return existing; // already paid
  }

  const { order } = await recordOrderPayment(businessId, orderId, {
    amount: existing.balanceDue,
    paymentMethod,
    receivedBy,
    receivedByName,
    notes: 'Quick mark as received by owner',
  });

  return order;
}

/**
 * Update an editable open/draft order
 */
export async function updateOrder(
  businessId: string,
  orderId: string,
  updates: Partial<Order>
): Promise<Order> {
  const orders = await getOrders(businessId);
  const existing = orders.find((o) => o.id === orderId);
  if (!existing) throw new Error('Order not found');

  const now = new Date().toISOString();
  const updated: Order = {
    ...existing,
    ...updates,
    updatedAt: now,
  };

  await saveOrderToIndexedDB(updated);

  if (!isDemo(businessId)) {
    try {
      const orderDocRef = doc(db, 'businesses', businessId, 'orders', orderId);
      const sanitizedUpdates = sanitizeFirestoreData({ ...updates, updatedAt: now });
      await withTimeout(updateDoc(orderDocRef, sanitizedUpdates), 5000);
    } catch (err) {
      console.warn('Could not sync order updates to cloud immediately:', err);
    }
  }

  return updated;
}

/**
 * Void an existing order with a mandatory reason
 */
export async function voidOrder(businessId: string, orderId: string, voidReason: string): Promise<void> {
  if (!voidReason || voidReason.trim().length === 0) {
    throw new Error('A void reason is strictly mandatory to void an order.');
  }

  const now = new Date().toISOString();

  // Update in local IndexedDB
  const orders = await getOrdersFromIndexedDB();
  const existing = orders.find((o) => o.id === orderId);
  if (existing) {
    existing.status = 'VOIDED';
    existing.orderStatus = 'Cancelled';
    existing.voidReason = voidReason.trim();
    existing.updatedAt = now;
    existing.syncedWithCloud = false;
    await saveOrderToIndexedDB(existing);
  }

  // Update in Firestore
  if (!isDemo(businessId)) {
    try {
      const orderDocRef = doc(db, 'businesses', businessId, 'orders', orderId);
      const voidPayload = sanitizeFirestoreData({
        status: 'VOIDED' as OrderStatus,
        orderStatus: 'Cancelled',
        voidReason: voidReason.trim(),
        updatedAt: now,
        syncedWithCloud: true,
      });

      await withTimeout(
        setDoc(orderDocRef, voidPayload, { merge: true }),
        5000
      );

      if (existing) {
        await markOrderSyncedInIndexedDB(orderId);
      }
    } catch (err) {
      console.warn('Order voided locally, will sync when online:', err);
    }
  }
}
