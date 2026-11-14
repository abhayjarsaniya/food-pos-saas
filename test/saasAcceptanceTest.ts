import { computeStockStatus } from '../src/services/inventory/inventoryService';
import { seedDemoData, resetDemoData } from '../src/services/admin/demoDataService';
import { createNewShop, updateShopStatus } from '../src/services/admin/superAdminService';
import { createPurchaseOrder, recordGoodsReceipt, recordSupplierPayment } from '../src/services/purchases/purchaseOrderService';
import { addSupplier } from '../src/services/suppliers/supplierService';
import { addInventoryItem, adjustStock, getInventoryItems, getStockMovements } from '../src/services/inventory/inventoryService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

console.log('--- STARTING MULTI-TENANT SAAS & INVENTORY ACCEPTANCE TESTS ---');

// Mock localStorage for Node environment
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>();
  (global as any).localStorage = {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

if (typeof window === 'undefined') {
  (global as any).window = { location: { origin: 'http://localhost:4173' } };
}

async function runTests() {
  // 1. Super Admin Shop Creation Test
  const shopResult = await createNewShop({
    name: 'Bangalore Dosa Corner',
    ownerName: 'Venkatesh',
    ownerEmail: 'venky@bangaloredosa.com',
    phone: '9845012345',
    category: 'food_stall',
    address: 'Indiranagar 100ft Road',
    plan: 'starter',
  });

  assert(shopResult.businessId.startsWith('biz_'), 'Generated unique businessId for tenant');
  assert(shopResult.email === 'venky@bangaloredosa.com', 'Associated owner email correctly');
  assert(shopResult.profile.status === 'ACTIVE', 'Initial account status is ACTIVE');
  assert(typeof shopResult.temporaryPassword === 'string', 'Generated temporary login credentials');

  // 2. Shop Suspension Test
  await updateShopStatus(shopResult.businessId, 'SUSPENDED');
  const { getAllShops } = await import('../src/services/admin/superAdminService');
  const allShops = await getAllShops();
  const suspendedShop = allShops.find((s) => s.id === shopResult.businessId);
  assert(suspendedShop?.status === 'SUSPENDED', 'Super Admin can successfully suspend shop account');

  // 3. Stock Status Threshold Test
  assert(computeStockStatus(0, 10) === 'OUT_OF_STOCK', '0 stock is OUT_OF_STOCK');
  assert(computeStockStatus(5, 10) === 'LOW_STOCK', '5 stock with min 10 is LOW_STOCK');
  assert(computeStockStatus(15, 10) === 'IN_STOCK', '15 stock with min 10 is IN_STOCK');

  // 4. Supplier Module Test
  const bId = 'biz_test_tenant_1';
  const sup = await addSupplier(bId, {
    name: 'Kailash Soni',
    companyName: 'City Spice Distributors',
    mobile: '9825123456',
    suppliedProducts: 'Turmeric, Garam Masala, Red Chilli',
  });
  assert(sup.id.startsWith('sup_'), 'Supplier created with unique ID');
  assert(sup.companyName === 'City Spice Distributors', 'Supplier company name preserved');

  // 5. Inventory & Manual Stock Adjustment with Audit Movement Test
  const invItem = await addInventoryItem(bId, {
    name: 'Kashmiri Red Chilli Powder',
    category: 'Spices',
    unit: 'kg',
    currentStock: 10,
    minimumStock: 3,
    purchasePrice: 420,
    supplierName: sup.companyName,
  });
  assert(invItem.currentStock === 10, 'Initial inventory currentStock is 10 kg');

  await adjustStock(bId, invItem.id, 8.5, 'Kitchen prep usage discrepancy');
  const updatedInvs = await getInventoryItems(bId);
  const adjustedItem = updatedInvs.find((i) => i.id === invItem.id);
  assert(adjustedItem?.currentStock === 8.5, 'Stock updated to 8.5 kg');

  const movements = await getStockMovements(bId);
  const lastMov = movements[0];
  assert(lastMov.reason === 'Kitchen prep usage discrepancy', 'Mandatory reason preserved in stock movements');
  assert(lastMov.quantityChange === -1.5, 'Stock quantityChange calculated accurately (-1.5 kg)');

  // 6. Purchase Order & Goods Receipt (Only received items increase stock)
  const po = await createPurchaseOrder(bId, {
    supplierId: sup.id,
    supplierName: sup.companyName,
    items: [
      {
        inventoryItemId: invItem.id,
        itemName: invItem.name,
        unit: 'kg',
        quantityOrdered: 20,
        quantityReceived: 0,
        unitCost: 400,
        lineTotal: 8000,
      },
    ],
    subtotal: 8000,
    totalAmount: 8000,
    status: 'ORDERED',
  });
  assert(po.status === 'ORDERED', 'PO created with ORDERED status');
  assert(po.amountPaid === 0 && po.balanceDue === 8000, 'Initial payment status is UNPAID');

  // Partial receipt of 12 kg (out of 20 ordered)
  const updatedPO = await recordGoodsReceipt(bId, po.id, [
    { inventoryItemId: invItem.id, receivedNow: 12 },
  ]);
  assert(updatedPO.status === 'PARTIALLY_RECEIVED', 'Status updated to PARTIALLY_RECEIVED on partial delivery');
  assert(updatedPO.items[0].quantityReceived === 12, '12 kg recorded as received');

  const postReceiptInvs = await getInventoryItems(bId);
  const receivedInv = postReceiptInvs.find((i) => i.id === invItem.id);
  assert(receivedInv?.currentStock === 20.5, 'Inventory increased strictly by 12 kg received (8.5 + 12 = 20.5 kg)');

  // 7. Supplier Payment Tracking (Separate from customer sales)
  const payment = await recordSupplierPayment(bId, {
    supplierId: sup.id,
    supplierName: sup.companyName,
    purchaseOrderId: po.id,
    amount: 5000,
    paymentMethod: 'UPI',
    paymentReference: 'UPI/998822/KPS',
  });
  assert(payment.amount === 5000, 'Supplier payment amount 5000 recorded');
  const { getPurchaseOrders } = await import('../src/services/purchases/purchaseOrderService');
  const reloadedPOs = await getPurchaseOrders(bId);
  const paidPO = reloadedPOs.find((p) => p.id === po.id);
  assert(paidPO?.amountPaid === 5000, 'PO amountPaid updated to 5000');
  assert(paidPO?.balanceDue === 3000, 'PO balanceDue updated to 3000');
  assert(paidPO?.paymentStatus === 'PARTIAL', 'PO paymentStatus updated to PARTIAL');

  // 8. Demo Data Seeder Verification (60+ orders: 32 yesterday, 28 today)
  const seedResult = await seedDemoData('demo-business-owner-101');
  assert(seedResult.ordersCreated === 60, 'Demo seeder created exactly 60 sample orders');
  assert(seedResult.yesterdayCount === 32, '32 orders distributed to yesterday');
  assert(seedResult.todayCount === 28, '28 orders distributed to today');

  console.log('--- ALL MULTI-TENANT SAAS & INVENTORY ACCEPTANCE TESTS PASSED! ---');
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Fatal error in tests:', e);
  process.exit(1);
});
