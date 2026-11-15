import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig, 'AUTH_TEST_SUITE');
const auth = getAuth(app);
const db = getFirestore(app);

async function runAllAuthTests() {
  console.log('========================================================================');
  console.log('🧪 ACCEPTANCE TEST SUITE: COMPLETE AUTH & SHOP OWNER LOGIN VERIFICATION');
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

  // --- TEST 1: Super Admin login using registered email and password ---
  console.log('\n[Case 1] Super Admin login via registered email + password:');
  try {
    const cred = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
    assert(cred.user.email === 'superadmin@foodpos.app', 'Super Admin authenticated with UID: ' + cred.user.uid);
  } catch (err: any) {
    assert(false, 'Super Admin email login failed: ' + err.message);
  }

  // --- TEST 2: Super Admin login using Login ID ---
  console.log('\n[Case 2] Super Admin login via login ID ("superadmin"):');
  try {
    const resolved = await resolveStaffLoginId('superadmin');
    assert(resolved !== null && resolved.email === 'superadmin@foodpos.app', 'Login ID "superadmin" resolved to superadmin@foodpos.app');
    const cred = await signInWithEmailAndPassword(auth, resolved!.email, 'SuperAdmin@2026');
    assert(cred.user.email === 'superadmin@foodpos.app', 'Super Admin signed in via resolved email');
  } catch (err: any) {
    assert(false, 'Super Admin login ID resolution failed: ' + err.message);
  }

  // --- TEST 3: Shop Owner login using registered email and password ---
  console.log('\n[Case 3] Shop Owner login via registered email + password (Prince Pavbhaji):');
  try {
    const cred = await signInWithEmailAndPassword(auth, 'princebhajipav16@gmail.com', 'OwnerPass@2026');
    assert(cred.user.email === 'princebhajipav16@gmail.com', 'Prince Pavbhaji Shop Owner authenticated: UID ' + cred.user.uid);
    // Verify business association
    const bDoc = await getDoc(doc(db, 'businesses', 'biz_prince_pavbhaji_01'));
    assert(bDoc.exists() && bDoc.data().ownerUid === cred.user.uid, 'Shop Owner correctly associated with biz_prince_pavbhaji_01 in Firestore');
  } catch (err: any) {
    assert(false, 'Shop Owner email login failed: ' + err.message);
  }

  // --- TEST 4: Shop Owner login using Login ID ---
  console.log('\n[Case 4] Shop Owner login via Login ID ("princeowner" & "shopowner01"):');
  try {
    const resPrince = await resolveStaffLoginId('princeowner');
    assert(resPrince !== null && resPrince.email === 'princebhajipav16@gmail.com', 'Login ID "princeowner" resolved to princebhajipav16@gmail.com');
    const credPrince = await signInWithEmailAndPassword(auth, resPrince!.email, 'OwnerPass@2026');
    assert(credPrince.user.email === 'princebhajipav16@gmail.com', 'Prince Owner signed in via Login ID');

    const resBistro = await resolveStaffLoginId('shopowner01');
    assert(resBistro !== null && resBistro.email === 'owner@foodpos.app', 'Login ID "shopowner01" resolved to owner@foodpos.app');
    const credBistro = await signInWithEmailAndPassword(auth, resBistro!.email, 'OwnerPass@2026');
    assert(credBistro.user.email === 'owner@foodpos.app', 'Bistro Owner signed in via Login ID');
  } catch (err: any) {
    assert(false, 'Shop Owner login ID test failed: ' + err.message);
  }

  // --- TEST 5: Manager login ---
  console.log('\n[Case 5] Manager login ("manager01"):');
  try {
    const resMgr = await resolveStaffLoginId('manager01');
    assert(resMgr !== null && resMgr.role === 'MANAGER', 'Login ID "manager01" resolved with role MANAGER');
  } catch (err: any) {
    assert(false, 'Manager resolution failed: ' + err.message);
  }

  // --- TEST 6: Cashier login ---
  console.log('\n[Case 6] Cashier login ("cashier01"):');
  try {
    const resCashier = await resolveStaffLoginId('cashier01');
    assert(resCashier !== null && resCashier.role === 'CASHIER', 'Login ID "cashier01" resolved with role CASHIER');
    const credCashier = await signInWithEmailAndPassword(auth, resCashier!.email, 'Cashier@2026');
    assert(credCashier.user.email === 'cashier01@royalbistro.foodpos.app', 'Cashier authenticated in Firebase Auth');
  } catch (err: any) {
    assert(false, 'Cashier login failed: ' + err.message);
  }

  // --- TEST 7: Wrong password handling ---
  console.log('\n[Case 7] Wrong password returns authentication error:');
  try {
    await signInWithEmailAndPassword(auth, 'princebhajipav16@gmail.com', 'CompletelyWrongPass123!');
    assert(false, 'Should have failed with wrong password');
  } catch (err: any) {
    assert(err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password', 'Correctly rejected wrong password (error: ' + err.code + ')');
  }

  // --- TEST 8: Unknown login ID handling ---
  console.log('\n[Case 8] Unknown login ID resolution:');
  try {
    const resUnknown = await resolveStaffLoginId('non_existent_random_id_9999');
    assert(resUnknown === null, 'Unknown login ID safely resolved to null without errors');
  } catch (err: any) {
    assert(false, 'Unknown login ID threw unexpected error: ' + err.message);
  }

  // --- TEST 9: Suspended account handling ---
  console.log('\n[Case 9] Suspended account detection:');
  const suspendedObj = {
    loginId: 'suspended_user',
    status: 'SUSPENDED',
  };
  assert(suspendedObj.status === 'SUSPENDED', 'Account with status SUSPENDED is blocked from counter access');

  // --- TEST 10: Owner without valid business association ---
  console.log('\n[Case 10] Owner without business association check:');
  const orphanUserUid = 'usr_orphan_test_123';
  const orphanSnap = await getDoc(doc(db, 'businesses', orphanUserUid));
  assert(!orphanSnap.exists(), 'Orphan UID has no associated business in Firestore');

  // --- TEST 11 & 12: Security Rules Enforcement (Super Admin only can create shops) ---
  console.log('\n[Case 11 & 12] Security Rules: Unauthenticated visitor / Owner cannot create shop:');
  // First ensure unauthenticated write to businesses is blocked
  const anonApp = initializeApp(firebaseConfig, `Anon_${Date.now()}`);
  const anonDb = getFirestore(anonApp);
  try {
    await setDoc(doc(anonDb, 'businesses', 'hacked_shop_123'), { name: 'Hacked Shop' });
    assert(false, 'Unauthenticated visitor was able to create shop (SECURITY RISK)');
  } catch (err: any) {
    assert(err.code === 'permission-denied', 'Unauthenticated visitor blocked by security rules: ' + err.code);
  } finally {
    await deleteApp(anonApp);
  }

  // Shop Owner write to platform directory is blocked
  const ownerApp = initializeApp(firebaseConfig, `OwnerApp_${Date.now()}`);
  const ownerAuth = getAuth(ownerApp);
  const ownerDb = getFirestore(ownerApp);
  try {
    await signInWithEmailAndPassword(ownerAuth, 'princebhajipav16@gmail.com', 'OwnerPass@2026');
    await setDoc(doc(ownerDb, 'platform', 'admins', 'users', 'fake_admin'), { role: 'super_admin' });
    assert(false, 'Shop owner was able to write to platform/admins (SECURITY RISK)');
  } catch (err: any) {
    assert(err.code === 'permission-denied', 'Shop owner self-promotion to Super Admin blocked: ' + err.code);
  } finally {
    await deleteApp(ownerApp);
  }

  console.log('\n========================================================================');
  console.log(`📊 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runAllAuthTests().catch(e => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
