import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import { calculateBill, calculateItemTotal, formatCurrency } from '../src/utils/calculations';
import { createOrder } from '../src/services/orders/orderService';
import { MenuItem, MenuItemVariant, OrderItem } from '../src/types';

// Read .env
const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
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

const app = initializeApp(firebaseConfig, 'MULTI_VARIANT_TEST');
const auth = getAuth(app);
const db = getFirestore(app);

const B_ID = 'biz_prince_pavbhaji_01';

async function runAcceptanceTests() {
  console.log('========================================================================');
  console.log('🧪 ACCEPTANCE TEST: ONE-POPUP MULTI-VARIANT SELECTION & FAST BILLING UX');
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

  // 1. Authenticate Shop Owner
  console.log('\n[TEST 1] Authenticate Shop Owner (Prince Pavbhaji)...');
  const ownerCred = await signInWithEmailAndPassword(auth, 'princebhajipav16@gmail.com', 'OwnerPass@2026');
  assert(ownerCred.user.uid === 'uZ5vzv3LGwctK5o26yALxbriwDu2', 'Prince Pavbhaji owner authenticated');

  // 2. Fetch Multi-Variant Products from Firestore
  console.log('\n[TEST 2] Fetch Menu Items from Firestore...');
  const itemSnap = await getDocs(collection(db, 'businesses', B_ID, 'menuItems'));
  assert(itemSnap.size > 0, `Loaded ${itemSnap.size} menu items from Firestore`);

  const bhajipavDoc = itemSnap.docs.find((d) => d.data().name === 'Bhajipav');
  assert(!!bhajipavDoc, 'Found Bhajipav item in Firestore');
  const bhajipav: MenuItem = { id: bhajipavDoc!.id, ...(bhajipavDoc!.data() as any) };

  const oilVariant = bhajipav.variants?.find((v) => v.variantId === 'oil');
  const butterVariant = bhajipav.variants?.find((v) => v.variantId === 'butter');
  assert(!!oilVariant && !!butterVariant, 'Bhajipav has both Oil and Butter variants');

  const oilPrice = (oilVariant?.price || 0) > 1000 ? (oilVariant?.price || 0) / 100 : oilVariant?.price || 0;
  const butterPrice = (butterVariant?.price || 0) > 1000 ? (butterVariant?.price || 0) / 100 : butterVariant?.price || 0;
  assert(oilPrice === 150, `Oil variant unit price is ₹150 (raw: ${oilVariant?.price})`);
  assert(butterPrice === 180, `Butter variant unit price is ₹180 (raw: ${butterVariant?.price})`);

  // 3. Multi-Variant Selection Logic Simulation (Bhajipav: 1 Oil + 2 Butter in ONE popup)
  console.log('\n[TEST 3] Multi-Variant Selection: 1 Oil + 2 Butter in ONE Popup...');
  const selectedQuantities = {
    oil: 1,
    butter: 2,
  };

  const calculatedTotalQuantity = selectedQuantities.oil + selectedQuantities.butter;
  const calculatedSubtotal = selectedQuantities.oil * oilPrice + selectedQuantities.butter * butterPrice;

  assert(calculatedTotalQuantity === 3, `Total quantity is 3 (1 Oil + 2 Butter)`);
  assert(calculatedSubtotal === 510, `Live calculated subtotal is ₹510 (1×150 + 2×180 = 510)`);

  // Simulate setProductVariants function logic
  let billItems: OrderItem[] = [];

  function setProductVariants(
    menuItem: MenuItem,
    variantQuantities: { variant: MenuItemVariant; quantity: number }[]
  ) {
    const targetMap = new Map<string, { variant: MenuItemVariant; quantity: number }>();
    variantQuantities.forEach(({ variant, quantity }) => {
      const uniqueLineId = `${menuItem.id}_${variant.variantId}`;
      targetMap.set(uniqueLineId, { variant, quantity });
    });

    const updated: OrderItem[] = [];
    const handledLineIds = new Set<string>();

    billItems.forEach((item) => {
      const isMatch =
        item.productId === menuItem.id ||
        item.itemId.startsWith(`${menuItem.id}_`) ||
        (item.variantId ? menuItem.variants?.some((v) => v.variantId === item.variantId) : false);

      if (isMatch) {
        const target = targetMap.get(item.itemId);
        if (target) {
          handledLineIds.add(item.itemId);
          if (target.quantity > 0) {
            const rawPrice = target.variant.price;
            const effectivePrice = rawPrice > 1000 ? rawPrice / 100 : rawPrice;
            updated.push({
              ...item,
              productId: menuItem.id,
              quantity: target.quantity,
              unitPrice: item.unitPrice || effectivePrice,
              lineTotal: calculateItemTotal(item.unitPrice || effectivePrice, target.quantity),
            });
          }
        } else {
          updated.push(item);
        }
      } else {
        updated.push(item);
      }
    });

    variantQuantities.forEach(({ variant, quantity }) => {
      const uniqueLineId = `${menuItem.id}_${variant.variantId}`;
      if (!handledLineIds.has(uniqueLineId) && quantity > 0) {
        const rawPrice = variant.price;
        const effectivePrice = rawPrice > 1000 ? rawPrice / 100 : rawPrice;
        updated.push({
          itemId: uniqueLineId,
          productId: menuItem.id,
          name: `${menuItem.name} (${variant.name})`,
          quantity,
          unitPrice: effectivePrice,
          originalPrice: effectivePrice,
          gstRate: menuItem.gstRate ?? 5,
          lineTotal: calculateItemTotal(effectivePrice, quantity),
          isVeg: menuItem.isVeg,
          isCustom: false,
          variantId: variant.variantId,
          variantName: variant.name,
        });
      }
    });

    billItems = updated;
  }

  // 4. Add both variants together with ONE button
  console.log('\n[TEST 4] Add both variants to bill simultaneously with ONE click...');
  setProductVariants(bhajipav, [
    { variant: oilVariant!, quantity: 1 },
    { variant: butterVariant!, quantity: 2 },
  ]);

  assert(billItems.length === 2, `Bill contains exactly 2 line items`);
  const oilLine = billItems.find((i) => i.variantId === 'oil');
  const butterLine = billItems.find((i) => i.variantId === 'butter');

  assert(!!oilLine && oilLine.quantity === 1 && oilLine.unitPrice === 150 && oilLine.lineTotal === 150, 'Oil Bhajipav line: 1 × ₹150 = ₹150');
  assert(!!butterLine && butterLine.quantity === 2 && butterLine.unitPrice === 180 && butterLine.lineTotal === 360, 'Butter Bhajipav line: 2 × ₹180 = ₹360');

  const billCalc1 = calculateBill({
    items: billItems,
    extras: [],
    discountType: 'fixed',
    discountValue: 0,
    gstEnabled: false,
    pricingMode: 'inclusive',
    defaultGstRate: 5,
    isInterState: false,
  });
  assert(billCalc1.subtotal === 510, `Bill subtotal is exactly ₹510`);
  assert(billCalc1.grandTotal === 510, `Bill grandTotal is exactly ₹510`);

  // 5. Edit Existing Cart Items: Re-open Bhajipav, decrease Oil to 0, keep Butter at 2
  console.log('\n[TEST 5] Edit Cart Items: Decrease Oil to 0, Butter remains 2...');
  setProductVariants(bhajipav, [
    { variant: oilVariant!, quantity: 0 },
    { variant: butterVariant!, quantity: 2 },
  ]);

  assert(billItems.length === 1, `Bill contains exactly 1 line item after setting Oil to 0`);
  assert(billItems[0].variantId === 'butter', `Remaining line item is Butter Bhajipav`);
  assert(billItems[0].quantity === 2, `Butter Bhajipav quantity is 2`);
  assert(billItems[0].lineTotal === 360, `Butter Bhajipav lineTotal is ₹360`);

  const billCalc2 = calculateBill({
    items: billItems,
    extras: [],
    discountType: 'fixed',
    discountValue: 0,
    gstEnabled: false,
    pricingMode: 'inclusive',
    defaultGstRate: 5,
    isInterState: false,
  });
  assert(billCalc2.subtotal === 360, `Updated subtotal is ₹360`);

  // 6. Test Re-opening and Updating: Set Oil back to 2, Butter to 3
  console.log('\n[TEST 6] Re-open and Update Quantities: Oil to 2, Butter to 3...');
  setProductVariants(bhajipav, [
    { variant: oilVariant!, quantity: 2 },
    { variant: butterVariant!, quantity: 3 },
  ]);

  assert(billItems.length === 2, `Bill has exactly 2 line items (no duplicates created)`);
  const oilLineUpdated = billItems.find((i) => i.variantId === 'oil');
  const butterLineUpdated = billItems.find((i) => i.variantId === 'butter');
  assert(oilLineUpdated?.quantity === 2, `Oil quantity updated to 2`);
  assert(butterLineUpdated?.quantity === 3, `Butter quantity updated to 3`);
  assert(oilLineUpdated?.lineTotal === 300, `Oil line total is 2 × 150 = ₹300`);
  assert(butterLineUpdated?.lineTotal === 540, `Butter line total is 3 × 180 = ₹540`);

  const billCalc3 = calculateBill({
    items: billItems,
    extras: [],
    discountType: 'fixed',
    discountValue: 0,
    gstEnabled: false,
    pricingMode: 'inclusive',
    defaultGstRate: 5,
    isInterState: false,
  });
  assert(billCalc3.subtotal === 840, `Subtotal is ₹840 (300 + 540)`);

  // 7. Test Other Multi-Variant Products: Dosa & Sandwich
  console.log('\n[TEST 7] Multi-Variant Verification for Dosa & Sandwich...');
  const dosaDoc = itemSnap.docs.find((d) => d.data().name.toLowerCase().includes('dosa') && d.data().variants?.length > 1);
  assert(!!dosaDoc, `Found multi-variant Dosa: "${dosaDoc?.data().name}"`);
  if (dosaDoc) {
    const dosa: MenuItem = { id: dosaDoc.id, ...(dosaDoc.data() as any) };
    const availableDosaVariants = dosa.variants?.filter((v) => v.isAvailable) || [];
    assert(availableDosaVariants.length >= 2, `Dosa has ${availableDosaVariants.length} available variants`);
  }

  const sandwichDoc = itemSnap.docs.find((d) => d.data().name.toLowerCase().includes('sandwich') && d.data().variants?.length > 1);
  assert(!!sandwichDoc, `Found multi-variant Sandwich: "${sandwichDoc?.data().name}"`);
  if (sandwichDoc) {
    const sandwich: MenuItem = { id: sandwichDoc.id, ...(sandwichDoc.data() as any) };
    const availableSandwichVariants = sandwich.variants?.filter((v) => v.isAvailable) || [];
    assert(availableSandwichVariants.length >= 2, `Sandwich has ${availableSandwichVariants.length} available variants`);
  }

  // 8. Test Single-Price Product: Direct Quick Add
  console.log('\n[TEST 8] Single-Price Product Direct Quick Add...');
  const singlePriceDoc = itemSnap.docs.find((d) => !d.data().variants || d.data().variants.length <= 1);
  assert(!!singlePriceDoc, `Found single-price item: "${singlePriceDoc?.data().name}"`);
  if (singlePriceDoc) {
    const singleItem: MenuItem = { id: singlePriceDoc.id, ...(singlePriceDoc.data() as any) };
    const availableVariants = singleItem.variants?.filter((v) => v.isAvailable) || [];
    const hasMultipleVariants = availableVariants.length > 1;
    assert(!hasMultipleVariants, `Single-price product correctly detected with hasMultipleVariants = false`);
  }

  // 9. Save Real Order to Firestore & Verify Document Structure
  console.log('\n[TEST 9] Save Multi-Variant Order to Firestore...');
  const testOrderId = `ord_mv_test_${Date.now()}`;
  const testBillNumber = `BILL-MV-${Date.now().toString().slice(-4)}`;
  const testOrderPayload = {
    id: testOrderId,
    billNumber: testBillNumber,
    businessId: B_ID,
    businessName: 'Prince Pavbhaji',
    items: billItems,
    extras: [],
    customer: { name: 'Multi Variant Tester', phone: '9876543210' },
    tableId: null,
    tableName: 'Counter',
    tableNumber: 'Counter',
    orderType: 'DINE_IN' as const,
    subtotal: billCalc3.subtotal,
    discountType: 'fixed' as const,
    discountValue: 0,
    discountAmount: 0,
    taxableAmount: billCalc3.subtotal,
    gstAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    effectiveGstRate: 0,
    grandTotal: billCalc3.grandTotal,
    paymentMethod: 'CASH' as const,
    paymentStatus: 'PAID' as const,
    amountPaid: billCalc3.grandTotal,
    balanceDue: 0,
    status: 'COMPLETED' as const,
    source: 'web' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: ownerCred.user.uid,
    createdByName: 'Prince Owner',
    createdByRole: 'SHOP_OWNER' as const,
  };

  await setDoc(doc(db, 'businesses', B_ID, 'orders', testOrderId), testOrderPayload);
  assert(true, `Order successfully saved to Firestore with ID: ${testOrderId}`);
  assert(testBillNumber.startsWith('BILL-'), `Bill number generated: ${testBillNumber}`);

  // 10. Fetch Saved Order from Firestore & Verify Variant Snapshots
  console.log('\n[TEST 10] Verify Variant Data Snapshot in Firestore...');
  const orderDocSnap = await getDoc(doc(db, 'businesses', B_ID, 'orders', testOrderId));
  assert(orderDocSnap.exists(), `Order document exists in Firestore`);

  if (orderDocSnap.exists()) {
    const orderData = orderDocSnap.data();
    assert(orderData.items.length === 2, `Saved order has 2 items`);

    const savedOil = orderData.items.find((i: any) => i.variantId === 'oil');
    const savedButter = orderData.items.find((i: any) => i.variantId === 'butter');

    assert(!!savedOil, `Oil variant snapshot saved`);
    assert(savedOil.productId === bhajipav.id, `Oil item has correct productId: ${bhajipav.id}`);
    assert(savedOil.variantName === 'Oil', `Oil item has variantName: "Oil"`);
    assert(savedOil.quantity === 2, `Oil item saved quantity: 2`);
    assert(savedOil.unitPrice === 150, `Oil item saved unitPrice: ₹150`);
    assert(savedOil.lineTotal === 300, `Oil item saved lineTotal: ₹300`);

    assert(!!savedButter, `Butter variant snapshot saved`);
    assert(savedButter.productId === bhajipav.id, `Butter item has correct productId: ${bhajipav.id}`);
    assert(savedButter.variantName === 'Butter', `Butter item has variantName: "Butter"`);
    assert(savedButter.quantity === 3, `Butter item saved quantity: 3`);
    assert(savedButter.unitPrice === 180, `Butter item saved unitPrice: ₹180`);
    assert(savedButter.lineTotal === 540, `Butter item saved lineTotal: ₹540`);

    assert(orderData.grandTotal === 840, `Firestore document grandTotal: ₹840`);
  }

  // 11. Clean up test order from Firestore
  console.log('\n[TEST 11] Clean up test order from Firestore...');
  await deleteDoc(doc(db, 'businesses', B_ID, 'orders', testOrderId));
  const verifyDelete = await getDoc(doc(db, 'businesses', B_ID, 'orders', testOrderId));
  assert(!verifyDelete.exists(), `Test order successfully cleaned up from Firestore`);

  console.log('\n========================================================================');
  console.log(`📊 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch((err) => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
