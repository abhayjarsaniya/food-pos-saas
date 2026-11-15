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

const app = initializeApp(firebaseConfig, 'TEST_DISCOVERY');
const auth = getAuth(app);
const db = getFirestore(app);

async function findBusinessForUser(uid: string, email: string) {
  // 1. Check direct businesses/{uid} doc
  try {
    const directSnap = await getDoc(doc(db, 'businesses', uid));
    if (directSnap.exists()) {
      return { id: directSnap.id, ...directSnap.data() };
    }
  } catch {}

  // 2. Query businesses collection
  try {
    const bSnap = await getDocs(collection(db, 'businesses'));
    for (const d of bSnap.docs) {
      const data = d.data();
      if (
        data.ownerUid === uid ||
        (data.ownerEmail && data.ownerEmail.toLowerCase() === email.toLowerCase()) ||
        (data.email && data.email.toLowerCase() === email.toLowerCase())
      ) {
        return { id: d.id, ...data };
      }
    }
  } catch (err: any) {
    console.warn('Error querying businesses:', err.message);
  }

  return null;
}

async function testAll() {
  const testUsers = [
    { email: 'superadmin@foodpos.app', pass: 'SuperAdmin@2026', expectedRole: 'SUPER_ADMIN' },
    { email: 'princebhajipav16@gmail.com', pass: 'OwnerPass@2026', expectedRole: 'OWNER', expectedBiz: 'biz_prince_pavbhaji_01' },
    { email: 'owner@foodpos.app', pass: 'OwnerPass@2026', expectedRole: 'OWNER', expectedBiz: 'demo-business-owner-101' },
    { email: 'owner@cafedelight.com', pass: 'OwnerPass@2026', expectedRole: 'OWNER', expectedBiz: 'biz_cafe_delight_101' },
    { email: 'kishan@streetbites.com', pass: 'OwnerPass@2026', expectedRole: 'OWNER', expectedBiz: 'biz_street_food_99' },
    { email: 'cashier01@royalbistro.foodpos.app', pass: 'Cashier@2026', expectedRole: 'CASHIER', expectedBiz: 'demo-business-owner-101' },
  ];

  for (const t of testUsers) {
    console.log(`\nTesting ${t.email}...`);
    const cred = await signInWithEmailAndPassword(auth, t.email, t.pass);
    const uid = cred.user.uid;
    console.log(`  Authenticated in Firebase Auth -> UID: ${uid}`);

    if (t.email === 'superadmin@foodpos.app') {
      console.log('  ✅ Detected SUPER_ADMIN correctly');
      continue;
    }

    const biz: any = await findBusinessForUser(uid, t.email);
    if (biz) {
      console.log(`  ✅ Found Business: "${biz.name || biz.businessName}" (ID: ${biz.id})`);
      if (t.expectedBiz && biz.id !== t.expectedBiz) {
        console.error(`  ❌ Mismatch: expected ${t.expectedBiz}, got ${biz.id}`);
      }
    } else {
      console.log(`  ℹ️ No direct owner business found for ${t.email} (checking staff/member...)`);
    }
  }

  process.exit(0);
}

testAll().catch(e => {
  console.error(e);
  process.exit(1);
});
