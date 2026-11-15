import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig, 'CHECK_ORDERS');
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  console.log('Super Admin logged in');

  const bSnap = await getDocs(collection(db, 'businesses'));
  for (const b of bSnap.docs) {
    const oSnap = await getDocs(collection(db, 'businesses', b.id, 'orders'));
    console.log(`\nShop: [${b.id}] (${b.data().name || b.data().businessName}) - Total orders in Firestore: ${oSnap.size}`);
    oSnap.docs.forEach(o => {
      const data = o.data();
      console.log(`  - [${o.id}] Bill: ${data.billNumber} | Status: ${data.status} | Payment: ${data.paymentStatus} | Total: ₹${data.grandTotal} | Due: ₹${data.balanceDue}`);
    });
  }

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
