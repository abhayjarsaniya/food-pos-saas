import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import { auth, db } from '../src/services/firebase/config';
import { 
  createOrder, 
  recordOrderPayment, 
  sanitizeFirestoreData, 
  normalizePaymentStatus, 
  normalizeOrderStatus 
} from '../src/services/orders/orderService';
import { Order, OrderItem } from '../src/types';

async function runAcceptanceTests() {
  console.log('========================================================================');
  console.log('🚀 FOOD POS ACCEPTANCE: INSTANT BILL SAVING + PENDING PAYMENTS + NO SYNC BAR');
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

  // --- REQUIREMENT 1: REMOVE ONLINE / SYNC STATUS BAR COMPLETELY ---
  console.log('\n[TEST 1] Verify Complete Removal of Online / Sync Status Bar Across UI...');
  const desktopSidebarSrc = fs.readFileSync('src/components/navigation/DesktopSidebar.tsx', 'utf-8');
  assert(!desktopSidebarSrc.includes('Online'), 'DesktopSidebar: "Online" label removed');
  assert(!desktopSidebarSrc.includes('pendingCount'), 'DesktopSidebar: Pending sync queue count removed');
  assert(!desktopSidebarSrc.includes('triggerSync'), 'DesktopSidebar: Sync button removed');
  assert(!desktopSidebarSrc.includes('useSync'), 'DesktopSidebar: useSync hook removed');

  const appLayoutSrc = fs.readFileSync('src/components/navigation/AppLayout.tsx', 'utf-8');
  assert(!appLayoutSrc.includes('Syncing in background'), 'AppLayout: Background sync pulse toast removed');
  assert(!appLayoutSrc.includes('Offline Mode'), 'AppLayout: Large persistent offline banner removed from top viewport');

  // --- REQUIREMENT 2: PENDING COUNT BADGE IN NAVIGATION ---
  console.log('\n[TEST 2] Verify Subtle Pending Count Badges in Desktop & Mobile Nav...');
  assert(desktopSidebarSrc.includes('pendingPaymentCount'), 'DesktopSidebar uses pendingPaymentCount from useOrders');
  assert(desktopSidebarSrc.includes('badge: pendingPaymentCount > 0 ? pendingPaymentCount : null'), 'DesktopSidebar binds badge to pending payments count');
  assert(desktopSidebarSrc.includes("to: '/pending-payments'"), 'DesktopSidebar routes badge to /pending-payments');

  const mobileNavSrc = fs.readFileSync('src/components/navigation/MobileNavBar.tsx', 'utf-8');
  assert(mobileNavSrc.includes('pendingPaymentCount'), 'MobileNavBar uses pendingPaymentCount from useOrders');
  assert(mobileNavSrc.includes('badge: pendingPaymentCount > 0 ? pendingPaymentCount : null'), 'MobileNavBar binds badge to pending payments count');

  // --- REQUIREMENT 3: SANITIZATION & NORMALIZATION ENGINE ---
  console.log('\n[TEST 3] Verify sanitizeFirestoreData and Status Normalizers...');
  const rawDataWithUndefined = {
    billNumber: 'BILL-9999',
    tableId: undefined,
    customer: {
      name: 'Test Customer',
      phone: undefined,
      nested: { note: undefined, valid: 123 },
    },
    items: [
      { name: 'Item 1', notes: undefined, qty: 2 },
    ],
  };
  const sanitized = sanitizeFirestoreData(rawDataWithUndefined);
  assert(sanitized.tableId === null, 'Undefined top-level field sanitized to null');
  assert(sanitized.customer.phone === null, 'Undefined nested field sanitized to null');
  assert(sanitized.customer.nested.note === null, 'Undefined deeply nested field sanitized to null');
  assert(sanitized.customer.nested.valid === 123, 'Valid fields preserved in nested object');
  assert(sanitized.items[0].notes === null, 'Undefined array element field sanitized to null');

  assert(normalizePaymentStatus('UNPAID') === 'UNPAID', 'normalizePaymentStatus: UNPAID');
  assert(normalizePaymentStatus('unpaid') === 'UNPAID', 'normalizePaymentStatus: lowercase unpaid');
  assert(normalizePaymentStatus('PARTIALLY_PAID') === 'PARTIAL', 'normalizePaymentStatus: PARTIALLY_PAID -> PARTIAL');
  assert(normalizePaymentStatus('partially paid') === 'PARTIAL', 'normalizePaymentStatus: partially paid -> PARTIAL');
  assert(normalizePaymentStatus('PAID') === 'PAID', 'normalizePaymentStatus: PAID');

  assert(normalizeOrderStatus('OPEN') === 'OPEN', 'normalizeOrderStatus: OPEN');
  assert(normalizeOrderStatus('Completed') === 'COMPLETED', 'normalizeOrderStatus: Completed -> COMPLETED');
  assert(normalizeOrderStatus('VOIDED') === 'CANCELLED', 'normalizeOrderStatus: VOIDED -> CANCELLED');
  assert(normalizeOrderStatus('Draft') === 'DRAFT', 'normalizeOrderStatus: Draft -> DRAFT');

  // --- REQUIREMENT 4: FIRESTORE AUTHENTICATION & INSTANT REAL-TIME BILL SAVING ---
  console.log('\n[TEST 4] Authenticate Shop Owner and Test Live Firestore Operations...');
  const shopOwnerEmail = 'princebhajipav16@gmail.com';
  const shopOwnerPass = 'OwnerPass@2026';
  const shopId = 'biz_prince_pavbhaji_01';

  await signInWithEmailAndPassword(auth, shopOwnerEmail, shopOwnerPass);
  console.log(`  Authenticated successfully as ${shopOwnerEmail}`);

  // Test 4A: Create an Unpaid Bill of ₹2,510
  console.log('\n[TEST 4A] Save Unpaid Bill (₹2,510) to Firestore directly...');
  const testItems: OrderItem[] = [
    {
      productId: 'prod_cheese_butter_bhajipav',
      productName: 'Special Cheese Butter Bhajipav',
      variantId: 'var_cheese_butter',
      variantName: 'Cheese Butter',
      unitPrice: 220,
      quantity: 10,
      subtotal: 2200,
      cgstAmount: 55,
      sgstAmount: 55,
      gstAmount: 110,
      total: 2310,
    },
    {
      productId: 'prod_masala_pav',
      productName: 'Butter Masala Pav',
      variantId: 'var_single',
      variantName: 'Single',
      unitPrice: 100,
      quantity: 2,
      subtotal: 200,
      cgstAmount: 0,
      sgstAmount: 0,
      gstAmount: 0,
      total: 200,
    },
  ];

  const createdOrder = await createOrder(shopId, {
    customer: { name: 'VIP Guest', phone: '9988776655' },
    tableId: null,
    tableName: 'Table 04',
    tableNumber: 'Table 04',
    orderType: 'DINE_IN',
    items: testItems,
    extras: [],
    subtotal: 2400,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    taxableAmount: 2400,
    gstAmount: 110,
    cgstAmount: 55,
    sgstAmount: 55,
    igstAmount: 0,
    grandTotal: 2510,
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
    amountPaid: 0,
    balanceDue: 2510,
    status: 'OPEN',
    taxConfigSnapshot: {
      enabled: true,
      gstin: '24AAACP1234F1Z5',
      pricingMode: 'exclusive',
      defaultGstRate: 5,
    },
  });

  assert(createdOrder.syncedWithCloud === true, 'Order immediately marked syncedWithCloud = true on cloud save');
  assert(createdOrder.grandTotal === 2510, 'Grand total correctly computed: ₹2,510');
  assert(createdOrder.balanceDue === 2510, 'Balance due is full grand total: ₹2,510');
  assert(createdOrder.paymentStatus === 'UNPAID', 'Payment status is UNPAID');

  // Verify persistence in actual Firestore
  const docRef = doc(db, 'businesses', shopId, 'orders', createdOrder.id);
  const snap = await getDoc(docRef);
  assert(snap.exists(), `Order document exists in Firestore at businesses/${shopId}/orders/${createdOrder.id}`);
  const cloudData = snap.data() as any;
  assert(cloudData.billNumber === createdOrder.billNumber, `Firestore billNumber matches: ${cloudData.billNumber}`);
  assert(cloudData.orderId === createdOrder.id, `Canonical orderId field written: ${cloudData.orderId}`);
  assert(cloudData.orderStatus === 'Open', `Canonical orderStatus written: ${cloudData.orderStatus}`);
  assert(cloudData.subtotal === 2400, `Canonical subtotal written: ${cloudData.subtotal}`);
  assert(cloudData.tax === 110, `Canonical tax field written: ${cloudData.tax}`);
  assert(cloudData.customerName === 'VIP Guest', `Canonical customerName written: ${cloudData.customerName}`);
  assert(cloudData.customerId === '9988776655', `Canonical customerId written: ${cloudData.customerId}`);

  // Test 4B: Record Partial Payment (₹1,000)
  console.log('\n[TEST 4B] Record Partial Payment (₹1,000) against Bill...');
  const { order: partialOrder, payment: partialPayment } = await recordOrderPayment(shopId, createdOrder.id, {
    amount: 1000,
    paymentMethod: 'UPI',
    paymentReference: 'UPI-REF-100234',
    receivedBy: 'test_cashier_01',
    receivedByName: 'Prince Cashier',
    notes: 'Paid ₹1000 via GPay at counter',
  });

  assert(partialOrder.amountPaid === 1000, 'Order amountPaid updated to ₹1,000');
  assert(partialOrder.balanceDue === 1510, 'Order balanceDue reduced to ₹1,510 (2510 - 1000)');
  assert(partialOrder.paymentStatus === 'PARTIAL', 'Order paymentStatus updated to PARTIAL');

  // Verify Firestore document after partial payment
  const snapAfterPartial = await getDoc(docRef);
  const dataAfterPartial = snapAfterPartial.data() as any;
  assert(dataAfterPartial.balanceDue === 1510, 'Firestore balanceDue is ₹1,510');
  assert(dataAfterPartial.paymentStatus === 'PARTIAL', 'Firestore paymentStatus is PARTIAL');

  // Verify subcollection payment document exists
  const payDocRef = doc(db, 'businesses', shopId, 'orders', createdOrder.id, 'payments', partialPayment.id);
  const paySnap = await getDoc(payDocRef);
  assert(paySnap.exists(), `Payment record stored in subcollection at orders/${createdOrder.id}/payments/${partialPayment.id}`);
  assert((paySnap.data() as any).amount === 1000, 'Subcollection payment amount is ₹1,000');

  // Test 4C: Clear Remaining Balance (₹1,510)
  console.log('\n[TEST 4C] Pay Remaining Balance (₹1,510) to Complete Bill...');
  const { order: completedOrder, payment: finalPayment } = await recordOrderPayment(shopId, createdOrder.id, {
    amount: 1510,
    paymentMethod: 'CASH',
    receivedBy: 'test_cashier_01',
    receivedByName: 'Prince Cashier',
    notes: 'Remaining balance paid in cash',
  });

  assert(completedOrder.amountPaid === 2510, 'Order amountPaid updated to full ₹2,510');
  assert(completedOrder.balanceDue === 0, 'Order balanceDue is ₹0');
  assert(completedOrder.paymentStatus === 'PAID', 'Order paymentStatus updated to PAID');
  assert(completedOrder.status === 'COMPLETED', 'Order status updated to COMPLETED');

  // Verify Firestore document after final payment
  const snapAfterComplete = await getDoc(docRef);
  const dataAfterComplete = snapAfterComplete.data() as any;
  assert(dataAfterComplete.balanceDue === 0, 'Firestore balanceDue is 0');
  assert(dataAfterComplete.paymentStatus === 'PAID', 'Firestore paymentStatus is PAID');
  assert(dataAfterComplete.status === 'COMPLETED', 'Firestore status is COMPLETED');

  // Clean up test order & payments from Firestore
  console.log('\n[CLEANUP] Cleaning up test order & payment subcollection documents...');
  await deleteDoc(payDocRef);
  const finalPayDocRef = doc(db, 'businesses', shopId, 'orders', createdOrder.id, 'payments', finalPayment.id);
  await deleteDoc(finalPayDocRef);
  await deleteDoc(docRef);
  console.log(`  Cleaned up test order ${createdOrder.id}`);

  console.log('\n========================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch((err) => {
  console.error('Acceptance test encountered fatal error:', err);
  process.exit(1);
});
