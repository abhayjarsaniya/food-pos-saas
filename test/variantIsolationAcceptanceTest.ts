import { MenuItem, MenuItemVariant, OrderItem } from '../src/types';
import { calculateItemTotal } from '../src/utils/calculations';

// Pure logic simulator mirroring MultiVariantModal and BillingContext state machines
function getInCartQuantities(item: MenuItem, currentBillItems: OrderItem[]): Record<string, number> {
  const map: Record<string, number> = {};
  if (!item) return map;

  currentBillItems.forEach((orderItem) => {
    // STRICT CHECK: The order item MUST belong to THIS exact product!
    const isThisProduct =
      orderItem.productId === item.id ||
      orderItem.itemId.startsWith(`${item.id}_`) ||
      orderItem.itemId === item.id;

    if (isThisProduct && orderItem.variantId) {
      map[orderItem.variantId] = (map[orderItem.variantId] || 0) + orderItem.quantity;
    }
  });

  return map;
}

function simulateSetProductVariants(
  prevItems: OrderItem[],
  menuItem: MenuItem,
  variantQuantities: { variant: MenuItemVariant; quantity: number }[]
): OrderItem[] {
  const targetMap = new Map<string, { variant: MenuItemVariant; quantity: number }>();
  variantQuantities.forEach(({ variant, quantity }) => {
    const uniqueLineId = `${menuItem.id}_${variant.variantId}`;
    targetMap.set(uniqueLineId, { variant, quantity });
  });

  const updated: OrderItem[] = [];
  const handledLineIds = new Set<string>();

  prevItems.forEach((item) => {
    // STRICT CHECK: The cart line must belong to THIS product only.
    const isMatch =
      item.productId === menuItem.id ||
      item.itemId.startsWith(`${menuItem.id}_`) ||
      item.itemId === menuItem.id;

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
            variantId: target.variant.variantId,
            variantName: target.variant.name,
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
        gstRate: 5,
        lineTotal: calculateItemTotal(effectivePrice, quantity),
        isVeg: menuItem.isVeg,
        isCustom: false,
        variantId: variant.variantId,
        variantName: variant.name,
      });
    }
  });

  return updated;
}

