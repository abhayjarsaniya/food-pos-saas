import { 
  collection, 
  doc, 
  getDocs, 
  runTransaction, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order, OrderPayment, OrderStatus, PaymentMethod, PaymentStatus } from '../../types';
import { 
  getOrdersFromIndexedDB, 
  saveOrderToIndexedDB, 
  getOfflineDB,
  markOrderSyncedInIndexedDB
} from '../offline/indexedDb';
import { round2 } from '../../utils/calculations';

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore operation timed out')), ms)
    ),
  ]);
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
      2000
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
 * Saves a bill (Draft or Open & Unpaid) both locally in IndexedDB and to Firestore
 */
export async function createOrder(
  businessId: string, 
  orderData: Omit<Order, 'id' | 'billNumber' | 'createdAt' | 'updatedAt' | 'businessId'>
): Promise<Order> {
  const billNumber = await getNextBillNumber(businessId);
  const now = new Date().toISOString();
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const order: Order = {
    ...orderData,
    id: orderId,
    billNumber,
    businessId,
    tableId: orderData.tableId || undefined,
    tableName: orderData.tableName || orderData.tableNumber || '',
    tableNumber: orderData.tableName || orderData.tableNumber || '',
    orderType: orderData.orderType || 'DINE_IN',
    extras: orderData.extras || [],
    payments: orderData.payments || [],
    status: orderData.status || 'OPEN',
    paymentStatus: orderData.paymentStatus || 'UNPAID',
    amountPaid: orderData.amountPaid ?? 0,
    balanceDue: orderData.balanceDue ?? orderData.grandTotal,
    createdAt: now,
    updatedAt: now,
    syncedWithCloud: false,
  };

  // 1. Immediately persist to local IndexedDB for zero latency & offline guarantee
  await saveOrderToIndexedDB(order);

  // 2. Try syncing to Firestore if not demo and online
  if (!isDemo(businessId)) {
    try {
      const orderDocRef = doc(db, 'businesses', businessId, 'orders', orderId);
      await withTimeout(
        setDoc(orderDocRef, {
          ...order,
          syncedWithCloud: true,
        }),
        2000
      );
      await markOrderSyncedInIndexedDB(orderId);
      order.syncedWithCloud = true;
    } catch (err) {
      console.warn('Order saved offline. Will sync when connection is established:', err);
      order.syncedWithCloud = false;
    }
  } else {
    // Demo orders are marked synced locally
    await markOrderSyncedInIndexedDB(orderId);
    order.syncedWithCloud = true;
  }

  return order;
}

/**
 * Fetch all orders for a business
 */
export async function getOrders(businessId: string): Promise<Order[]> {
  if (!isDemo(businessId)) {
    try {
      const colRef = collection(db, 'businesses', businessId, 'orders');
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snap = await withTimeout(getDocs(q), 2000);
      const cloudOrders: Order[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      for (const ord of cloudOrders) {
        await saveOrderToIndexedDB({ ...ord, syncedWithCloud: true });
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
 * Record a payment against an order (supports full or partial payments)
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
  }
): Promise<{ order: Order; payment: OrderPayment }> {
  if (params.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  // Load order from local DB
  const orders = await getOrdersFromIndexedDB();
  const existing = orders.find((o) => o.id === orderId);
  if (!existing) {
    throw new Error('Order not found');
  }

  const roundedAmount = round2(params.amount);
  if (roundedAmount > existing.balanceDue + 0.01) {
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
  const newOrderStatus: OrderStatus = newBalanceDue === 0 ? 'COMPLETED' : existing.status;

  const existingPayments = existing.payments || [];
  const updatedOrder: Order = {
    ...existing,
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    paymentStatus: newPaymentStatus,
    paymentMethod: params.paymentMethod, // last used method
    status: newOrderStatus,
    payments: [...existingPayments, payment],
    updatedAt: now,
  };

  // 1. Update in IndexedDB
  await saveOrderToIndexedDB(updatedOrder);

  // 2. Persist payment subcollection and update order doc in Firestore
  if (!isDemo(businessId)) {
    try {
      const orderDocRef = doc(db, 'businesses', businessId, 'orders', orderId);
      const paymentDocRef = doc(db, 'businesses', businessId, 'orders', orderId, 'payments', paymentId);

      await withTimeout(setDoc(paymentDocRef, payment), 2000);
      await withTimeout(
        updateDoc(orderDocRef, {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          paymentStatus: newPaymentStatus,
          status: newOrderStatus,
          paymentMethod: params.paymentMethod,
          payments: updatedOrder.payments,
          updatedAt: now,
        }),
        2000
      );
    } catch (err) {
      console.warn('Could not sync payment to cloud immediately, stored locally:', err);
    }
  }

  return { order: updatedOrder, payment };
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
  const orders = await getOrdersFromIndexedDB();
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
  const orders = await getOrdersFromIndexedDB();
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
      await withTimeout(updateDoc(orderDocRef, { ...updates, updatedAt: now }), 2000);
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
    existing.voidReason = voidReason.trim();
    existing.updatedAt = now;
    existing.syncedWithCloud = false;
    await saveOrderToIndexedDB(existing);
  }

  // Update in Firestore
  if (!isDemo(businessId)) {
    try {
      const orderDocRef = doc(db, 'businesses', businessId, 'orders', orderId);
      await withTimeout(
        setDoc(orderDocRef, {
          status: 'VOIDED' as OrderStatus,
          voidReason: voidReason.trim(),
          updatedAt: now,
          syncedWithCloud: true,
        }, { merge: true }),
        2000
      );

      if (existing) {
        await markOrderSyncedInIndexedDB(orderId);
      }
    } catch (err) {
      console.warn('Order voided locally, will sync when online:', err);
    }
  }
}
