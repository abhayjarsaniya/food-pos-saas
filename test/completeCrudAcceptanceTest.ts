import { auth, db } from '../src/services/firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, deleteDoc, query, where } from 'firebase/firestore';

// Services
import { 
  addCategory, 
  updateCategory, 
  deleteCategory, 
  getCategories,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuItems
} from '../src/services/business/businessService';

import {
  addInventoryItem,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
  getInventoryItems,
  getStockMovements
} from '../src/services/inventory/inventoryService';

import {
  addSupplier,
  updateSupplier,
  toggleArchiveSupplier,
  deleteSupplier,
  getSuppliers
} from '../src/services/suppliers/supplierService';

import {
  createPurchaseOrder,
  cancelPurchaseOrder,
  recordGoodsReceipt,
  getPurchaseOrders
} from '../src/services/purchases/purchaseOrderService';

import {
  addCustomer,
  updateCustomer,
  toggleArchiveCustomer,
  deleteCustomer,
  getCustomers
} from '../src/services/customers/customerService';

import {
  addExpense,
  updateExpense,
  voidExpense,
  deleteExpense,
  getExpenses
} from '../src/services/expenses/expenseService';

import {
  createTable,
  updateTable,
  deleteTable,
  getTables
} from '../src/services/tables/tableService';

