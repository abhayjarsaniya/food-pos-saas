import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import { DEFAULT_BUSINESS_FEATURES } from '../src/types';

// Read .env
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

const app = initializeApp(firebaseConfig, 'STAFF_INIT');
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  console.log('🚀 Initializing Staff Login IDs & Business Feature Flags in Firestore...');
  
  // 1. Authenticate as Super Admin
  const cred = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  console.log(`✅ Authenticated UID: ${cred.user.uid}`);

  const businesses = ['demo-business-owner-101', 'biz_cafe_delight_101'];

  for (const bId of businesses) {
    console.log(`\nSetting up features for ${bId}...`);
    const featRef = doc(db, 'businesses', bId, 'settings', 'features');
    await setDoc(featRef, DEFAULT_BUSINESS_FEATURES, { merge: true });
    console.log(`✅ Features initialized for ${bId}`);
  }

  // 2. Setup Staff Members with unique Login IDs
  const staffMembers = [
    {
      loginId: 'cashier01',
      name: 'Ramesh Cashier',
      email: 'cashier01@royalbistro.foodpos.app',
      password: 'Cashier@2026',
      role: 'CASHIER',
      canCollectPayment: false, // Testing permission enforcement!
      businessId: 'demo-business-owner-101',
      memberId: 'mem_cashier_01',
    },
    {
      loginId: 'counter02',
      name: 'Priya Senior Cashier',
      email: 'counter02@royalbistro.foodpos.app',
      password: 'Cashier@2026',
      role: 'CASHIER',
      canCollectPayment: true, // Authorized cashier
      businessId: 'demo-business-owner-101',
      memberId: 'mem_cashier_02',
    },
    {
      loginId: 'manager01',
      name: 'Vikram Floor Manager',
      email: 'manager01@royalbistro.foodpos.app',
      password: 'Manager@2026',
      role: 'MANAGER',
      canCollectPayment: true,
      businessId: 'demo-business-owner-101',
      memberId: 'mem_manager_01',
    },
  ];

  console.log('\nSetting up staff accounts & login ID index...');
  for (const staff of staffMembers) {
    // A. Ensure Firebase Auth account exists using secondary app to preserve SuperAdmin session
    const tempApp = initializeApp(firebaseConfig, `temp_${staff.loginId}_${Date.now()}`);
    try {
      const tempAuth = getAuth(tempApp);
      await createUserWithEmailAndPassword(tempAuth, staff.email, staff.password);
      console.log(`  ➕ Created Auth user: ${staff.email}`);
    } catch (err: any) {
      if (err.message?.includes('email-already-in-use')) {
        console.log(`  ℹ️ Auth user already exists: ${staff.email}`);
      } else {
        console.warn(`  ⚠️ Auth note: ${err.message}`);
      }
    } finally {
      await deleteApp(tempApp);
    }

    const now = new Date().toISOString();
    // B. Save in businesses/{businessId}/members/{memberId} (using Super Admin session)
    const memberDoc = {
      id: staff.memberId,
      businessId: staff.businessId,
      name: staff.name,
      loginId: staff.loginId,
      email: staff.email,
      role: staff.role,
      canCollectPayment: staff.canCollectPayment,
      status: 'ACTIVE',
      invitedAt: now,
      joinedAt: now,
    };
    await setDoc(doc(db, 'businesses', staff.businessId, 'members', staff.memberId), memberDoc);

    // C. Save in loginIds/{loginId}
    const loginIdDoc = {
      loginId: staff.loginId,
      email: staff.email,
      businessId: staff.businessId,
      memberId: staff.memberId,
      role: staff.role,
      canCollectPayment: staff.canCollectPayment,
      status: 'ACTIVE',
      updatedAt: now,
    };
    await setDoc(doc(db, 'loginIds', staff.loginId), loginIdDoc);
    console.log(`  ✅ Registered Login ID: @${staff.loginId} -> ${staff.email}`);
  }

  console.log('\n🎉 Staff login IDs and features setup complete!');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
