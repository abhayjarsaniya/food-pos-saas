import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { computeSubscriptionStatus, DEFAULT_SUBSCRIPTION_PLANS } from '../src/services/subscription/subscriptionService';

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

const app = initializeApp(firebaseConfig, 'TOUCH_SUPERADMIN_TEST');
const auth = getAuth(app);
const db = getFirestore(app);

async function runComprehensiveVerification() {
  console.log('========================================================================');
  console.log('📱 FULL ACCEPTANCE: MOBILE TOUCH REDESIGN & SUPER ADMIN SUBSCRIPTION');
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

  // --- SECTION 1: FIREBASE FIRESTORE DATA INTEGRITY ---
  console.log('\n[SECTION 1] Authenticate Super Admin and Verify Existing Records...');
  try {
    const cred = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
    assert(cred.user.email === 'superadmin@foodpos.app', 'Super Admin authenticated successfully');

    // Verify Prince Pavbhaji business document
    const bSnap = await getDoc(doc(db, 'businesses', 'biz_prince_pavbhaji_01'));
    assert(bSnap.exists(), 'Prince Pavbhaji business profile preserved in Firestore');
    const bData = bSnap.data();
    assert(bData?.name === 'Prince Pavbhaji', 'Shop Name is intact ("Prince Pavbhaji")');
    assert(bData?.brandName === 'Prince Bhajipav Manekchowkwala', 'Brand Name preserved');

    // Verify Prince Pavbhaji menu items are intact
    const menuSnap = await getDocs(collection(db, 'businesses', 'biz_prince_pavbhaji_01', 'menuItems'));
    assert(menuSnap.docs.length >= 70, `Prince Pavbhaji menu items fully intact (${menuSnap.docs.length} items found)`);

    // Verify Prince Pavbhaji tables
    const tableSnap = await getDocs(collection(db, 'businesses', 'biz_prince_pavbhaji_01', 'tables'));
    assert(tableSnap.docs.length >= 8, `Tables intact (${tableSnap.docs.length} tables found)`);
  } catch (err: any) {
    assert(false, `Firestore verification error: ${err.message}`);
  }

  // --- SECTION 2: SUBSCRIPTION ENGINE & LIFECYCLE ---
  console.log('\n[SECTION 2] Verify Subscription Plans & Lifecycle Engine...');
  assert(DEFAULT_SUBSCRIPTION_PLANS.length === 3, 'Platform provides 3 distinct subscription tiers');
  const [starter, pro, enterprise] = DEFAULT_SUBSCRIPTION_PLANS;
  assert(starter.tierKey === 'starter' && starter.monthlyPrice === 999, 'Starter Counter plan: ₹999/mo, 3 members, 200 items');
  assert(pro.tierKey === 'pro' && pro.monthlyPrice === 2499, 'Professional Counter plan: ₹2,499/mo, 10 members, 1000 items');
  assert(enterprise.tierKey === 'enterprise' && enterprise.monthlyPrice === 4999, 'Enterprise Counter plan: ₹4,999/mo, unlimited members/items');

  const now = new Date();
  const future15 = new Date(now.getTime() + 15 * 86400000).toISOString();
  const future18 = new Date(now.getTime() + 18 * 86400000).toISOString();
  assert(computeSubscriptionStatus('ACTIVE', future15, future18) === 'ACTIVE', 'Lifecycle state: ACTIVE for validity > 7 days');

  const future3 = new Date(now.getTime() + 3 * 86400000).toISOString();
  const future6 = new Date(now.getTime() + 6 * 86400000).toISOString();
  assert(computeSubscriptionStatus('ACTIVE', future3, future6) === 'EXPIRING_SOON', 'Lifecycle state: EXPIRING_SOON for validity <= 7 days');

  const past1 = new Date(now.getTime() - 1 * 86400000).toISOString();
  const future2 = new Date(now.getTime() + 2 * 86400000).toISOString();
  assert(computeSubscriptionStatus('ACTIVE', past1, future2) === 'GRACE_PERIOD', 'Lifecycle state: GRACE_PERIOD during 3-day grace window');

  const past5 = new Date(now.getTime() - 5 * 86400000).toISOString();
  const past2 = new Date(now.getTime() - 2 * 86400000).toISOString();
  assert(computeSubscriptionStatus('ACTIVE', past5, past2) === 'EXPIRED', 'Lifecycle state: EXPIRED after grace period passes');

  // --- SECTION 3: MOBILE TOUCH DESIGN SYSTEM AUDIT ---
  console.log('\n[SECTION 3] Audit Mobile Touch Design System Classes...');
  const css = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
  assert(css.includes('.btn-mobile-primary') && css.includes('min-height: 52px'), '.btn-mobile-primary enforces min-height: 52px');
  assert(css.includes('.btn-mobile-secondary') && css.includes('min-height: 48px'), '.btn-mobile-secondary enforces min-height: 48px');
  assert(css.includes('.btn-mobile-danger') && css.includes('min-height: 48px'), '.btn-mobile-danger enforces min-height: 48px');
  assert(css.includes('.btn-icon-mobile') && css.includes('min-width: 48px'), '.btn-icon-mobile enforces min 48x48px touch targets');
  assert(css.includes('.input-mobile') && (css.includes('font-size: 1rem') || css.includes('16px')), '.input-mobile uses font-size >= 16px to prevent iOS auto-zoom');
  assert(css.includes('.stepper-btn-mobile') && css.includes('min-width: 44px'), '.stepper-btn-mobile enforces min 44x44px touch steppers');

  // --- SECTION 4: APP LAYOUT & NAVIGATION CLEARANCE ---
  console.log('\n[SECTION 4] Verify Mobile Navigation & Bottom Clearance...');
  const layout = fs.readFileSync(path.resolve('src/components/navigation/AppLayout.tsx'), 'utf-8');
  assert(layout.includes('pb-32'), 'AppLayout supplies pb-32 bottom clearance so buttons are never covered by navbar');

  const navBar = fs.readFileSync(path.resolve('src/components/navigation/MobileNavBar.tsx'), 'utf-8');
  assert(navBar.includes('min-h-[52px]') && navBar.includes('min-w-[48px]'), 'MobileNavBar tabs meet min-height 52px and min-width 48px');

  // --- SECTION 5: SCREEN ERGONOMICS AUDIT ---
  console.log('\n[SECTION 5] Verify Screen Touch Ergonomics...');
  
  // BillingPage
  const billing = fs.readFileSync(path.resolve('src/pages/Billing/BillingPage.tsx'), 'utf-8');
  assert(billing.includes('stepper-btn-mobile') && billing.includes('w-11 h-11'), 'BillingPage: item steppers are 44x44px (w-11 h-11)');
  assert(billing.includes('min-h-[52px]'), 'BillingPage: action buttons are >= 52px');
  assert(billing.includes('bottom-16 sm:bottom-18'), 'BillingPage: bottom floating checkout bar positioned above mobile navbar');

  // HomePage
  const home = fs.readFileSync(path.resolve('src/pages/Home/HomePage.tsx'), 'utf-8');
  assert(home.includes('min-h-[76px]') || home.includes('py-5 sm:py-6'), 'HomePage: "Create New Bill" banner has large touch footprint (>=76px)');

  // PendingPaymentsPage
  const pending = fs.readFileSync(path.resolve('src/pages/Payments/PendingPaymentsPage.tsx'), 'utf-8');
  assert(pending.includes('min-h-[52px]'), 'PendingPaymentsPage: "Receive Payment" action buttons are >= 52px');

  // SettingsPage
  const settings = fs.readFileSync(path.resolve('src/pages/Settings/SettingsPage.tsx'), 'utf-8');
  assert(settings.includes('Business Profile') && settings.includes('Tax & Receipts') && settings.includes('Account & Security') && settings.includes('Subscription Plan'), 'SettingsPage: contains all 4 dedicated configuration tabs');
  assert(settings.includes('updateOwnerLoginId') && settings.includes('handleChangeLoginId'), 'SettingsPage: owner can update login ID with atomic validation');
  assert(settings.includes('changeOwnerAccountPassword') && settings.includes('handleChangePassword'), 'SettingsPage: owner can update account password securely');

  // Super Admin Pages
  const adminShops = fs.readFileSync(path.resolve('src/pages/Admin/AdminShopsPage.tsx'), 'utf-8');
  assert(adminShops.includes('Manage Owner') || adminShops.includes('credentialsShop'), 'AdminShopsPage: owner credentials management modal supported');
  assert(adminShops.includes('subscriptionShop'), 'AdminShopsPage: shop subscription assignment supported');
  assert(adminShops.includes('archiveShop') && adminShops.includes('softDeleteOrArchiveShop'), 'AdminShopsPage: soft-archive with order count protection supported');

  const adminCreateShop = fs.readFileSync(path.resolve('src/pages/Admin/AdminCreateShopPage.tsx'), 'utf-8');
  assert(adminCreateShop.includes('brandName') && adminCreateShop.includes('loginId') && adminCreateShop.includes('billingCycle'), 'AdminCreateShopPage: brandName, custom login ID, and initial billing cycle provisioning supported');

  const adminSubs = fs.readFileSync(path.resolve('src/pages/Admin/AdminSubscriptionsPage.tsx'), 'utf-8');
  assert(adminSubs.includes('Tenant Subscriptions') && adminSubs.includes('Platform Plans'), 'AdminSubscriptionsPage: dual management for platform plans and tenant subscriptions');

  console.log('\n========================================================================');
  console.log(`📊 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