async function runTests() {
  console.log('🚀 Starting Comprehensive CRUD Acceptance Tests...');
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

  try {
    // 1. Authenticate Shop Owner
    console.log('\n--- 1. Authenticating as Shop Owner ---');
    const userCred = await signInWithEmailAndPassword(auth, 'princebhajipav16@gmail.com', 'OwnerPass@2026');
    const businessId = 'biz_prince_pavbhaji_01';
    assert(!!userCred.user.uid, `Authenticated as ${userCred.user.email}`);

    // 2. Menu Category CRUD
    console.log('\n--- 2. Testing Menu Category CRUD ---');
    const catName = `TestCat_${Date.now()}`;
    const newCat = await addCategory(businessId, catName, 999);
    assert(!!newCat.id, `Created category "${newCat.name}" with ID ${newCat.id}`);

    await updateCategory(businessId, newCat.id, { name: `${catName}_Renamed`, isActive: false });
    const catDocSnap = await getDoc(doc(db, 'businesses', businessId, 'categories', newCat.id));
    assert(catDocSnap.exists() && catDocSnap.data()?.name === `${catName}_Renamed` && catDocSnap.data()?.isActive === false, 'Category updated in Firestore with name & isActive');

    await deleteCategory(businessId, newCat.id);
    const catDelSnap = await getDoc(doc(db, 'businesses', businessId, 'categories', newCat.id));
    assert(!catDelSnap.exists(), 'Category safely deleted from Firestore');

    // 3. Menu Item CRUD with Variants
    console.log('\n--- 3. Testing Menu Item CRUD with Variants ---');
    const itemName = `Special Test Pavbhaji_${Date.now()}`;
    const newItem = await addMenuItem(businessId, {
      businessId,
      name: itemName,
      price: 150,
      categoryId: 'cat_pavbhaji',
      categoryName: 'Pavbhaji',
      isVeg: true,
      isActive: true,
      sortOrder: 100,
      variants: [
        { variantId: 'var_test_oil', name: 'Oil', price: 150, isAvailable: true },
        { variantId: 'var_test_butter', name: 'Butter', price: 180, isAvailable: true },
      ]
    });
    assert(!!newItem.id, `Created menu item "${newItem.name}" with ID ${newItem.id}`);

    const itemSnap = await getDoc(doc(db, 'businesses', businessId, 'menuItems', newItem.id));
    assert(itemSnap.exists() && itemSnap.data()?.variants?.length === 2, 'Menu item persisted with 2 price variants in Firestore');

    await updateMenuItem(businessId, newItem.id, { price: 160, isActive: false });
    const itemUpdatedSnap = await getDoc(doc(db, 'businesses', businessId, 'menuItems', newItem.id));
    assert(itemUpdatedSnap.data()?.price === 160 && itemUpdatedSnap.data()?.isActive === false, 'Menu item updated in Firestore');

    await deleteMenuItem(businessId, newItem.id);
    const itemDeletedSnap = await getDoc(doc(db, 'businesses', businessId, 'menuItems', newItem.id));
    assert(!itemDeletedSnap.exists(), 'Menu item deleted from Firestore (preserving historical bills)');

    // 4. Inventory CRUD & Stock Adjustments
    console.log('\n--- 4. Testing Inventory CRUD & Stock Movements ---');
    const testInv = await addInventoryItem(businessId, {
      name: `Amul Butter Blocks Test_${Date.now()}`,
      category: 'Dairy',
      unit: 'kg',
      currentStock: 20,
      minimumStock: 5,
      purchasePrice: 520,
      supplierName: 'Amul Dairy Distributors'
    });
    assert(!!testInv.id, `Created inventory item "${testInv.name}" with ID ${testInv.id}`);

    // Verify stock adjustment with reason
    await adjustStock(businessId, testInv.id, 25, 'Manual Increase');
    const invSnap = await getDoc(doc(db, 'businesses', businessId, 'inventory', testInv.id));
    assert(invSnap.data()?.currentStock === 25, 'Inventory quantity updated to 25 kg');

    const movements = await getStockMovements(businessId, 5);
    const lastMov = movements.find((m) => m.inventoryItemId === testInv.id && m.reason === 'Manual Increase');
    assert(!!lastMov && lastMov.quantityChange === 5 && lastMov.type === 'MANUAL_INCREASE', 'Stock movement logged with type MANUAL_INCREASE and audit reason');

    await deleteInventoryItem(businessId, testInv.id);
    const invDeletedSnap = await getDoc(doc(db, 'businesses', businessId, 'inventory', testInv.id));
    assert(!invDeletedSnap.exists(), 'Inventory item deleted from Firestore');

    // 5. Suppliers CRUD
    console.log('\n--- 5. Testing Suppliers CRUD ---');
    const supName = `Test Supplier_${Date.now()}`;
    const newSup = await addSupplier(businessId, {
      name: 'Pravinbhai',
      companyName: supName,
      mobile: '9876500000',
      whatsapp: '9876500000',
      suppliedProducts: 'Dairy & Butter',
      paymentTerms: 'Weekly'
    });
    assert(!!newSup.id, `Created supplier "${newSup.companyName}" with ID ${newSup.id}`);

    await updateSupplier(businessId, newSup.id, { paymentTerms: 'Cash on Delivery' });
    const supSnap = await getDoc(doc(db, 'businesses', businessId, 'suppliers', newSup.id));
    assert(supSnap.data()?.paymentTerms === 'Cash on Delivery', 'Supplier updated in Firestore');

    const delResult = await deleteSupplier(businessId, newSup.id, false);
    assert(delResult.deleted === true, 'Supplier permanently deleted when no POs exist');

    // 6. Purchase Orders
    console.log('\n--- 6. Testing Purchase Orders ---');
    const testPO = await createPurchaseOrder(businessId, {
      supplierId: 'sup_test_01',
      supplierName: 'Amul Dairy Agency',
      items: [
        {
          inventoryItemId: 'inv_milk_01',
          itemName: 'Full Cream Milk',
          unit: 'l',
          quantityOrdered: 20,
          quantityReceived: 0,
          unitCost: 60,
          lineTotal: 1200
        }
      ],
      subtotal: 1200,
      discount: 0,
      taxAmount: 0,
      totalAmount: 1200,
      status: 'ORDERED'
    });
    assert(!!testPO.id, `Created PO #${testPO.poNumber} with status ORDERED`);

    await cancelPurchaseOrder(businessId, testPO.id, 'Ordered in error');
    const poSnap = await getDoc(doc(db, 'businesses', businessId, 'purchaseOrders', testPO.id));
    assert(poSnap.data()?.status === 'CANCELLED', 'Purchase order status changed to CANCELLED in Firestore');

    // Cleanup test PO
    await deleteDoc(doc(db, 'businesses', businessId, 'purchaseOrders', testPO.id));

    // 7. Customers CRUD
    console.log('\n--- 7. Testing Customer Directory CRUD ---');
    const custPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const newCust = await addCustomer(businessId, {
      name: 'Rakesh Bhai Patel',
      phone: custPhone,
      email: 'rakesh@example.com',
      address: 'Prahlad Nagar, Ahmedabad',
      notes: 'Loves extra pav'
    });
    assert(!!newCust.id, `Created customer "${newCust.name}" with ID ${newCust.id}`);

    await updateCustomer(businessId, newCust.id, { notes: 'Loves extra pav and butter' });
    const custSnap = await getDoc(doc(db, 'businesses', businessId, 'customers', newCust.id));
    assert(custSnap.data()?.notes === 'Loves extra pav and butter', 'Customer updated in Firestore');

    const custDelRes = await deleteCustomer(businessId, newCust.id, false);
    assert(custDelRes.deleted === true, 'Customer deleted safely');

    // 8. Expenses CRUD
    console.log('\n--- 8. Testing Expenses CRUD ---');
    const newExp = await addExpense(businessId, {
      category: 'Kitchen Supplies',
      amount: 320,
      paymentMethod: 'CASH',
      description: 'Green coriander & lemons for evening prep',
      date: new Date().toISOString().split('T')[0],
      createdBy: 'Store Owner'
    });
    assert(!!newExp.id, `Created expense voucher "${newExp.description}" for ₹${newExp.amount}`);

    await updateExpense(businessId, newExp.id, { amount: 350 });
    const expSnap = await getDoc(doc(db, 'businesses', businessId, 'expenses', newExp.id));
    assert(expSnap.data()?.amount === 350, 'Expense updated in Firestore');

    await voidExpense(businessId, newExp.id, 'Entered wrong voucher amount', 'Store Owner');
    const expVoidSnap = await getDoc(doc(db, 'businesses', businessId, 'expenses', newExp.id));
    assert(expVoidSnap.data()?.isVoided === true && expVoidSnap.data()?.voidReason === 'Entered wrong voucher amount', 'Expense voided with audit reason');

    await deleteExpense(businessId, newExp.id, true);
    const expDelSnap = await getDoc(doc(db, 'businesses', businessId, 'expenses', newExp.id));
    assert(!expDelSnap.exists(), 'Expense permanently deleted');

    // 9. Table Management CRUD
    console.log('\n--- 9. Testing Table Management CRUD ---');
    const testTable = await createTable(businessId, {
      name: `T99_Test_${Date.now()}`,
      seatingCapacity: 6,
      description: 'Family Booth'
    });
    assert(!!testTable.id, `Created table "${testTable.name}" with ID ${testTable.id}`);

    await updateTable(businessId, testTable.id, { seatingCapacity: 8 });
    const tableSnap = await getDoc(doc(db, 'businesses', businessId, 'tables', testTable.id));
    assert(tableSnap.data()?.seatingCapacity === 8, 'Table updated in Firestore');

    await deleteTable(businessId, testTable.id, []);
    const tableDelSnap = await getDoc(doc(db, 'businesses', businessId, 'tables', testTable.id));
    assert(!tableDelSnap.exists(), 'Table deleted from Firestore when no active orders exist');

  } catch (err: any) {
    console.error('Test execution failed:', err);
    failed++;
  }

  console.log('\n=======================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('=======================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
