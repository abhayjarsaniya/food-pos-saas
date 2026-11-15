import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

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
};

const app = initializeApp(firebaseConfig, 'ORDER_TEST');
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  console.log('Logging in as Prince Pavbhaji owner (princebhajipav16@gmail.com)...');
  const cred = await signInWithEmailAndPassword(auth, 'princebhajipav16@gmail.com', 'OwnerPass@2026');
  console.log('Authenticated UID:', cred.user.uid);

  const businessId = 'biz_prince_pavbhaji_01';
  const orderId = `test_ord_${Date.now()}`;
  const now = new Date().toISOString();

  const testOrder = {
    id: orderId,
    businessId,
    billNumber: 'BILL-TEST-1',
    customer: { name: 'Rahul Test', phone: '9876543210' },
    tableId: 't1',
    tableName: 'Table 01',
    orderType: 'DINE_IN',
    items: [
      {
        itemId: 'prince_bp_01',
        name: 'Bhajipav (Butter)',
        price: 180,
        quantity: 2,
        lineTotal: 360,
      }
    ],
    extras: [],
    subtotal: 360,
    discountAmount: 0,
    taxableAmount: 360,
    gstAmount: 18,
    grandTotal: 378,
    amountPaid: 0,
    balanceDue: 378,
    paymentStatus: 'UNPAID',
    status: 'OPEN',
    createdBy: cred.user.uid,
    createdByName: 'Prince Owner',
    createdAt: now,
    updatedAt: now,
    syncedWithCloud: true,
  };

  console.log(`Writing test order ${orderId} to businesses/${businessId}/orders/...`);
  const docRef = doc(db, 'businesses', businessId, 'orders', orderId);
  await setDoc(docRef, testOrder);
  console.log('✅ Successfully wrote order to Firestore!');

  console.log('Reading order back from Firestore...');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log('✅ Successfully read back order:', snap.data().id, snap.data().billNumber);
  } else {
    console.error('❌ Order not found after writing!');
  }

  process.exit(0);
}

run().catch(e => {
  console.error('Fatal order write error:', e);
  process.exit(1);
});
