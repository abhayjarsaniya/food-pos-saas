import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';

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

const app = initializeApp(firebaseConfig, 'PORTAL_SETUP');
const auth = getAuth(app);
const db = getFirestore(app);

async function createAuthUserIfMissing(email: string, pass: string) {
  const tempApp = initializeApp(firebaseConfig, `temp_${Date.now()}_${Math.random()}`);
  try {
    const tempAuth = getAuth(tempApp);
    const cred = await createUserWithEmailAndPassword(tempAuth, email, pass);
    console.log(`  ➕ Created Firebase Auth user: ${email} (UID: ${cred.user.uid})`);
    return cred.user.uid;
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      console.log(`  ℹ️ Firebase Auth user already registered: ${email}`);
      return null;
    }
    console.warn(`  ⚠️ Auth notice for ${email}:`, err.message);
    return null;
  } finally {
    await deleteApp(tempApp);
  }
}

async function run() {
  console.log('🚀 Running Portal & Schema Setup for Food POS SaaS...');

  // 1. Authenticate as Super Admin
  const adminCred = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  const superAdminUid = adminCred.user.uid;
  console.log(`✅ Authenticated Super Admin: ${adminCred.user.email} (UID: ${superAdminUid})`);

  const now = new Date().toISOString();

  // Try creating admin@foodpos.app if desired
  await createAuthUserIfMissing('admin@foodpos.app', 'SuperAdmin@2026');
  // Try creating owner@example.com / cashier@example.com
  await createAuthUserIfMissing('owner@example.com', 'OwnerPass@2026');
  await createAuthUserIfMissing('cashier@example.com', 'Cashier@2026');

  // 2. Exact Firestore Document: platform/admins/{uid}
  console.log('\n[1/4] Writing platform/admins/{uid}...');
  const platformAdminDoc = {
    uid: superAdminUid,
    loginId: 'superadmin',
    email: 'superadmin@foodpos.app',
    role: 'super_admin',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, 'platform', 'admins', 'users', superAdminUid), platformAdminDoc, { merge: true });
  // Also top-level platform/admins doc if referenced
  await setDoc(doc(db, 'platform', 'admins'), {
    title: 'Platform Admins Directory',
    masterAdmin: 'superadmin@foodpos.app',
    totalAdmins: 1,
    updatedAt: now,
  }, { merge: true });
  console.log(`✅ platform/admins doc updated with UID: ${superAdminUid}`);

  // 3. Exact Firestore Document: businesses/{businessId}
  console.log('\n[2/4] Writing businesses/{businessId} & auth settings...');
  const bId = 'demo-business-owner-101';
  await setDoc(doc(db, 'businesses', bId), {
    businessName: 'The Royal Bistro & Cafe',
    ownerUid: bId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  // businesses/{businessId}/settings/auth
  const authSettingsDoc = {
    loginMethod: 'loginId_or_email',
    allowMemberLogin: true,
    maxMembers: 15,
    updatedAt: now,
  };
  await setDoc(doc(db, 'businesses', bId, 'settings', 'auth'), authSettingsDoc, { merge: true });
  console.log(`✅ businesses/${bId} and settings/auth configured.`);

  // 4. Exact Firestore Document: businesses/{businessId}/members/{uid}
  console.log('\n[3/4] Writing businesses/{businessId}/members/{uid}...');
  
  // Cashier member
  const cashierMemberDoc = {
    uid: 'mem_cashier_01',
    loginId: 'cashier01',
    email: 'cashier01@royalbistro.foodpos.app',
    name: 'Ramesh Cashier',
    role: 'cashier',
    status: 'active',
    permissions: {
      canCollectPayment: true,
      canCreateBills: true,
      canViewOrders: true,
      canApplyDiscount: false,
    },
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, 'businesses', bId, 'members', 'mem_cashier_01'), cashierMemberDoc, { merge: true });

  // Manager member
  const managerMemberDoc = {
    uid: 'mem_manager_01',
    loginId: 'manager01',
    email: 'manager01@royalbistro.foodpos.app',
    name: 'Vikram Floor Manager',
    role: 'manager',
    status: 'active',
    permissions: {
      canCollectPayment: true,
      canCreateBills: true,
      canViewOrders: true,
      canApplyDiscount: true,
      canManageInventory: true,
    },
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, 'businesses', bId, 'members', 'mem_manager_01'), managerMemberDoc, { merge: true });
  console.log(`✅ Members cashier01 and manager01 configured.`);

  // 5. Secure Login ID Resolution Directory
  console.log('\n[4/4] Setting up Login ID Directory (loginIds collection)...');
  const loginIds = [
    {
      loginId: 'superadmin',
      email: 'superadmin@foodpos.app',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      portal: '/super-admin/login',
    },
    {
      loginId: 'shopowner01',
      email: 'owner@foodpos.app',
      businessId: bId,
      role: 'OWNER',
      status: 'ACTIVE',
      portal: '/shop/login',
    },
    {
      loginId: 'cashier01',
      email: 'cashier01@royalbistro.foodpos.app',
      businessId: bId,
      memberId: 'mem_cashier_01',
      role: 'CASHIER',
      canCollectPayment: true,
      status: 'ACTIVE',
      portal: '/member/login',
    },
    {
      loginId: 'manager01',
      email: 'manager01@royalbistro.foodpos.app',
      businessId: bId,
      memberId: 'mem_manager_01',
      role: 'MANAGER',
      canCollectPayment: true,
      status: 'ACTIVE',
      portal: '/member/login',
    },
    {
      loginId: 'counter02',
      email: 'counter02@royalbistro.foodpos.app',
      businessId: bId,
      memberId: 'mem_cashier_02',
      role: 'CASHIER',
      canCollectPayment: true,
      status: 'ACTIVE',
      portal: '/member/login',
    },
  ];

  for (const item of loginIds) {
    await setDoc(doc(db, 'loginIds', item.loginId), {
      ...item,
      updatedAt: now,
    }, { merge: true });
    console.log(`  🔑 Registered Login ID: ${item.loginId} -> ${item.email} (${item.role})`);
  }

  console.log('\n✨ Database and Portal Setup Successfully Completed!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Setup failed:', err);
  process.exit(1);
});
