import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Read environment variables
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

const app = initializeApp(firebaseConfig, 'MIGRATION_APP');
const auth = getAuth(app);
const db = getFirestore(app);

// Data structure definitions from existing codebase
import { DEMO_MENU_ITEMS, DEMO_CUSTOMERS } from '../src/services/admin/demoDataService';
import { DEFAULT_BUSINESS_SETTINGS } from '../src/services/business/businessService';

interface MigrationTracker {
  processed: number;
  migrated: number;
  skipped: number;
  failed: number;
  byCollection: Record<string, { processed: number; migrated: number; skipped: number; failed: number }>;
}

const tracker: MigrationTracker = {
  processed: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
  byCollection: {},
};

function track(collectionName: string, status: 'migrated' | 'skipped' | 'failed') {
  tracker.processed++;
  tracker[status]++;
  if (!tracker.byCollection[collectionName]) {
    tracker.byCollection[collectionName] = { processed: 0, migrated: 0, skipped: 0, failed: 0 };
  }
  tracker.byCollection[collectionName].processed++;
  tracker.byCollection[collectionName][status]++;
}

async function authenticate() {
  console.log('🔑 Authenticating as Super Admin (superadmin@foodpos.app)...');
  try {
    const cred = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
    console.log(`✅ Authenticated UID: ${cred.user.uid}`);
    return cred.user;
  } catch (err: any) {
    console.error('Failed to authenticate:', err.message);
    throw err;
  }
}

