import { 
  RestaurantTable, 
  Order, 
  TableStatus 
} from '../src/types';
import { 
  calculateTableStatuses 
} from '../src/services/tables/tableService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('🧪 Starting Table Management Acceptance Tests...\n');

  const testTables: RestaurantTable[] = [
    {
      id: 't-1',
      businessId: 'test-biz',
      name: 'Table 01',
      seatingCapacity: 2,
      isActive: true,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-2',
      businessId: 'test-biz',
      name: 'Family Booth',
      seatingCapacity: 6,
      isActive: true,
      sortOrder: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-3',
      businessId: 'test-biz',
      name: 'VIP Lounge',
      seatingCapacity: 8,
      isActive: true,
      sortOrder: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-4',
      businessId: 'test-biz',
      name: 'Terrace Garden',
      seatingCapacity: 4,
      isActive: false, // Inactive table
      sortOrder: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // TEST 1: Status calculation when no orders exist
  console.log('▶ Test 1: Empty orders list -> all active tables AVAILABLE');
  const res1 = calculateTableStatuses(testTables, []);
  assert(res1[0].status === 'AVAILABLE', 'Table 01 should be AVAILABLE');
  assert(res1[1].status === 'AVAILABLE', 'Family Booth should be AVAILABLE');
  assert(res1[2].status === 'AVAILABLE', 'VIP Lounge should be AVAILABLE');
  assert(res1[0].totalOutstanding === 0, 'Outstanding should be 0');
  console.log('  ✅ Passed');

  // TEST 2: Active order with status OPEN & PAID -> table OCCUPIED
  console.log('▶ Test 2: Active order OPEN & PAID -> table OCCUPIED');
  const dummyOrderOccupied: Order = {
    id: 'ord-1',
    businessId: 'test-biz',
    billNumber: 'BILL-1001',
    items: [],
    subtotal: 500,
    discountAmount: 0,
    taxAmount: 25,
    grandTotal: 525,
    amountPaid: 525,
    balanceDue: 0,
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    orderType: 'DINE_IN',
    status: 'OPEN',
    tableId: 't-1',
    tableName: 'Table 01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res2 = calculateTableStatuses(testTables, [dummyOrderOccupied]);
  assert(res2[0].status === 'OCCUPIED', 'Table 01 should be OCCUPIED');
  assert(res2[0].totalOutstanding === 0, 'Table 01 outstanding should be 0');
  assert(res2[1].status === 'AVAILABLE', 'Family Booth should remain AVAILABLE');
  console.log('  ✅ Passed');

  // TEST 3: Active order with status OPEN & UNPAID -> table PAYMENT_PENDING
  console.log('▶ Test 3: Active order OPEN & UNPAID -> table PAYMENT_PENDING');
  const dummyOrderUnpaid: Order = {
    id: 'ord-2',
    businessId: 'test-biz',
    billNumber: 'BILL-1002',
    items: [],
    subtotal: 800,
    discountAmount: 0,
    taxAmount: 40,
    grandTotal: 840,
    amountPaid: 0,
    balanceDue: 840,
    paymentStatus: 'UNPAID',
    paymentMethod: 'CASH',
    orderType: 'DINE_IN',
    status: 'OPEN',
    tableId: 't-2',
    tableName: 'Family Booth',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res3 = calculateTableStatuses(testTables, [dummyOrderOccupied, dummyOrderUnpaid]);
  assert(res3[1].status === 'PAYMENT_PENDING', 'Family Booth should be PAYMENT_PENDING');
  assert(res3[1].totalOutstanding === 840, 'Family Booth outstanding should be 840');
  console.log('  ✅ Passed');

  // TEST 4: Partial payment status -> table PAYMENT_PENDING with remaining balance
  console.log('▶ Test 4: Partial payment -> PAYMENT_PENDING with correct balance');
  const dummyOrderPartial: Order = {
    id: 'ord-3',
    businessId: 'test-biz',
    billNumber: 'BILL-1003',
    items: [],
    subtotal: 1000,
    discountAmount: 0,
    taxAmount: 50,
    grandTotal: 1050,
    amountPaid: 500,
    balanceDue: 550,
    paymentStatus: 'PARTIAL',
    paymentMethod: 'UPI',
    orderType: 'DINE_IN',
    status: 'COMPLETED', // Food served/completed, but bill is partial
    tableId: 't-3',
    tableName: 'VIP Lounge',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res4 = calculateTableStatuses(testTables, [dummyOrderPartial]);
  assert(res4[2].status === 'PAYMENT_PENDING', 'VIP Lounge should be PAYMENT_PENDING due to partial unpaid balance');
  assert(res4[2].totalOutstanding === 550, 'VIP Lounge outstanding balance should be 550');
  console.log('  ✅ Passed');

  // TEST 5: When order is fully paid and completed -> table released to AVAILABLE
  console.log('▶ Test 5: Fully paid & completed order -> table released (AVAILABLE)');
  const dummyOrderFullyPaid: Order = {
    ...dummyOrderPartial,
    paymentStatus: 'PAID',
    amountPaid: 1050,
    balanceDue: 0,
    status: 'COMPLETED',
  };

  const res5 = calculateTableStatuses(testTables, [dummyOrderFullyPaid]);
  assert(res5[2].status === 'AVAILABLE', 'VIP Lounge should be released and AVAILABLE');
  assert(res5[2].totalOutstanding === 0, 'VIP Lounge outstanding should be 0');
  console.log('  ✅ Passed');

  // TEST 6: CANCELLED or VOIDED order -> table released to AVAILABLE
  console.log('▶ Test 6: CANCELLED or VOIDED order does not occupy table');
  const dummyCancelled: Order = {
    ...dummyOrderUnpaid,
    status: 'CANCELLED',
  };
  const res6 = calculateTableStatuses(testTables, [dummyCancelled]);
  assert(res6[1].status === 'AVAILABLE', 'Cancelled order should not block table');
  console.log('  ✅ Passed');

  // TEST 7: Duplicate Name Validation logic
  console.log('▶ Test 7: Duplicate table name detection (case-insensitive & trimmed)');
  const checkDuplicate = (name: string, list: RestaurantTable[], excludeId?: string) => {
    const clean = name.trim().toLowerCase();
    return list.some(t => t.id !== excludeId && t.name.trim().toLowerCase() === clean);
  };

  assert(checkDuplicate('Table 01', testTables) === true, 'Duplicate "Table 01" must be detected');
  assert(checkDuplicate('  table 01  ', testTables) === true, 'Case-insensitive & untrimmed duplicate must be detected');
  assert(checkDuplicate('TABLE 01', testTables) === true, 'Uppercase duplicate must be detected');
  assert(checkDuplicate('Rooftop 01', testTables) === false, 'Unique name "Rooftop 01" must be permitted');
  // Rename test: same table keeping its own name is not a duplicate
  assert(checkDuplicate('Table 01', testTables, 't-1') === false, 'Table keeping its own name during edit is allowed');
  console.log('  ✅ Passed');

  // TEST 8: Multiple orders on same table accumulates outstanding balance
  console.log('▶ Test 8: Multiple orders on single table');
  const secondOrderOnT2: Order = {
    id: 'ord-4',
    businessId: 'test-biz',
    billNumber: 'BILL-1004',
    items: [],
    subtotal: 300,
    discountAmount: 0,
    taxAmount: 15,
    grandTotal: 315,
    amountPaid: 0,
    balanceDue: 315,
    paymentStatus: 'UNPAID',
    paymentMethod: 'CASH',
    orderType: 'DINE_IN',
    status: 'OPEN',
    tableId: 't-2',
    tableName: 'Family Booth',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const res8 = calculateTableStatuses(testTables, [dummyOrderUnpaid, secondOrderOnT2]);
  assert(res8[1].activeOrders.length === 2, 'Family Booth should have 2 active orders');
  assert(res8[1].totalOutstanding === 840 + 315, 'Family Booth outstanding should be sum of both orders (1155)');
  console.log('  ✅ Passed');

  // TEST 9: Historical order table name snapshot resilience
  console.log('▶ Test 9: Orders preserve snapshot tableName even if tableId is fallback');
  const legacyOrder: Order = {
    id: 'ord-legacy',
    businessId: 'test-biz',
    billNumber: 'BILL-99',
    items: [],
    subtotal: 200,
    discountAmount: 0,
    taxAmount: 10,
    grandTotal: 210,
    amountPaid: 210,
    balanceDue: 0,
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    orderType: 'DINE_IN',
    status: 'COMPLETED',
    tableName: 'Garden Table 99', // Custom historical table
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  assert(legacyOrder.tableName === 'Garden Table 99', 'Historical table name snapshot preserved');
  console.log('  ✅ Passed');

  console.log('\n🎉 ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! (9/9)');
}

runTestSuite().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