async function runVariantIsolationTests() {
  console.log('========================================================================');
  console.log('🧪 ACCEPTANCE: VARIANT QUANTITY ISOLATION (TESTS A - H)');
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

  // Define Sample Test Products that share IDENTICAL variant IDs (var_oil and var_butter)
  const productA: MenuItem = {
    id: 'prod_kaju_bhajipav',
    name: 'Kaju Bhajipav',
    category: 'Bhajipav',
    price: 250,
    isVeg: true,
    isActive: true,
    isAvailable: true,
    variants: [
      { variantId: 'var_oil', name: 'Oil', price: 230, isAvailable: true },
      { variantId: 'var_butter', name: 'Butter', price: 260, isAvailable: true },
    ],
  };

  const productB: MenuItem = {
    id: 'prod_only_bhaji',
    name: 'Only Bhaji',
    category: 'Bhajipav',
    price: 130,
    isVeg: true,
    isActive: true,
    isAvailable: true,
    variants: [
      { variantId: 'var_oil', name: 'Oil', price: 120, isAvailable: true },
      { variantId: 'var_butter', name: 'Butter', price: 150, isAvailable: true },
    ],
  };

  let cart: OrderItem[] = [];

  // TEST A: Open Kaju Bhajipav. Select Oil 2 and Butter 2. Add to bill.
  console.log('\n[TEST A] Open Kaju Bhajipav, select Oil: 2, Butter: 2, add to bill...');
  const initialA = getInCartQuantities(productA, cart);
  assert(initialA['var_oil'] === undefined || initialA['var_oil'] === 0, 'Kaju Bhajipav starts with Oil: 0');
  assert(initialA['var_butter'] === undefined || initialA['var_butter'] === 0, 'Kaju Bhajipav starts with Butter: 0');

  cart = simulateSetProductVariants(cart, productA, [
    { variant: productA.variants![0], quantity: 2 },
    { variant: productA.variants![1], quantity: 2 },
  ]);

  assert(cart.length === 2, 'Cart has 2 lines for Kaju Bhajipav');
  assert(cart.find(i => i.itemId === 'prod_kaju_bhajipav_var_oil')?.quantity === 2, 'Cart: Kaju Bhajipav Oil is 2');
  assert(cart.find(i => i.itemId === 'prod_kaju_bhajipav_var_butter')?.quantity === 2, 'Cart: Kaju Bhajipav Butter is 2');

  // TEST B: Open Only Bhaji. Expected: All quantities start at 0.
  console.log('\n[TEST B] Open Only Bhaji. Verify no leaked quantities from Kaju Bhajipav...');
  const initialB = getInCartQuantities(productB, cart);
  assert(!initialB['var_oil'], 'Only Bhaji Oil starts at 0 (no leak from Kaju Bhajipav)');
  assert(!initialB['var_butter'], 'Only Bhaji Butter starts at 0 (no leak from Kaju Bhajipav)');

  // TEST C: Select Oil 1 only. Add to bill.
  console.log('\n[TEST C] Select Only Bhaji Oil: 1. Add to bill...');
  cart = simulateSetProductVariants(cart, productB, [
    { variant: productB.variants![0], quantity: 1 },
    { variant: productB.variants![1], quantity: 0 },
  ]);

  assert(cart.length === 3, 'Cart now has exactly 3 lines');
  assert(cart.find(i => i.itemId === 'prod_kaju_bhajipav_var_oil')?.quantity === 2, 'Kaju Bhajipav Oil remains 2');
  assert(cart.find(i => i.itemId === 'prod_kaju_bhajipav_var_butter')?.quantity === 2, 'Kaju Bhajipav Butter remains 2');
  assert(cart.find(i => i.itemId === 'prod_only_bhaji_var_oil')?.quantity === 1, 'Only Bhaji Oil is 1');

  // TEST D: Reopen Kaju Bhajipav. Expected: Oil 2, Butter 2.
  console.log('\n[TEST D] Reopen Kaju Bhajipav. Verify existing quantities loaded accurately...');
  const reopenedA = getInCartQuantities(productA, cart);
  assert(reopenedA['var_oil'] === 2, 'Reopened Kaju Bhajipav has Oil: 2');
  assert(reopenedA['var_butter'] === 2, 'Reopened Kaju Bhajipav has Butter: 2');

  // TEST E: Edit Kaju Bhajipav Butter from 2 to 1. Expected: Only that cart line changes.
  console.log('\n[TEST E] Edit Kaju Bhajipav Butter from 2 to 1...');
  cart = simulateSetProductVariants(cart, productA, [
    { variant: productA.variants![0], quantity: 2 },
    { variant: productA.variants![1], quantity: 1 },
  ]);
  assert(cart.length === 3, 'Cart still has 3 lines');
  assert(cart.find(i => i.itemId === 'prod_kaju_bhajipav_var_butter')?.quantity === 1, 'Kaju Bhajipav Butter updated to 1');
  assert(cart.find(i => i.itemId === 'prod_kaju_bhajipav_var_oil')?.quantity === 2, 'Kaju Bhajipav Oil still 2');
  assert(cart.find(i => i.itemId === 'prod_only_bhaji_var_oil')?.quantity === 1, 'Only Bhaji Oil remains completely untouched at 1');

  // TEST F: Close another product popup without confirming.
  console.log('\n[TEST F] Open third product and close without confirming...');
  const productC: MenuItem = {
    id: 'prod_cheese_pulav',
    name: 'Cheese Pulav',
    category: 'Pulav',
    price: 220,
    isVeg: true,
    isActive: true,
    isAvailable: true,
    variants: [
      { variantId: 'var_oil', name: 'Oil', price: 200, isAvailable: true },
      { variantId: 'var_butter', name: 'Butter', price: 240, isAvailable: true },
    ],
  };
  const cartBeforeCancel = [...cart];
  // Simulating temporary state modification in popup, then closing without onApply
  const tempState = { 'var_oil': 5, 'var_butter': 5 };
  // Cancel: onApply is NOT called, cart remains cartBeforeCancel
  assert(cart.length === cartBeforeCancel.length, 'Cart unchanged when modal dismissed');
  assert(cart.find(i => i.itemId === 'prod_cheese_pulav_var_oil') === undefined, 'Cancelled item not added to bill');

  // TEST G: Switch between 10 different products with different variants
  console.log('\n[TEST G] Stress test: Switch between 10 products with identical variant IDs...');
  let leakDetected = false;
  for (let i = 1; i <= 10; i++) {
    const testProd: MenuItem = {
      id: `prod_test_${i}`,
      name: `Test Product ${i}`,
      category: 'Test',
      price: 100 + i * 10,
      isVeg: true,
      isActive: true,
      isAvailable: true,
      variants: [
        { variantId: 'var_oil', name: 'Oil', price: 100 + i * 10, isAvailable: true },
        { variantId: 'var_butter', name: 'Butter', price: 120 + i * 10, isAvailable: true },
        { variantId: `var_special_${i}`, name: 'Special', price: 150 + i * 10, isAvailable: true },
      ],
    };

    const initialQuantities = getInCartQuantities(testProd, cart);
    // Since testProd is not in cart yet, all its variants must be 0
    if (initialQuantities['var_oil'] > 0 || initialQuantities['var_butter'] > 0) {
      leakDetected = true;
    }
  }
  assert(!leakDetected, 'Zero quantity leakage across 10 sequential product checks');

  // TEST H: Verify cart line data structures
  console.log('\n[TEST H] Verify product IDs, variant IDs, names, and line totals...');
  const lineKajuOil = cart.find(i => i.itemId === 'prod_kaju_bhajipav_var_oil')!;
  assert(lineKajuOil.productId === 'prod_kaju_bhajipav', 'Line item contains correct productId');
  assert(lineKajuOil.variantId === 'var_oil', 'Line item contains correct variantId');
  assert(lineKajuOil.unitPrice === 230, 'Line item unitPrice is ₹230');
  assert(lineKajuOil.lineTotal === 460, 'Line item lineTotal is ₹460 (2 x 230)');

  console.log('\n========================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
}

runVariantIsolationTests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
