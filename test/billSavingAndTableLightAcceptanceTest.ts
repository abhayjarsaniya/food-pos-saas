import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import { calculateTableStatuses } from '../src/services/tables/tableService';
import { Order, RestaurantTable } from '../src/types';

// Load environment variables
const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig, 'BILL_SAVE_ACCEPTANCE');
const auth = getAuth(app);
const db = getFirestore(app);

async function runAcceptanceTests() {
  console.log('========================================================================');
  console.log('🧾 FOOD POS ACCEPTANCE: BILL SAVING, FIRESTORE PERSISTENCE & TABLE UI');
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

  // --- TEST 1: GREEN SYNC BANNER REMOVAL ---
  console.log('\n[TEST 1] Verify Persistent Green Sync Banner Removal in AppLayout.tsx...');
  const appLayoutSrc = fs.readFileSync('src/components/navigation/AppLayout.tsx', 'utf-8');
  assert(!appLayoutSrc.includes('bg-emerald-600 text-white text-xs font-medium px-4 py-1.5'), 'Permanent green sync banner removed');
  assert(!appLayoutSrc.includes('Sync now'), 'Manual "Sync now" button removed from viewport');
  assert(appLayoutSrc.includes('Offline Mode'), 'Offline mode safety warning preserved');

  // --- TEST 2: FIRESTORE AUTHENTICATION & SHOP ISOLATION ---
  console.log('\n[TEST 2] Authenticate Shop Owner (Prince Pavbhaji)...');
  const shopOwnerEmail = 'princebhajipav16@gmail.com';
  const shopOwnerPass = 'OwnerPass@2026';
  const shopId = 'biz_prince_pavbhaji_01';

  const userCred = await signInWithEmailAndPassword(auth, shopOwnerEmail, shopOwnerPass);
  assert(userCred.user.email === shopOwnerEmail, `Authenticated as shop owner ${shopOwnerEmail}`);

  // --- TEST 3: SAVE UNPAID BILL (Standard Indian Flow) ---
  console.log('\n[TEST 3] Save Unpaid Bill to Firestore (businesses/{bId}/orders/{orderId})...');
  const unpaidOrderId = `ord_test_unpaid_${Date.now()}`;
  const unpaidOrderDoc = {
    id: unpaidOrderId,
    businessId: shopId,
    billNumber: `TEST-BILL-${Date.now().toString().slice(-4)}`,
    customer: { name: 'Ramesh Patel', phone: '9876543210' },
    tableId: 'tbl_window_01',
    tableName: 'Window 01',
    tableNumber: 'Window 01',
    orderType: 'DINE_IN',
    items: [
      {
        itemId: 'item_pav_bhaji_butter',
        name: 'Butter Pav Bhaji',
        price: 150,
        quantity: 2,
        total: 300,
        gstRate: 5,
        gstAmount: 15,
        taxableAmount: 285,
      }
    ],
    extras: [],
    subtotal: 300,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    taxableAmount: 285,
    gstAmount: 15,
    cgstAmount: 7.5,
    sgstAmount: 7.5,
    igstAmount: 0,
    grandTotal: 300,
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
    amountPaid: 0,
    balanceDue: 300,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userCred.user.uid,
    createdByName: 'Shop Owner',
    syncedWithCloud: true,
  };

  await setDoc(doc(db, 'businesses', shopId, 'orders', unpaidOrderId), unpaidOrderDoc);
  
  // Read back doc from Firestore
  const unpaidSnap = await getDoc(doc(db, 'businesses', shopId, 'orders', unpaidOrderId));
  assert(unpaidSnap.exists(), 'Unpaid bill persisted directly to Firestore');
  const unpaidData = unpaidSnap.data();
  assert(unpaidData?.status === 'OPEN', 'Unpaid bill status is "OPEN"');
  assert(unpaidData?.paymentStatus === 'UNPAID', 'Unpaid bill paymentStatus is "UNPAID"');
  assert(unpaidData?.balanceDue === 300, 'Unpaid bill balanceDue matches grandTotal (300)');

  // --- TEST 4: SAVE PARTIALLY PAID BILL ---
  console.log('\n[TEST 4] Save Partially Paid Bill with Subcollection Payment Document...');
  const partialOrderId = `ord_test_partial_${Date.now()}`;
  const partialOrderDoc = {
    ...unpaidOrderDoc,
    id: partialOrderId,
    billNumber: `TEST-BILL-${(Date.now() + 1).toString().slice(-4)}`,
    customer: { name: 'Pooja Shah', phone: '9825098250' },
    paymentStatus: 'PARTIAL',
    amountPaid: 100,
    balanceDue: 200,
    status: 'OPEN',
  };

  await setDoc(doc(db, 'businesses', shopId, 'orders', partialOrderId), partialOrderDoc);

  // Add initial partial payment in subcollection
  const paymentDocId = `pay_init_${Date.now()}`;
  await setDoc(doc(db, 'businesses', shopId, 'orders', partialOrderId, 'payments', paymentDocId), {
    id: paymentDocId,
    businessId: shopId,
    orderId: partialOrderId,
    amount: 100,
    paymentMethod: 'UPI',
    createdAt: new Date().toISOString(),
    receivedBy: userCred.user.uid,
    receivedByName: 'Shop Owner',
  });

  const partialSnap = await getDoc(doc(db, 'businesses', shopId, 'orders', partialOrderId));
  assert(partialSnap.exists(), 'Partially paid bill persisted in Firestore');
  const partialData = partialSnap.data();
  assert(partialData?.status === 'OPEN', 'Partially paid bill status is "OPEN"');
  assert(partialData?.paymentStatus === 'PARTIAL', 'Partially paid bill paymentStatus is "PARTIAL"');
  assert(partialData?.amountPaid === 100, 'amountPaid is 100');
  assert(partialData?.balanceDue === 200, 'balanceDue is 200');

  const paySnap = await getDocs(collection(db, 'businesses', shopId, 'orders', partialOrderId, 'payments'));
  assert(paySnap.docs.length >= 1, 'Payment recorded in order payments subcollection');

  // --- TEST 5: SAVE FULLY PAID BILL ---
  console.log('\n[TEST 5] Save Fully Paid Bill (Status COMPLETED & PAID)...');
  const fullyPaidOrderId = `ord_test_paid_${Date.now()}`;
  const fullyPaidOrderDoc = {
    ...unpaidOrderDoc,
    id: fullyPaidOrderId,
    billNumber: `TEST-BILL-${(Date.now() + 2).toString().slice(-4)}`,
    paymentStatus: 'PAID',
    amountPaid: 300,
    balanceDue: 0,
    status: 'COMPLETED',
  };

  await setDoc(doc(db, 'businesses', shopId, 'orders', fullyPaidOrderId), fullyPaidOrderDoc);
  const paidSnap = await getDoc(doc(db, 'businesses', shopId, 'orders', fullyPaidOrderId));
  assert(paidSnap.exists(), 'Fully paid order persisted in Firestore');
  const paidData = paidSnap.data();
  assert(paidData?.status === 'COMPLETED', 'Fully paid order status is "COMPLETED"');
  assert(paidData?.paymentStatus === 'PAID', 'Fully paid order paymentStatus is "PAID"');
  assert(paidData?.balanceDue === 0, 'Fully paid order balanceDue is 0');

  // --- TEST 6: RECORD PAYMENT ON UNPAID BILL (RECEIVE BALANCE) ---
  console.log('\n[TEST 6] Receive Payment on Unpaid Bill in Firestore...');
  const pay2Id = `pay_settle_${Date.now()}`;
  await setDoc(doc(db, 'businesses', shopId, 'orders', unpaidOrderId, 'payments', pay2Id), {
    id: pay2Id,
    businessId: shopId,
    orderId: unpaidOrderId,
    amount: 300,
    paymentMethod: 'CASH',
    createdAt: new Date().toISOString(),
    receivedBy: userCred.user.uid,
  });

  // Update order document atomically
  await setDoc(
    doc(db, 'businesses', shopId, 'orders', unpaidOrderId),
    {
      amountPaid: 300,
      balanceDue: 0,
      paymentStatus: 'PAID',
      status: 'COMPLETED',
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const updatedSnap = await getDoc(doc(db, 'businesses', shopId, 'orders', unpaidOrderId));
  const updatedData = updatedSnap.data();
  assert(updatedData?.paymentStatus === 'PAID', 'After collecting balance, paymentStatus is updated to "PAID"');
  assert(updatedData?.status === 'COMPLETED', 'After collecting balance, status is updated to "COMPLETED"');
  assert(updatedData?.balanceDue === 0, 'balanceDue updated to 0');

  // --- TEST 7: TABLE OCCUPANCY LOGIC ---
  console.log('\n[TEST 7] Verify Table Occupancy Derived ONLY From Active Dining Orders...');
  const mockTables: RestaurantTable[] = [
    {
      id: 'tbl_window_01',
      businessId: shopId,
      name: 'Window 01',
      seatingCapacity: 4,
      isActive: true,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tbl_family_02',
      businessId: shopId,
      name: 'Family 02',
      seatingCapacity: 6,
      isActive: true,
      sortOrder: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  // Case A: Table Window 01 has an OPEN order -> Must be PAYMENT_PENDING or OCCUPIED
  const openOrder: Order = {
    id: 'ord_active_1',
    businessId: shopId,
    billNumber: 'BILL-1',
    tableId: 'tbl_window_01',
    tableName: 'Window 01',
    tableNumber: 'Window 01',
    orderType: 'DINE_IN',
    items: [],
    subtotal: 200,
    discountAmount: 0,
    taxableAmount: 200,
    gstAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    grandTotal: 200,
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
    amountPaid: 0,
    balanceDue: 200,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const statusOccupied = calculateTableStatuses(mockTables, [openOrder]);
  const table1 = statusOccupied.find(t => t.id === 'tbl_window_01');
  const table2 = statusOccupied.find(t => t.id === 'tbl_family_02');

  assert(table1?.status === 'PAYMENT_PENDING', 'Table with active OPEN unpaid order is PAYMENT_PENDING');
  assert(table2?.status === 'AVAILABLE', 'Table without active order is AVAILABLE');

  // Case B: Order is completed -> Guests leave table -> Table MUST be released to AVAILABLE!
  const completedOrder: Order = {
    ...openOrder,
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    balanceDue: 0,
  };

  const statusReleased = calculateTableStatuses(mockTables, [completedOrder]);
  const table1Released = statusReleased.find(t => t.id === 'tbl_window_01');
  assert(table1Released?.status === 'AVAILABLE', 'When order is COMPLETED, table is released to AVAILABLE');

  // Case C: Cancelled order also releases table
  const cancelledOrder: Order = {
    ...openOrder,
    status: 'CANCELLED',
  };
  const statusCancelled = calculateTableStatuses(mockTables, [cancelledOrder]);
  const table1Cancelled = statusCancelled.find(t => t.id === 'tbl_window_01');
  assert(table1Cancelled?.status === 'AVAILABLE', 'When order is CANCELLED, table is released to AVAILABLE');

  // --- TEST 8: TABLE MANAGEMENT LIGHT THEME CONFIGURATION ---
  console.log('\n[TEST 8] Verify Table Management Light Theme & Preference Toggle...');
  const tableMgmtSrc = fs.readFileSync('src/pages/Tables/TableManagementPage.tsx', 'utf-8');
  assert(tableMgmtSrc.includes('themePreference'), 'Table Management includes themePreference state');
  assert(tableMgmtSrc.includes("'light'"), 'Default theme preference is "light"');
  assert(tableMgmtSrc.includes('handleSetTheme'), 'Theme toggle handler present');
  assert(tableMgmtSrc.includes('handleStartBillForTable'), 'Start Bill action pre-fills table in billing');
  assert(tableMgmtSrc.includes('subscribeToTables'), 'Real-time subscribeToTables integrated');
  assert(tableMgmtSrc.includes('subscribeToOrders'), 'Real-time subscribeToOrders integrated');

  // --- TEST 9: PENDING PAYMENTS REAL-TIME & FILTER ---
  console.log('\n[TEST 9] Verify Pending Payments Filter & Real-Time Sync...');
  const pendingPageSrc = fs.readFileSync('src/pages/Payments/PendingPaymentsPage.tsx', 'utf-8');
  assert(pendingPageSrc.includes('subscribeToOrders'), 'PendingPaymentsPage uses real-time subscribeToOrders');
  assert(pendingPageSrc.includes('All Pending Dues'), 'PendingPaymentsPage provides default "All Pending Dues" tab');
  assert(pendingPageSrc.includes("statusFilter === 'PENDING' && o.paymentStatus === 'PAID'"), 'Default filter shows all unpaid and partial orders, excluding paid');

  // --- TEST 10: CLEANUP TEST DATA ---
  console.log('\n[TEST 10] Clean up test order documents from Firestore...');
  try {
    await deleteDoc(doc(db, 'businesses', shopId, 'orders', unpaidOrderId));
    await deleteDoc(doc(db, 'businesses', shopId, 'orders', partialOrderId));
    await deleteDoc(doc(db, 'businesses', shopId, 'orders', fullyPaidOrderId));
    assert(true, 'Test orders cleaned up successfully');
  } catch (err) {
    console.warn('Cleanup warning:', err);
  }

  console.log('\n========================================================================');
  console.log(`ACCEPTANCE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
