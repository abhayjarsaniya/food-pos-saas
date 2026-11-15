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
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig, 'DIAGNOSE_APP');
const auth = getAuth(app);
const db = getFirestore(app);

async function diagnose() {
  console.log('=== FIREBASE CONFIGURATION ===');
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Auth Domain:', firebaseConfig.authDomain);

  // Authenticate as Super Admin first
  console.log('\n--- 1. Testing Super Admin Auth ---');
  try {
    const cred = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
    console.log('✅ Super Admin login SUCCESS! UID:', cred.user.uid, 'Email:', cred.user.email);
  } catch (err: any) {
    console.error('❌ Super Admin login FAILED:', err.code, err.message);
  }

  // Inspect Firestore: businesses
  console.log('\n--- 2. Inspecting Firestore "businesses" collection ---');
  const bSnap = await getDocs(collection(db, 'businesses'));
  console.log(`Found ${bSnap.size} businesses:`);
  for (const bDoc of bSnap.docs) {
    const b = bDoc.data();
    console.log(`\nBusiness [${bDoc.id}]:`);
    console.log(`  Name: ${b.name || b.businessName}`);
    console.log(`  Brand: ${b.brandName}`);
    console.log(`  Email: ${b.email || b.ownerEmail}`);
    console.log(`  LoginId: ${b.loginId}`);
    console.log(`  OwnerUid: ${b.ownerUid}`);
    console.log(`  Status: ${b.status}`);

    // Check members subcollection
    const mSnap = await getDocs(collection(db, 'businesses', bDoc.id, 'members'));
    console.log(`  Members count: ${mSnap.size}`);
    mSnap.docs.forEach(mDoc => {
      const m = mDoc.data();
      console.log(`    - [${mDoc.id}] ${m.name} | role: ${m.role} | loginId: ${m.loginId} | email: ${m.email} | status: ${m.status}`);
    });
  }

  // Inspect Firestore: loginIds
  console.log('\n--- 3. Inspecting Firestore "loginIds" collection ---');
  try {
    const lSnap = await getDocs(collection(db, 'loginIds'));
    console.log(`Found ${lSnap.size} mappings in "loginIds":`);
    lSnap.docs.forEach(lDoc => {
      const l = lDoc.data();
      console.log(`  - [${lDoc.id}] -> email: ${l.email} | role: ${l.role} | bizId: ${l.businessId} | status: ${l.status}`);
    });
  } catch (err: any) {
    console.error('Could not read loginIds collection:', err.code, err.message);
  }

  // Test various shop owner logins
  console.log('\n--- 4. Testing Shop Owner Logins in Firebase Auth ---');
  const candidates = [
    { email: 'princebhajipav16@gmail.com', pass: 'OwnerPass@2026' },
    { email: 'princebhajipav16@gmail.com', pass: 'TestCheck123!' },
    { email: 'princebhajipav16@gmail.com', pass: 'Prince@2026' },
    { email: 'owner@foodpos.app', pass: 'OwnerPass@2026' },
    { email: 'owner@foodpos.app', pass: 'Owner@2026' },
    { email: 'owner@example.com', pass: 'OwnerPass@2026' },
    { email: 'owner@cafedelight.com', pass: 'OwnerPass@2026' },
    { email: 'kishan@streetbites.com', pass: 'OwnerPass@2026' },
    { email: 'cashier01@royalbistro.foodpos.app', pass: 'Cashier@2026' },
  ];

  for (const c of candidates) {
    try {
      const res = await signInWithEmailAndPassword(auth, c.email, c.pass);
      console.log(`  ✅ SUCCESS: ${c.email} with pass "${c.pass}" -> UID: ${res.user.uid}`);
    } catch (err: any) {
      console.log(`  ❌ FAILED: ${c.email} with pass "${c.pass}" -> ${err.code}: ${err.message}`);
    }
  }

  process.exit(0);
}

diagnose().catch(err => {
  console.error('Fatal diagnose error:', err);
  process.exit(1);
});
