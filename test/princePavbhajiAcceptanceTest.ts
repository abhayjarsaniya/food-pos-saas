import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig, 'PRINCE_TEST');
const auth = getAuth(app);
const db = getFirestore(app);

const B_ID = 'biz_prince_pavbhaji_01';

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 ACCEPTANCE SUITE: PRINCE PAVBHAJI SHOP & MENU IN FIRESTORE');
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

  // 1. Authenticate as Super Admin to access platform/business records
  console.log('\n[TEST 1] Authenticate Super Admin...');
  const adminCred = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  assert(adminCred.user.email === 'superadmin@foodpos.app', 'Super Admin authenticated for verification');

  // 2. Verify Business Profile Document
  console.log('\n[TEST 2] Verify Prince Pavbhaji Business Profile...');
  const bSnap = await getDoc(doc(db, 'businesses', B_ID));
  assert(bSnap.exists(), `businesses/${B_ID} document exists`);
  if (bSnap.exists()) {
    const data = bSnap.data();
    assert(data?.businessName === 'Prince Pavbhaji', 'businessName is "Prince Pavbhaji"');
    assert(data?.brandName === 'Prince Bhajipav Manekchowkwala', 'brandName is "Prince Bhajipav Manekchowkwala"');
    assert(data?.category === 'Restaurant / Fast Food', 'category is "Restaurant / Fast Food"');
    assert(data?.phone === '+91 6355 432 020', 'phone is "+91 6355 432 020"');
    assert(data?.email === 'princebhajipav16@gmail.com', 'email is "princebhajipav16@gmail.com"');
    assert(data?.deliveryRadius === '3 KM', 'deliveryRadius is "3 KM"');
    assert(data?.status === 'ACTIVE', 'status is "ACTIVE"');
  }

  // 3. Verify Categories
  console.log('\n[TEST 3] Verify 13 Menu Categories...');
  const catSnap = await getDocs(collection(db, 'businesses', B_ID, 'categories'));
  assert(catSnap.size === 13, `Exact 13 categories exist (Found: ${catSnap.size})`);

  const expectedCategories = [
    'Bhajipav',
    'Speciality Dishes',
    'Pulav',
    'Dosa',
    'Fancy Dosa',
    'Uttapam',
    'Sandwiches',
    'Special Sandwiches',
    'Ice Cream Sandwiches',
    'Pizza',
    'Halka Fulka',
    'Shakes & Beverages',
    'Anniversary Combo Offers',
  ];

  const actualCategoryNames = catSnap.docs.map(d => d.data().name);
  expectedCategories.forEach(name => {
    assert(actualCategoryNames.includes(name), `Category "${name}" is present`);
  });

  // 4. Verify Menu Items & Variants
  console.log('\n[TEST 4] Verify Menu Items & Variants...');
  const itemSnap = await getDocs(collection(db, 'businesses', B_ID, 'menuItems'));
  assert(itemSnap.size === 101, `Exact 101 menu items exist (Found: ${itemSnap.size})`);

  // Verify Bhajipav (Oil 15000, Butter 18000)
  const bhajipavDoc = itemSnap.docs.find(d => d.data().name === 'Bhajipav');
  assert(!!bhajipavDoc, 'Item "Bhajipav" found');
  if (bhajipavDoc) {
    const data = bhajipavDoc.data();
    const oilVariant = data.variants?.find((v: any) => v.variantId === 'oil');
    const butterVariant = data.variants?.find((v: any) => v.variantId === 'butter');
    assert(oilVariant?.price === 15000, 'Bhajipav Oil variant price is 15000 paise (₹150)');
    assert(butterVariant?.price === 18000, 'Bhajipav Butter variant price is 18000 paise (₹180)');
  }

  // Verify Cheese Sada Dosa (Oil not listed, Butter 17000)
  const cheeseSadaDosa = itemSnap.docs.find(d => d.data().name === 'Cheese Sada Dosa');
  assert(!!cheeseSadaDosa, 'Item "Cheese Sada Dosa" found');
  if (cheeseSadaDosa) {
    const data = cheeseSadaDosa.data();
    const oilVariant = data.variants?.find((v: any) => v.variantId === 'oil');
    const butterVariant = data.variants?.find((v: any) => v.variantId === 'butter');
    assert(oilVariant?.isAvailable === false, 'Cheese Sada Dosa Oil variant is unavailable (not listed)');
    assert(butterVariant?.price === 17000 && butterVariant?.isAvailable === true, 'Cheese Sada Dosa Butter is ₹170');
  }

  // Verify Ghughra Sandwich (Toast 14000, Grill not listed)
  const ghughra = itemSnap.docs.find(d => d.data().name === 'Ghughra Sandwich');
  assert(!!ghughra, 'Item "Ghughra Sandwich" found');
  if (ghughra) {
    const data = ghughra.data();
    const toastVariant = data.variants?.find((v: any) => v.variantId === 'toast');
    const grillVariant = data.variants?.find((v: any) => v.variantId === 'grill');
    assert(toastVariant?.price === 14000, 'Ghughra Toast is ₹140');
    assert(grillVariant?.isAvailable === false, 'Ghughra Grill is unavailable (not listed)');
  }

  // Verify MRP items: Cold Drink, Water
  const coldDrink = itemSnap.docs.find(d => d.data().name === 'Cold Drink');
  const water = itemSnap.docs.find(d => d.data().name === 'Water');
  assert(coldDrink?.data().priceType === 'mrp', 'Cold Drink has priceType = "mrp"');
  assert(water?.data().priceType === 'mrp', 'Water has priceType = "mrp"');

  // Verify 6 Promotional Combos marked "Needs Owner Confirmation"
  console.log('\n[TEST 5] Verify Promotional Anniversary Combos...');
  const promotionalItems = itemSnap.docs.filter(d => d.data().isPromotional);
  assert(promotionalItems.length === 6, `Found 6 promotional items (Actual: ${promotionalItems.length})`);
  promotionalItems.forEach(d => {
    const item = d.data();
    assert(item.confirmationStatus === 'Needs Owner Confirmation', `${item.name} has status "Needs Owner Confirmation"`);
    assert(item.isActive === false, `${item.name} is inactive pending confirmation`);
  });

  // 5. Verify Login ID Resolution
  console.log('\n[TEST 6] Verify Login ID Resolution for Prince Pavbhaji...');
  const ownerResolved = await resolveStaffLoginId('princeowner');
  assert(ownerResolved?.businessId === B_ID, 'princeowner resolves to Prince Pavbhaji businessId');
  assert(ownerResolved?.role === 'OWNER', 'princeowner role is OWNER');

  const cashierResolved = await resolveStaffLoginId('princecashier');
  assert(cashierResolved?.businessId === B_ID, 'princecashier resolves to Prince Pavbhaji businessId');
  assert(cashierResolved?.role === 'CASHIER', 'princecashier role is CASHIER');

  // 6. Verify Custom Tables
  console.log('\n[TEST 7] Verify Custom Tables for Prince Pavbhaji...');
  const tblSnap = await getDocs(collection(db, 'businesses', B_ID, 'tables'));
  assert(tblSnap.size >= 8, `Found ${tblSnap.size} custom tables for Prince Pavbhaji`);

  console.log('\n========================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================');

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