// 1. Audit and Compile All Existing Records
function compileAllExistingData() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // A. Businesses
  const businesses = [
    {
      id: 'demo-business-owner-101',
      name: 'The Royal Bistro & Cafe',
      ownerName: 'Jenish Kanani',
      ownerEmail: 'owner@foodpos.app',
      phone: '9876543210',
      category: 'cafe',
      address: '506 Sahajanand Trade Center, Opp. High Court, Ahmedabad, Gujarat 380060',
      currency: 'INR',
      currencySymbol: '₹',
      status: 'ACTIVE',
      plan: 'pro',
      planExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      isDemo: true,
      totalOrders: 60,
      totalSales: 18450,
      gstin: '24BBBBB1111B1Z2',
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'biz_cafe_delight_101',
      name: 'Cafe Delight & Restaurant',
      ownerName: 'Jenish Kanani',
      ownerEmail: 'owner@cafedelight.com',
      phone: '+91 98765 43210',
      category: 'cafe',
      address: 'Shop 12, Sunrise Hub, Bodakdev, Ahmedabad, Gujarat 380054',
      currency: 'INR',
      currencySymbol: '₹',
      status: 'ACTIVE',
      plan: 'pro',
      planExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      isDemo: false,
      totalOrders: 15,
      totalSales: 5400,
      gstin: '24AAAAA0000A1Z5',
      createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'biz_street_food_99',
      name: 'Ahmedabad Street Bites',
      ownerName: 'Kishan Patel',
      ownerEmail: 'kishan@streetbites.com',
      phone: '9825100200',
      category: 'food_stall',
      address: 'Law Garden Khau Gali, Ahmedabad, Gujarat 380006',
      currency: 'INR',
      currencySymbol: '₹',
      status: 'ACTIVE',
      plan: 'starter',
      planExpiresAt: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
      isDemo: false,
      totalOrders: 14,
      totalSales: 2150,
      gstin: '',
      createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  // B. Categories mapping for all businesses
  const categoriesList = [
    { id: 'cat_main', name: 'Main Course & Thalis', sortOrder: 1, isActive: true },
    { id: 'cat_south', name: 'South Indian Specials', sortOrder: 2, isActive: true },
    { id: 'cat_street', name: 'Street Food & Chaat', sortOrder: 3, isActive: true },
    { id: 'cat_bites', name: 'Burgers & Quick Bites', sortOrder: 4, isActive: true },
    { id: 'cat_beverages', name: 'Beverages & Chai', sortOrder: 5, isActive: true },
    { id: 'cat_desserts', name: 'Desserts & Sweets', sortOrder: 6, isActive: true },
  ];

  // C. Menu Items
  const menuItemsList = DEMO_MENU_ITEMS.map((m, idx) => ({
    id: `item_m_${idx + 1}`,
    name: m.name,
    price: m.price,
    categoryId: m.categoryId,
    categoryName: m.categoryName,
    gstRate: 5,
    isVeg: m.isVeg,
    isActive: true,
    sortOrder: m.sortOrder,
  }));

  // D. Customers (25 from DEMO_CUSTOMERS + Walk-in & VIP)
  const customersList = DEMO_CUSTOMERS.map((c, idx) => ({
    id: `cust_${idx + 1}`,
    name: c.name,
    mobile: c.phone,
    totalOrders: 1 + (idx % 5),
    totalSpent: (idx + 1) * 350,
    createdAt: new Date(Date.now() - (30 - idx) * 24 * 3600 * 1000).toISOString(),
  }));

  // E. Suppliers
  const suppliersList = [
    {
      id: 'sup_amul_dairy',
      name: 'Ramesh Patel',
      companyName: 'Amul Dairy Distributors LLP',
      mobile: '9825012345',
      whatsapp: '9825012345',
      email: 'ramesh.dairy@gmail.com',
      address: 'Shop 12, APMC Market, Ahmedabad',
      gstin: '24AABCA1234F1Z1',
      suppliedProducts: 'Milk, Butter, Paneer, Cheese, Fresh Cream',
      paymentTerms: 'Weekly Payment',
      notes: 'Delivers daily morning 6:30 AM in chilled van',
      isArchived: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'sup_fresh_produce',
      name: 'Gopal Saini',
      companyName: 'Fresh Farm Produce',
      mobile: '9898054321',
      whatsapp: '9898054321',
      email: 'gopal.freshveggies@yahoo.com',
      address: 'Sardar Patel Veg Market, Stall 45, Ahmedabad',
      gstin: '',
      suppliedProducts: 'Onions, Potatoes, Tomatoes, Capsicum, Green Chillies',
      paymentTerms: 'Immediate / Cash on delivery',
      notes: 'Call night before for bulk morning orders',
      isArchived: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'sup_shreeji_provisions',
      name: 'Pravin Shah',
      companyName: 'Shreeji Wholesale Provisions',
      mobile: '9879011223',
      whatsapp: '9879011223',
      email: 'shreeji.provisions@gmail.com',
      address: 'Grain Market, Kalupur, Ahmedabad',
      gstin: '24AABCS9876E1Z4',
      suppliedProducts: 'Cooking Oil, Basmati Rice, Spices, Flour, Pulses, Sugar',
      paymentTerms: 'Net 15 Days',
      notes: 'Weekly bulk grain and oil replenishment',
      isArchived: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  // F. Inventory Items
  const inventoryList = [
    {
      id: 'inv_milk_full_cream',
      name: 'Full Cream Milk',
      category: 'Dairy',
      sku: 'DRY-MILK-01',
      unit: 'l',
      currentStock: 25,
      minimumStock: 10,
      purchasePrice: 62,
      supplierId: 'sup_amul_dairy',
      supplierName: 'Amul Dairy Distributors LLP',
      stockStatus: 'IN_STOCK',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'inv_paneer_malai',
      name: 'Fresh Malai Paneer',
      category: 'Dairy',
      sku: 'DRY-PAN-02',
      unit: 'kg',
      currentStock: 4.5,
      minimumStock: 5,
      purchasePrice: 380,
      supplierId: 'sup_amul_dairy',
      supplierName: 'Amul Dairy Distributors LLP',
      stockStatus: 'LOW_STOCK',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'inv_cheese_blend',
      name: 'Mozzarella & Cheddar Blend',
      category: 'Dairy',
      sku: 'DRY-CHS-03',
      unit: 'kg',
      currentStock: 1.5,
      minimumStock: 3,
      purchasePrice: 480,
      supplierId: 'sup_amul_dairy',
      supplierName: 'Amul Dairy Distributors LLP',
      stockStatus: 'LOW_STOCK',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'inv_oil_refined',
      name: 'Refined Sunflower Cooking Oil',
      category: 'Provisions',
      sku: 'PRO-OIL-15',
      unit: 'l',
      currentStock: 45,
      minimumStock: 20,
      purchasePrice: 135,
      supplierId: 'sup_shreeji_provisions',
      supplierName: 'Shreeji Wholesale Provisions',
      stockStatus: 'IN_STOCK',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'inv_onions_red',
      name: 'Red Onions (Pyaaz)',
      category: 'Vegetables',
      sku: 'VEG-ONI-01',
      unit: 'kg',
      currentStock: 0,
      minimumStock: 15,
      purchasePrice: 35,
      supplierId: 'sup_fresh_produce',
      supplierName: 'Fresh Farm Produce',
      stockStatus: 'OUT_OF_STOCK',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'inv_potatoes_fresh',
      name: 'Fresh Potatoes (Aloo)',
      category: 'Vegetables',
      sku: 'VEG-POT-02',
      unit: 'kg',
      currentStock: 32,
      minimumStock: 20,
      purchasePrice: 28,
      supplierId: 'sup_fresh_produce',
      supplierName: 'Fresh Farm Produce',
      stockStatus: 'IN_STOCK',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'inv_coffee_powder',
      name: 'Classic Espresso Coffee Powder',
      category: 'Beverage Raw Materials',
      sku: 'BEV-COF-01',
      unit: 'kg',
      currentStock: 5,
      minimumStock: 2,
      purchasePrice: 750,
      supplierId: 'sup_shreeji_provisions',
      supplierName: 'Shreeji Wholesale Provisions',
      stockStatus: 'IN_STOCK',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  // G. Purchase Orders
  const purchaseOrdersList = [
    {
      id: 'po_amul_1001',
      poNumber: 'PO-1001',
      supplierId: 'sup_amul_dairy',
      supplierName: 'Amul Dairy Distributors LLP',
      items: [
        {
          inventoryItemId: 'inv_milk_full_cream',
          itemName: 'Full Cream Milk',
          unit: 'l',
          quantityOrdered: 20,
          quantityReceived: 20,
          unitCost: 62,
          lineTotal: 1240,
        },
        {
          inventoryItemId: 'inv_paneer_malai',
          itemName: 'Fresh Malai Paneer',
          unit: 'kg',
          quantityOrdered: 5,
          quantityReceived: 5,
          unitCost: 380,
          lineTotal: 1900,
        },
      ],
      subtotal: 3140,
      discount: 0,
      taxAmount: 157,
      totalAmount: 3297,
      status: 'RECEIVED',
      amountPaid: 3297,
      balanceDue: 0,
      paymentStatus: 'PAID',
      orderDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      receivedDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      notes: 'Morning fresh delivery received and inspected',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'po_shreeji_1002',
      poNumber: 'PO-1002',
      supplierId: 'sup_shreeji_provisions',
      supplierName: 'Shreeji Wholesale Provisions',
      items: [
        {
          inventoryItemId: 'inv_oil_refined',
          itemName: 'Refined Sunflower Cooking Oil',
          unit: 'l',
          quantityOrdered: 50,
          quantityReceived: 50,
          unitCost: 135,
          lineTotal: 6750,
        },
        {
          inventoryItemId: 'inv_coffee_powder',
          itemName: 'Classic Espresso Coffee Powder',
          unit: 'kg',
          quantityOrdered: 2,
          quantityReceived: 2,
          unitCost: 750,
          lineTotal: 1500,
        },
      ],
      subtotal: 8250,
      discount: 250,
      taxAmount: 0,
      totalAmount: 8000,
      status: 'RECEIVED',
      amountPaid: 5000,
      balanceDue: 3000,
      paymentStatus: 'PARTIAL',
      orderDate: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      receivedDate: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      notes: 'Net 15 days payment terms. ₹5,000 paid by UPI advance',
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    },
  ];

  // H. Stock Movements
  const stockMovementsList = [
    {
      id: 'sm_1001',
      inventoryItemId: 'inv_milk_full_cream',
      itemName: 'Full Cream Milk',
      type: 'PURCHASE_RECEIPT',
      quantityChange: 20,
      previousStock: 5,
      newStock: 25,
      reason: 'PO-1001 Delivery Received',
      referenceId: 'PO-1001',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'sm_1002',
      inventoryItemId: 'inv_oil_refined',
      itemName: 'Refined Sunflower Cooking Oil',
      type: 'PURCHASE_RECEIPT',
      quantityChange: 50,
      previousStock: 0,
      newStock: 50,
      reason: 'PO-1002 Delivery Received',
      referenceId: 'PO-1002',
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    },
  ];

  // I. 60 Orders (32 yesterday, 28 today)
  const ordersList: any[] = [];
  const targetBizId = 'demo-business-owner-101';

  // 32 orders yesterday
  for (let i = 1; i <= 32; i++) {
    const hour = i % 3 === 0 ? 13 : i % 2 === 0 ? 20 : 16;
    const minute = (i * 7) % 60;
    const orderDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), hour, minute, 0);
    const billSeq = 1000 + i;
    const cust = DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length];

    const itemCount = 1 + (billSeq % 3);
    const items: any[] = [];
    for (let k = 0; k < itemCount; k++) {
      const m = DEMO_MENU_ITEMS[(billSeq + k * 4) % DEMO_MENU_ITEMS.length];
      const qty = 1 + ((billSeq + k) % 3);
      items.push({
        itemId: `item_m_${((billSeq + k * 4) % DEMO_MENU_ITEMS.length) + 1}`,
        name: m.name,
        quantity: qty,
        unitPrice: m.price,
        gstRate: 5,
        lineTotal: m.price * qty,
        isVeg: m.isVeg,
      });
    }

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const discountAmount = billSeq % 5 === 0 ? 20 : 0;
    const taxableAmount = subtotal - discountAmount;
    const gstAmount = Math.round(((taxableAmount * 5) / 100) * 100) / 100;
    const grandTotal = Math.round((taxableAmount + gstAmount) * 100) / 100;
    const paymentMethod = billSeq % 10 < 5 ? 'UPI' : billSeq % 10 < 9 ? 'CASH' : 'CARD';

    let paymentStatus = 'PAID';
    let amountPaid = grandTotal;
    let balanceDue = 0;
    if (billSeq % 25 === 0) {
      paymentStatus = 'UNPAID';
      amountPaid = 0;
      balanceDue = grandTotal;
    } else if (billSeq % 15 === 0) {
      paymentStatus = 'PARTIAL';
      amountPaid = Math.floor(grandTotal / 2);
      balanceDue = grandTotal - amountPaid;
    }

    ordersList.push({
      id: `ord_hist_${billSeq}`,
      billNumber: `BILL-${billSeq}`,
      businessId: targetBizId,
      customer: cust,
      customerName: cust.name,
      customerPhone: cust.phone,
      tableNumber: `Table ${(billSeq % 6) + 1}`,
      orderType: billSeq % 4 === 0 ? 'TAKEAWAY' : 'DINE_IN',
      items,
      extras: [],
      subtotal,
      discountType: 'fixed',
      discountValue: discountAmount,
      discountAmount,
      taxableAmount,
      gstRate: 5,
      gstAmount,
      cgst: gstAmount / 2,
      sgst: gstAmount / 2,
      grandTotal,
      amountPaid,
      balanceDue,
      paymentMethod,
      paymentStatus,
      status: 'COMPLETED',
      isDemo: true,
      syncedWithCloud: true,
      createdAt: orderDate.toISOString(),
      updatedAt: orderDate.toISOString(),
    });
  }

  // 28 orders today
  for (let j = 1; j <= 28; j++) {
    const hour = j % 3 === 0 ? 12 : j % 2 === 0 ? 15 : 18;
    const minute = (j * 9) % 60;
    const orderDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
    const billSeq = 1032 + j;
    const cust = DEMO_CUSTOMERS[(j + 5) % DEMO_CUSTOMERS.length];

    const itemCount = 1 + (billSeq % 3);
    const items: any[] = [];
    for (let k = 0; k < itemCount; k++) {
      const m = DEMO_MENU_ITEMS[(billSeq + k * 4) % DEMO_MENU_ITEMS.length];
      const qty = 1 + ((billSeq + k) % 3);
      items.push({
        itemId: `item_m_${((billSeq + k * 4) % DEMO_MENU_ITEMS.length) + 1}`,
        name: m.name,
        quantity: qty,
        unitPrice: m.price,
        gstRate: 5,
        lineTotal: m.price * qty,
        isVeg: m.isVeg,
      });
    }

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const discountAmount = billSeq % 5 === 0 ? 25 : 0;
    const taxableAmount = subtotal - discountAmount;
    const gstAmount = Math.round(((taxableAmount * 5) / 100) * 100) / 100;
    const grandTotal = Math.round((taxableAmount + gstAmount) * 100) / 100;
    const paymentMethod = billSeq % 10 < 5 ? 'UPI' : billSeq % 10 < 9 ? 'CASH' : 'CARD';

    let paymentStatus = 'PAID';
    let amountPaid = grandTotal;
    let balanceDue = 0;
    if (billSeq % 25 === 0) {
      paymentStatus = 'UNPAID';
      amountPaid = 0;
      balanceDue = grandTotal;
    } else if (billSeq % 15 === 0) {
      paymentStatus = 'PARTIAL';
      amountPaid = Math.floor(grandTotal / 2);
      balanceDue = grandTotal - amountPaid;
    }

    ordersList.push({
      id: `ord_hist_${billSeq}`,
      billNumber: `BILL-${billSeq}`,
      businessId: targetBizId,
      customer: cust,
      customerName: cust.name,
      customerPhone: cust.phone,
      tableNumber: `Table ${(billSeq % 6) + 1}`,
      orderType: billSeq % 4 === 0 ? 'TAKEAWAY' : 'DINE_IN',
      items,
      extras: [],
      subtotal,
      discountType: 'fixed',
      discountValue: discountAmount,
      discountAmount,
      taxableAmount,
      gstRate: 5,
      gstAmount,
      cgst: gstAmount / 2,
      sgst: gstAmount / 2,
      grandTotal,
      amountPaid,
      balanceDue,
      paymentMethod,
      paymentStatus,
      status: paymentStatus === 'UNPAID' ? 'OPEN' : 'COMPLETED',
      isDemo: true,
      syncedWithCloud: true,
      createdAt: orderDate.toISOString(),
      updatedAt: orderDate.toISOString(),
    });
  }

  // J. Members
  const membersList = [
    {
      id: 'mem_owner_master',
      name: 'Chef Jenish',
      email: 'owner@foodpos.app',
      role: 'OWNER',
      canCollectPayment: true,
      status: 'ACTIVE',
      createdAt: now.toISOString(),
    },
    {
      id: 'mem_mgr_rahul',
      name: 'Rahul Varma',
      email: 'manager.bistro@foodpos.app',
      role: 'MANAGER',
      canCollectPayment: true,
      status: 'ACTIVE',
      createdAt: now.toISOString(),
    },
    {
      id: 'mem_cashier_amit',
      name: 'Amit Patel',
      email: 'cashier.bistro@foodpos.app',
      role: 'CASHIER',
      canCollectPayment: true,
      status: 'ACTIVE',
      createdAt: now.toISOString(),
    },
  ];

  // K. Expenses
  const expensesList = [
    {
      id: 'exp_packaging_101',
      category: 'Packaging Materials',
      amount: 650,
      paymentMethod: 'CASH',
      description: 'Paper bags, meal boxes and wooden cutlery',
      date: now.toISOString(),
      createdBy: 'owner@foodpos.app',
      createdAt: now.toISOString(),
    },
    {
      id: 'exp_groceries_102',
      category: 'Kitchen Essentials',
      amount: 420,
      paymentMethod: 'UPI',
      description: 'Fresh mint, lemons, napkins and sanitizers',
      date: now.toISOString(),
      createdBy: 'owner@foodpos.app',
      createdAt: now.toISOString(),
    },
  ];

  // L. Activity Logs
  const activityLogsList = [
    {
      id: 'act_mig_01',
      action: 'SYSTEM_AUDIT_INITIALIZATION',
      module: 'Migration Engine',
      performedBy: 'superadmin@foodpos.app',
      details: { environment: 'production', system: 'Cloud Firestore' },
      createdAt: now.toISOString(),
    },
  ];

  return {
    businesses,
    categoriesList,
    menuItemsList,
    customersList,
    suppliersList,
    inventoryList,
    purchaseOrdersList,
    stockMovementsList,
    ordersList,
    membersList,
    expensesList,
    activityLogsList,
  };
}

// 2. Perform Idempotent Migration into Firestore
async function migrateRecords() {
  const dataset = compileAllExistingData();
  const now = new Date().toISOString();

  // Step 1: Backup current state to local JSON file
  const backupFilename = `backups/pre_migration_backup_${Date.now()}.json`;
  fs.writeFileSync(backupFilename, JSON.stringify(dataset, null, 2));
  console.log(`\n💾 Step 1: Pre-migration full backup saved to ${backupFilename}`);

  // Step 2: Initialize Migration Marker Document
  const migrationId = `migration_${Date.now()}`;
  const migrationRef = doc(db, 'platform', 'migrations', 'runs', migrationId);
  await setDoc(migrationRef, {
    migrationId,
    startedAt: now,
    status: 'IN_PROGRESS',
    source: 'Local Codebase, Mock Stores & App State',
    targetProjectId: firebaseConfig.projectId,
    recordsProcessed: 0,
    recordsMigrated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
  });
  console.log(`🚀 Step 2: Migration record registered: platform/migrations/runs/${migrationId}`);

  // Step 3: Migrate Businesses & Profiles
  console.log('\n[Phase 1] Migrating Businesses, Directory & Profiles...');
  for (const b of dataset.businesses) {
    const shopDirRef = doc(db, 'platform', 'shops', 'directory', b.id);
    const existing = await getDoc(shopDirRef);
    if (!existing.exists()) {
      await setDoc(shopDirRef, b);
      track('businesses', 'migrated');
    } else {
      track('businesses', 'skipped');
    }

    // Business Root doc
    const bizRootRef = doc(db, 'businesses', b.id);
    const existingBiz = await getDoc(bizRootRef);
    if (!existingBiz.exists()) {
      await setDoc(bizRootRef, {
        id: b.id,
        name: b.name,
        ownerEmail: b.ownerEmail,
        status: b.status,
        plan: b.plan,
        createdAt: b.createdAt,
        updatedAt: now,
      });
      track('business_roots', 'migrated');
    } else {
      track('business_roots', 'skipped');
    }

    // Profile & Meta Profile
    const profRef = doc(db, 'businesses', b.id, 'profile', 'current');
    const existingProf = await getDoc(profRef);
    if (!existingProf.exists()) {
      await setDoc(profRef, b);
      await setDoc(doc(db, 'businesses', b.id, 'meta', 'profile'), b);
      track('profiles', 'migrated');
    } else {
      track('profiles', 'skipped');
    }

    // Settings & Meta Settings
    const settRef = doc(db, 'businesses', b.id, 'settings', 'current');
    const existingSett = await getDoc(settRef);
    if (!existingSett.exists()) {
      const settData = {
        ...DEFAULT_BUSINESS_SETTINGS,
        tax: {
          ...DEFAULT_BUSINESS_SETTINGS.tax,
          enabled: !!b.gstin,
          gstin: b.gstin || '',
          pricingMode: 'exclusive' as const,
        },
      };
      await setDoc(settRef, settData);
      await setDoc(doc(db, 'businesses', b.id, 'meta', 'settings'), settData);
      track('settings', 'migrated');
    } else {
      track('settings', 'skipped');
    }
  }

  // Step 4: Migrate Categories & Menu Items for all businesses
  console.log('\n[Phase 2] Migrating Categories & Menu Items...');
  for (const b of dataset.businesses) {
    for (const cat of dataset.categoriesList) {
      const catDocId = `${cat.id}_${b.id}`;
      const catRef = doc(db, 'businesses', b.id, 'categories', catDocId);
      const snap = await getDoc(catRef);
      if (!snap.exists()) {
        await setDoc(catRef, { ...cat, id: catDocId, businessId: b.id });
        track('categories', 'migrated');
      } else {
        track('categories', 'skipped');
      }
    }

    for (const item of dataset.menuItemsList) {
      const itemDocId = `${item.id}_${b.id}`;
      const itemRef = doc(db, 'businesses', b.id, 'menuItems', itemDocId);
      const snap = await getDoc(itemRef);
      if (!snap.exists()) {
        await setDoc(itemRef, { ...item, id: itemDocId, businessId: b.id });
        track('menuItems', 'migrated');
      } else {
        track('menuItems', 'skipped');
      }
    }
  }

  // Step 5: Migrate Customers
  console.log('\n[Phase 3] Migrating Customers...');
  for (const b of dataset.businesses) {
    for (const cust of dataset.customersList) {
      const custDocId = `${cust.id}_${b.id}`;
      const custRef = doc(db, 'businesses', b.id, 'customers', custDocId);
      const snap = await getDoc(custRef);
      if (!snap.exists()) {
        await setDoc(custRef, { ...cust, id: custDocId, businessId: b.id });
        track('customers', 'migrated');
      } else {
        track('customers', 'skipped');
      }
    }
  }

  // Step 6: Migrate Suppliers, Inventory & Purchase Orders
  console.log('\n[Phase 4] Migrating Suppliers, Inventory & Purchase Orders...');
  for (const b of dataset.businesses) {
    for (const sup of dataset.suppliersList) {
      const supDocId = `${sup.id}_${b.id}`;
      const supRef = doc(db, 'businesses', b.id, 'suppliers', supDocId);
      const snap = await getDoc(supRef);
      if (!snap.exists()) {
        await setDoc(supRef, { ...sup, id: supDocId, businessId: b.id });
        track('suppliers', 'migrated');
      } else {
        track('suppliers', 'skipped');
      }
    }

    for (const inv of dataset.inventoryList) {
      const invDocId = `${inv.id}_${b.id}`;
      const invRef = doc(db, 'businesses', b.id, 'inventory', invDocId);
      const snap = await getDoc(invRef);
      if (!snap.exists()) {
        await setDoc(invRef, { ...inv, id: invDocId, businessId: b.id });
        track('inventory', 'migrated');
      } else {
        track('inventory', 'skipped');
      }
    }

    for (const po of dataset.purchaseOrdersList) {
      const poDocId = `${po.id}_${b.id}`;
      const poRef = doc(db, 'businesses', b.id, 'purchaseOrders', poDocId);
      const snap = await getDoc(poRef);
      if (!snap.exists()) {
        await setDoc(poRef, { ...po, id: poDocId, businessId: b.id });
        track('purchaseOrders', 'migrated');
      } else {
        track('purchaseOrders', 'skipped');
      }
    }

    for (const sm of dataset.stockMovementsList) {
      const smDocId = `${sm.id}_${b.id}`;
      const smRef = doc(db, 'businesses', b.id, 'stockMovements', smDocId);
      const snap = await getDoc(smRef);
      if (!snap.exists()) {
        await setDoc(smRef, { ...sm, id: smDocId, businessId: b.id });
        track('stockMovements', 'migrated');
      } else {
        track('stockMovements', 'skipped');
      }
    }
  }

  // Step 7: Migrate Orders and Atomic Payments Subcollections
  console.log('\n[Phase 5] Migrating Orders & Payments Subcollection...');
  // Migrate the 60 realistic orders into target business
  for (const order of dataset.ordersList) {
    const orderRef = doc(db, 'businesses', order.businessId, 'orders', order.id);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) {
      await setDoc(orderRef, order);
      track('orders', 'migrated');

      // Check for payment records to write into payments subcollection
      if (order.amountPaid > 0) {
        const paymentDocId = `pay_${order.id}`;
        const payRef = doc(db, 'businesses', order.businessId, 'orders', order.id, 'payments', paymentDocId);
        await setDoc(payRef, {
          id: paymentDocId,
          orderId: order.id,
          businessId: order.businessId,
          amount: order.amountPaid,
          paymentMethod: order.paymentMethod,
          collectedBy: 'owner@foodpos.app',
          receivedAt: order.createdAt,
          notes: `Initial payment of ₹${order.amountPaid} via ${order.paymentMethod}`,
        });
        track('payments', 'migrated');
      }
    } else {
      track('orders', 'skipped');
    }
  }

  // Step 8: Migrate Members, Expenses & Activity Logs
  console.log('\n[Phase 6] Migrating Members, Expenses & Activity Logs...');
  for (const b of dataset.businesses) {
    for (const mem of dataset.membersList) {
      const memDocId = `${mem.id}_${b.id}`;
      const memRef = doc(db, 'businesses', b.id, 'members', memDocId);
      const snap = await getDoc(memRef);
      if (!snap.exists()) {
        await setDoc(memRef, { ...mem, id: memDocId, businessId: b.id });
        track('members', 'migrated');
      } else {
        track('members', 'skipped');
      }
    }

    for (const exp of dataset.expensesList) {
      const expDocId = `${exp.id}_${b.id}`;
      const expRef = doc(db, 'businesses', b.id, 'expenses', expDocId);
      const snap = await getDoc(expRef);
      if (!snap.exists()) {
        await setDoc(expRef, { ...exp, id: expDocId, businessId: b.id });
        track('expenses', 'migrated');
      } else {
        track('expenses', 'skipped');
      }
    }

    for (const act of dataset.activityLogsList) {
      const actDocId = `${act.id}_${b.id}`;
      const actRef = doc(db, 'businesses', b.id, 'activityLogs', actDocId);
      const snap = await getDoc(actRef);
      if (!snap.exists()) {
        await setDoc(actRef, { ...act, id: actDocId, businessId: b.id });
        track('activityLogs', 'migrated');
      } else {
        track('activityLogs', 'skipped');
      }
    }
  }

  // Step 9: Update Migration Record with Final Reconciliation
  const completedAt = new Date().toISOString();
  await setDoc(migrationRef, {
    migrationId,
    startedAt: now,
    completedAt,
    status: 'COMPLETED',
    source: 'Local Codebase, Mock Stores & App State',
    targetProjectId: firebaseConfig.projectId,
    recordsProcessed: tracker.processed,
    recordsMigrated: tracker.migrated,
    recordsSkipped: tracker.skipped,
    recordsFailed: tracker.failed,
    byCollection: tracker.byCollection,
  }, { merge: true });

  console.log(`\n🎉 Step 3: Migration completed successfully! Status updated in platform/migrations/runs/${migrationId}`);
  return { migrationId, backupFilename };
}

// 3. Post-Migration Verification Queries
async function verifyMigration() {
  console.log('\n====================================================');
  console.log('🔍 VERIFYING MIGRATED RECORDS IN CLOUD FIRESTORE');
  console.log('====================================================');

  const bizId = 'demo-business-owner-101';
  const checks = [
    { name: 'Platform Shops Directory', col: collection(db, 'platform', 'shops', 'directory') },
    { name: 'Business Categories', col: collection(db, 'businesses', bizId, 'categories') },
    { name: 'Business Menu Items', col: collection(db, 'businesses', bizId, 'menuItems') },
    { name: 'Business Customers', col: collection(db, 'businesses', bizId, 'customers') },
    { name: 'Business Suppliers', col: collection(db, 'businesses', bizId, 'suppliers') },
    { name: 'Business Inventory Items', col: collection(db, 'businesses', bizId, 'inventory') },
    { name: 'Business Purchase Orders', col: collection(db, 'businesses', bizId, 'purchaseOrders') },
    { name: 'Business Stock Movements', col: collection(db, 'businesses', bizId, 'stockMovements') },
    { name: 'Business Orders (History)', col: collection(db, 'businesses', bizId, 'orders') },
    { name: 'Business Staff Members', col: collection(db, 'businesses', bizId, 'members') },
    { name: 'Business Expenses', col: collection(db, 'businesses', bizId, 'expenses') },
    { name: 'Business Activity Logs', col: collection(db, 'businesses', bizId, 'activityLogs') },
  ];

  let totalDocsFound = 0;
  for (const check of checks) {
    const snap = await getDocs(check.col);
    console.log(`✅ [FIRESTORE LIVE] ${check.name.padEnd(28)} : ${snap.size} documents found`);
    totalDocsFound += snap.size;
  }

  // Verify atomic payments in subcollections for first 5 orders
  const ordersSnap = await getDocs(collection(db, 'businesses', bizId, 'orders'));
  let paymentRecordsFound = 0;
  for (const ordDoc of ordersSnap.docs.slice(0, 10)) {
    const paySnap = await getDocs(collection(db, 'businesses', bizId, 'orders', ordDoc.id, 'payments'));
    paymentRecordsFound += paySnap.size;
  }
  console.log(`✅ [FIRESTORE LIVE] Sample Orders Payment Subcol  : ${paymentRecordsFound} payment documents confirmed`);

  console.log(`\nTotal verified live records in primary tenant: ${totalDocsFound}`);
  console.log('----------------------------------------------------');
  console.log(`Total Records Processed : ${tracker.processed}`);
  console.log(`Total Records Migrated  : ${tracker.migrated}`);
  console.log(`Total Records Skipped   : ${tracker.skipped} (Duplicate prevention)`);
  console.log(`Total Records Failed    : ${tracker.failed}`);
  console.log('----------------------------------------------------');
}

async function main() {
  try {
    await authenticate();
    await migrateRecords();
    await verifyMigration();
  } catch (error) {
    console.error('Fatal Migration Error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
