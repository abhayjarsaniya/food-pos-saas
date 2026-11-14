import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import { resolveStaffLoginId } from '../src/services/members/memberService';

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

const app = initializeApp(firebaseConfig, 'TEST_APP');
const auth = getAuth(app);
const db = getFirestore(app);

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 ACCEPTANCE SUITE: THREE LOGIN PORTALS & UNIFIED ROLE ROUTING');
  console.log('===============================================================');

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

  // 1. Authenticate as Super Admin first to pass security rules
  console.log('\n[TEST 1] Firebase Authentication with real Super Admin credentials...');
  const adminAuth = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  assert(adminAuth.user.email === 'superadmin@foodpos.app', 'Super Admin authenticated successfully via Firebase Auth');

  // 2. Verify Firestore Documents Structure
  console.log('\n[TEST 2] Firestore Platform Admin Schema verification...');
  const adminDoc = await getDoc(doc(db, 'platform', 'admins', 'users', 'pUrvBOHSBadnNcBCYrgdCSXzW1w1'));
  assert(adminDoc.exists(), 'platform/admins/{uid} document exists');
  if (adminDoc.exists()) {
    const data = adminDoc.data();
    assert(data?.role === 'super_admin', 'platform/admins role is super_admin');
    assert(data?.loginId === 'superadmin', 'platform/admins loginId is superadmin');
    assert(data?.status === 'active', 'platform/admins status is active');
  }

  console.log('\n[TEST 3] Firestore Business Schema verification...');
  const bDoc = await getDoc(doc(db, 'businesses', 'demo-business-owner-101'));
  assert(bDoc.exists(), 'businesses/{businessId} document exists');
  if (bDoc.exists()) {
    const bData = bDoc.data();
    assert(bData?.status === 'active' || bData?.status === 'ACTIVE', 'business status is active');
    assert(!!bData?.businessName || !!bData?.name, 'business name is defined');
  }

  console.log('\n[TEST 4] Firestore Business Members Schema verification...');
  const memDoc = await getDoc(doc(db, 'businesses', 'demo-business-owner-101', 'members', 'mem_cashier_01'));
  assert(memDoc.exists(), 'businesses/{businessId}/members/{uid} cashier document exists');
  if (memDoc.exists()) {
    const mData = memDoc.data();
    assert(mData?.loginId === 'cashier01', 'member loginId is cashier01');
    assert(mData?.status === 'active' || mData?.status === 'ACTIVE', 'member status is active');
  }

  console.log('\n[TEST 5] Firestore Business Auth Settings verification...');
  const authSetDoc = await getDoc(doc(db, 'businesses', 'demo-business-owner-101', 'settings', 'auth'));
  assert(authSetDoc.exists(), 'businesses/{businessId}/settings/auth document exists');
  if (authSetDoc.exists()) {
    const asData = authSetDoc.data();
    assert(asData?.loginMethod === 'loginId_or_email', 'auth settings loginMethod is loginId_or_email');
    assert(asData?.allowMemberLogin === true, 'allowMemberLogin is true');
  }

  // 3. Resolve Staff Login IDs
  console.log('\n[TEST 6] Login ID Resolution Resolution Tests...');
  const superResolved = await resolveStaffLoginId('superadmin');
  assert(superResolved !== null, 'superadmin Login ID resolves');
  assert(superResolved?.role === 'SUPER_ADMIN', 'superadmin resolves to SUPER_ADMIN role');

  const ownerResolved = await resolveStaffLoginId('shopowner01');
  assert(ownerResolved !== null, 'shopowner01 Login ID resolves');
  assert(ownerResolved?.role === 'OWNER', 'shopowner01 resolves to OWNER role');

  const cashierResolved = await resolveStaffLoginId('cashier01');
  assert(cashierResolved !== null, 'cashier01 Login ID resolves');
  assert(cashierResolved?.role === 'CASHIER', 'cashier01 resolves to CASHIER role');

  const managerResolved = await resolveStaffLoginId('manager01');
  assert(managerResolved !== null, 'manager01 Login ID resolves');
  assert(managerResolved?.role === 'MANAGER', 'manager01 resolves to MANAGER role');

  // 4. Authenticate Staff Credentials
  console.log('\n[TEST 7] Firebase Authentication with real Staff credentials...');
  const cashierAuth = await signInWithEmailAndPassword(auth, 'cashier01@royalbistro.foodpos.app', 'Cashier@2026');
  assert(cashierAuth.user.email === 'cashier01@royalbistro.foodpos.app', 'Cashier authenticated successfully via Firebase Auth');

  // 4. Verify LoginPage UI code contains NO demo section and NO admin link
  console.log('\n[TEST 7] LoginPage UI code purity audit...');
  const loginPageSource = fs.readFileSync('src/pages/Login/LoginPage.tsx', 'utf-8');
  assert(!loginPageSource.includes('Instant Demo Access'), 'LoginPage source does NOT contain "Instant Demo Access"');
  assert(!loginPageSource.includes('Explore Demo Shop'), 'LoginPage source does NOT contain "Explore Demo Shop"');
  assert(!loginPageSource.includes('demoLogin'), 'LoginPage source does NOT contain "demoLogin"');
  assert(!loginPageSource.includes('Platform Admin Login'), 'LoginPage source does NOT contain "Platform Admin Login"');
  assert(!loginPageSource.includes('/admin/login'), 'LoginPage source does NOT contain visible link to "/admin/login"');
  assert(loginPageSource.includes('LOGIN ID OR EMAIL ADDRESS'), 'LoginPage source contains uppercase label "LOGIN ID OR EMAIL ADDRESS"');
  assert(loginPageSource.includes('Sign In to Billing Counter'), 'LoginPage source contains "Sign In to Billing Counter" button');

  console.log('\n===============================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
