import { auth, db } from '../src/services/firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { 
  createOrder, 
  recordOrderPayment, 
  getOrders, 
  subscribeToOrders, 
  isEligiblePendingPayment, 
  normalizeOrderStatus, 
  normalizePaymentStatus,
  sanitizeFirestoreData 
} from '../src/services/orders/orderService';
import { calculateTableStatuses } from '../src/services/tables/tableService';
import { Order, OrderItem, RestaurantTable } from '../src/types';

async function runAcceptanceTests() {
  console.log('========================================================================');
  console.log('🔥 FOOD POS E2E: LIVE DATA ACCEPTANCE TESTS (TESTS A - F)');
  console.log('========================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // Authenticate as Prince Pavbhaji Shop Owner
  const email = 'princebhajipav16@gmail.com';
  const pass = 'OwnerPass@2026';
  const businessId = 'biz_prince_pavbhaji_01';

  console.log('\n[AUTH] Signing in as Prince Pavbhaji owner...');
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  assert(cred.user.email === email, `Authenticated as ${email}`);

  // Clean slate: fetch existing orders before test
  const initialOrders = await getOrders(businessId);
  console.log(`Initial orders count in Firestore: ${initialOrders.length}`);
  const initialPendingCount = initialOrders.filter(o => isEligiblePendingPayment(o)).length;
  console.log(`Initial pending orders count: ${initialPendingCount}`);

  // In-memory simulation of OrdersContext
  let contextOrders: Order[] = [...initialOrders];

  function simulateOrderContext(newOrder: Order) {
    const idx = contextOrders.findIndex(o => o.id === newOrder.id);
    if (idx >= 0) {
      contextOrders[idx] = { ...contextOrders[idx], ...newOrder };
    } else {
      contextOrders = [newOrder, ...contextOrders];
    }
  }

  const createdOrderIds: string[] = [];
  const createdPaymentIds: { orderId: string; payId: string }[] = [];

  // -------------------------------------------------------------------------
  // TEST A: Create an unpaid bill for ₹500
  // -------------------------------------------------------------------------
  console.log('\n--- TEST A: Create Unpaid Bill for ₹500 ---');
  const itemsA: OrderItem[] = [
    {
      productId: 'prod_bhajipav_butter',
      productName: 'Butter Bhajipav',
      variantId: 'var_butter',
      variantName: 'Butter',
      unitPrice: 180,
      quantity: 2,
      subtotal: 360,
      gstAmount: 18,
      cgstAmount: 9,
      sgstAmount: 9,
      total: 378,
    },
    {
      productId: 'prod_masala_pav',
      productName: 'Butter Masala Pav',
      variantId: 'var_single',
      variantName: 'Single',
      unitPrice: 60,
      quantity: 2,
      subtotal: 120,
      gstAmount: 2,
      cgstAmount: 1,
      sgstAmount: 1,
      total: 122,
    },
  ];
  // Grand total: 378 + 122 = 500

  const orderA = await createOrder(businessId, {
    customer: { name: 'Aarav Shah', phone: '9876500001' },
    tableId: 'tbl_window_01',
    tableName: 'Window 01',
    tableNumber: 'Window 01',
    orderType: 'DINE_IN',
    items: itemsA,
    extras: [],
    subtotal: 480,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    taxableAmount: 480,
    gstAmount: 20,
    cgstAmount: 10,
    sgstAmount: 10,
    igstAmount: 0,
    grandTotal: 500,
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
    amountPaid: 0,
    balanceDue: 500,
    status: 'OPEN',
    taxConfigSnapshot: {
      enabled: true,
      gstin: '24AAACP1234F1Z5',
      pricingMode: 'exclusive',
      defaultGstRate: 5,
    },
  });
  createdOrderIds.push(orderA.id);
  simulateOrderContext(orderA);

  // Assertions for TEST A
  assert(orderA.grandTotal === 500, 'TEST A: Grand total is ₹500');
  assert(orderA.balanceDue === 500, 'TEST A: Balance due is ₹500');
  assert(orderA.syncedWithCloud === true, 'TEST A: Confirmed saved to cloud (syncedWithCloud = true)');

  // Verify direct Firestore existence
  const snapA = await getDoc(doc(db, 'businesses', businessId, 'orders', orderA.id));
  assert(snapA.exists(), `TEST A: Firestore document exists at businesses/${businessId}/orders/${orderA.id}`);
  const dataA = snapA.data() as any;
  assert(dataA.billNumber === orderA.billNumber, `TEST A: Firestore billNumber matches: ${dataA.billNumber}`);
  assert(dataA.orderStatus === 'Open', `TEST A: Canonical orderStatus is 'Open'`);
  assert(dataA.paymentStatus === 'UNPAID', `TEST A: Payment status is UNPAID`);
  assert(isEligiblePendingPayment(dataA), 'TEST A: Order is eligible for Pending Payments');

  // Verify Pending count
  const pendingCountA = contextOrders.filter(o => isEligiblePendingPayment(o)).length;
  assert(pendingCountA === initialPendingCount + 1, `TEST A: Sidebar badge increased by one (${pendingCountA})`);

  // -------------------------------------------------------------------------
  // TEST B: Click Start Next Bill and create another unpaid bill
  // -------------------------------------------------------------------------
  console.log('\n--- TEST B: Create Second Unpaid Bill after Start Next Bill ---');
  // First bill remains visible in context
  assert(contextOrders.some(o => o.id === orderA.id), 'TEST B: First bill remains in state');

  const itemsB: OrderItem[] = [
    {
      productId: 'prod_cheese_butter_bhajipav',
      productName: 'Special Cheese Butter Bhajipav',
      variantId: 'var_cheese_butter',
      variantName: 'Cheese Butter',
      unitPrice: 220,
      quantity: 1,
      subtotal: 220,
      gstAmount: 10,
      cgstAmount: 5,
      sgstAmount: 5,
      total: 230,
    },
  ];

  const orderB = await createOrder(businessId, {
    customer: { name: 'Priya Mehta', phone: '9876500002' },
    tableId: 'tbl_table_02',
    tableName: 'Table 02',
    tableNumber: 'Table 02',
    orderType: 'DINE_IN',
    items: itemsB,
    extras: [],
    subtotal: 220,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    taxableAmount: 220,
    gstAmount: 10,
    cgstAmount: 5,
    sgstAmount: 5,
    igstAmount: 0,
    grandTotal: 230,
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
    amountPaid: 0,
    balanceDue: 230,
    status: 'OPEN',
    taxConfigSnapshot: {
      enabled: true,
      gstin: '24AAACP1234F1Z5',
      pricingMode: 'exclusive',
      defaultGstRate: 5,
    },
  });
  createdOrderIds.push(orderB.id);
  simulateOrderContext(orderB);

  // Assertions for TEST B
  const snapB = await getDoc(doc(db, 'businesses', businessId, 'orders', orderB.id));
  assert(snapB.exists(), 'TEST B: Second bill document exists in Firestore');
  assert(contextOrders.some(o => o.id === orderA.id), 'TEST B: First bill is still visible');
  assert(contextOrders.some(o => o.id === orderB.id), 'TEST B: Second bill is visible immediately');

  const pendingCountB = contextOrders.filter(o => isEligiblePendingPayment(o)).length;
  assert(pendingCountB === initialPendingCount + 2, `TEST B: Pending count increased to ${pendingCountB}`);

  // -------------------------------------------------------------------------
  // TEST C: Save a partially paid bill
  // -------------------------------------------------------------------------
  console.log('\n--- TEST C: Save Partially Paid Bill (₹600 total, ₹200 paid upfront) ---');
  const itemsC: OrderItem[] = [
    {
      productId: 'prod_pulav_butter',
      productName: 'Butter Pulav',
      variantId: 'var_butter',
      variantName: 'Butter',
      unitPrice: 200,
      quantity: 3,
      subtotal: 600,
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      total: 600,
    },
  ];

  const orderC = await createOrder(businessId, {
    customer: { name: 'Karan Dave', phone: '9876500003' },
    tableId: 'tbl_table_03',
    tableName: 'Table 03',
    tableNumber: 'Table 03',
    orderType: 'DINE_IN',
    items: itemsC,
    extras: [],
    subtotal: 600,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    taxableAmount: 600,
    gstAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    grandTotal: 600,
    paymentMethod: 'UPI',
    paymentStatus: 'PARTIAL',
    amountPaid: 200,
    balanceDue: 400,
    status: 'OPEN',
    taxConfigSnapshot: {
      enabled: true,
      gstin: '24AAACP1234F1Z5',
      pricingMode: 'exclusive',
      defaultGstRate: 5,
    },
  });
  createdOrderIds.push(orderC.id);
  simulateOrderContext(orderC);

  // Assertions for TEST C
  assert(orderC.amountPaid === 200, 'TEST C: Amount paid upfront is ₹200');
  assert(orderC.balanceDue === 400, 'TEST C: Balance due is ₹400');
  assert(orderC.paymentStatus === 'PARTIAL', 'TEST C: Payment status is PARTIAL');

  const snapC = await getDoc(doc(db, 'businesses', businessId, 'orders', orderC.id));
  assert(snapC.exists(), 'TEST C: Partially paid bill exists in Firestore');
  const dataC = snapC.data() as any;
  assert(dataC.balanceDue === 400, 'TEST C: Firestore record balanceDue is 400');
  assert(dataC.amountPaid === 200, 'TEST C: Firestore record amountPaid is 200');
  assert(isEligiblePendingPayment(dataC), 'TEST C: Partially paid bill is eligible for Pending Payments');

  // -------------------------------------------------------------------------
  // TEST D: Receive full payment on Bill A (₹500)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST D: Receive Full Payment on Bill A (₹500) ---');
  const { order: completedA, payment: payA } = await recordOrderPayment(businessId, orderA.id, {
    amount: 500,
    paymentMethod: 'CASH',
    receivedBy: 'owner',
    receivedByName: 'Prince Owner',
    notes: 'Paid in cash at counter',
  });
  createdPaymentIds.push({ orderId: orderA.id, payId: payA.id });
  simulateOrderContext(completedA);

  assert(completedA.amountPaid === 500, 'TEST D: Completed bill amountPaid is ₹500');
  assert(completedA.balanceDue === 0, 'TEST D: Completed bill balanceDue is ₹0');
  assert(completedA.paymentStatus === 'PAID', 'TEST D: Completed bill paymentStatus is PAID');
  assert(completedA.status === 'COMPLETED', 'TEST D: Completed bill status is COMPLETED');

  // Verify Firestore updated
  const snapAfterPaidA = await getDoc(doc(db, 'businesses', businessId, 'orders', orderA.id));
  const dataPaidA = snapAfterPaidA.data() as any;
  assert(dataPaidA.balanceDue === 0, 'TEST D: Firestore balanceDue is 0');
  assert(dataPaidA.paymentStatus === 'PAID', 'TEST D: Firestore paymentStatus is PAID');
  assert(!isEligiblePendingPayment(dataPaidA), 'TEST D: Bill A is NO LONGER eligible for Pending Payments');

  // Bill A remains in order history
  assert(contextOrders.some(o => o.id === orderA.id), 'TEST D: Bill A remains in Order History');

  // Pending count decreased (Order A paid, Order B and Order C remain pending)
  const pendingCountD = contextOrders.filter(o => isEligiblePendingPayment(o)).length;
  assert(pendingCountD === initialPendingCount + 3 - 1, `TEST D: Badge count decreased correctly (${pendingCountD})`);

  // -------------------------------------------------------------------------
  // TEST E: Refresh the application and retrieve from Firestore
  // -------------------------------------------------------------------------
  console.log('\n--- TEST E: Fresh Retrieval from Firestore (Simulating Refresh) ---');
  const refreshedOrders = await getOrders(businessId);
  assert(refreshedOrders.some(o => o.id === orderA.id), 'TEST E: Order A retrieved on fresh query');
  assert(refreshedOrders.some(o => o.id === orderB.id), 'TEST E: Order B retrieved on fresh query');
  assert(refreshedOrders.some(o => o.id === orderC.id), 'TEST E: Order C retrieved on fresh query');

  // Check no duplicates exist
  const idCounts = new Map<string, number>();
  for (const o of refreshedOrders) {
    idCounts.set(o.id, (idCounts.get(o.id) || 0) + 1);
  }
  let duplicatesFound = false;
  for (const [id, count] of idCounts.entries()) {
    if (count > 1) duplicatesFound = true;
  }
  assert(!duplicatesFound, 'TEST E: No duplicate order records in Firestore query');

  // -------------------------------------------------------------------------
  // TEST F: Direct onSnapshot Subscription (Live Pending Payments View)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST F: Real-Time onSnapshot Direct Subscription ---');
  await new Promise<void>((resolve, reject) => {
    const unsub = subscribeToOrders(
      businessId,
      (liveOrders) => {
        assert(liveOrders.length >= 3, `TEST F: Live orders stream received ${liveOrders.length} orders`);
        const livePending = liveOrders.filter(o => isEligiblePendingPayment(o));
        assert(livePending.some(o => o.id === orderB.id), 'TEST F: Order B visible in real-time pending dues');
        assert(livePending.some(o => o.id === orderC.id), 'TEST F: Order C visible in real-time pending dues');
        assert(!livePending.some(o => o.id === orderA.id), 'TEST F: Paid Order A NOT in live pending dues');
        unsub();
        resolve();
      },
      (err) => {
        unsub();
        reject(err);
      }
    );
  });

  // -------------------------------------------------------------------------
  // CLEANUP TEST ORDERS
  // -------------------------------------------------------------------------
  console.log('\n[CLEANUP] Cleaning up test orders and payment documents...');
  for (const p of createdPaymentIds) {
    try {
      await deleteDoc(doc(db, 'businesses', businessId, 'orders', p.orderId, 'payments', p.payId));
    } catch {}
  }
  for (const id of createdOrderIds) {
    try {
      await deleteDoc(doc(db, 'businesses', businessId, 'orders', id));
    } catch {}
  }
  console.log('Cleanup completed cleanly.');

  console.log('\n========================================================================');
  console.log(`ACCEPTANCE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('FATAL ACCEPTANCE ERROR:', err);
  process.exit(1);
});
