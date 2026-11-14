import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from 'firebase/firestore';
import * as fs from 'fs';

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

console.log('====================================================');
console.log('🚀 INITIALIZING CLOUD FIRESTORE FOR FOOD POS SAAS');
console.log('====================================================');
console.log('Project ID   :', firebaseConfig.projectId);
console.log('Auth Domain  :', firebaseConfig.authDomain);

const primaryApp = initializeApp(firebaseConfig, 'PRIMARY_APP');
const primaryAuth = getAuth(primaryApp);
const db = getFirestore(primaryApp);

async function ensureBusinessOwnerAuth() {
  const email = 'owner@foodpos.app';
  const pass = 'OwnerPass@2026';
  const secApp = initializeApp(firebaseConfig, `SEC_${Date.now()}`);
  const secAuth = getAuth(secApp);
  try {
    const cred = await createUserWithEmailAndPassword(secAuth, email, pass);
    console.log(`✅ Shop Owner created in Firebase Auth: ${cred.user.email} (UID: ${cred.user.uid})`);
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      console.log(`ℹ️ Shop Owner already registered in Firebase Auth: ${email}`);
    } else {
      console.warn(`Warning creating owner account: ${err.message}`);
    }
  } finally {
    await deleteApp(secApp);
  }
}

async function authenticateSuperAdmin() {
  const email = 'superadmin@foodpos.app';
  const pass = 'SuperAdmin@2026';
  try {
    const cred = await signInWithEmailAndPassword(primaryAuth, email, pass);
    console.log(`✅ Authenticated Super Admin: ${cred.user.email} (UID: ${cred.user.uid})`);
    return cred.user;
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      const cred = await createUserWithEmailAndPassword(primaryAuth, email, pass);
      console.log(`✅ Created & Authenticated Super Admin: ${cred.user.email} (UID: ${cred.user.uid})`);
      return cred.user;
    }
    throw err;
  }
}

async function populateDatabase() {
  const now = new Date().toISOString();

  // 1. Root Platform Collections
  console.log('\n[1/5] Initializing Platform collections...');
  
  // Platform admins document
  await setDoc(doc(db, 'platform', 'admins'), {
    title: 'Platform Admins Directory',
    masterAdmin: 'superadmin@foodpos.app',
    totalAdmins: 1,
    updatedAt: now,
  });

  const platformAdminRef = doc(db, 'platform', 'admins', 'directory', 'superadmin_master');
  await setDoc(platformAdminRef, {
    uid: 'superadmin_master',
    email: 'superadmin@foodpos.app',
    displayName: 'Platform Super Admin',
    role: 'SUPER_ADMIN',
    permissions: ['all', 'manage_shops', 'manage_subscriptions', 'billing'],
    createdAt: now,
    updatedAt: now,
  });

  // Platform settings document
  await setDoc(doc(db, 'platform', 'settings'), {
    title: 'Platform Configuration',
    platformName: 'Universal Food Billing POS SaaS',
    defaultCurrency: 'INR',
    currencySymbol: '₹',
    supportEmail: 'support@foodpos.app',
    updatedAt: now,
  });

  const platformSettingsRef = doc(db, 'platform', 'settings', 'config', 'general');
  await setDoc(platformSettingsRef, {
    platformName: 'Universal Food Billing POS SaaS',
    version: '2.0.0-prod',
    environment: 'production',
    supportEmail: 'support@foodpos.app',
    supportPhone: '+91 98765 43210',
    defaultCurrency: 'INR',
    currencySymbol: '₹',
    maintenanceMode: false,
    trialDays: 14,
    plans: {
      trial: { name: 'Trial Plan', durationDays: 14, maxOrdersPerMonth: 100 },
      starter: { name: 'Starter Plan', price: 999, maxOrdersPerMonth: 500 },
      pro: { name: 'Professional Plan', price: 2499, maxOrdersPerMonth: 5000 },
      enterprise: { name: 'Enterprise Plan', price: 4999, maxOrdersPerMonth: 999999 },
    },
    updatedAt: now,
  });

  const platformBillingSettingsRef = doc(db, 'platform', 'settings', 'config', 'billing');
  await setDoc(platformBillingSettingsRef, {
    paymentGateway: 'Razorpay',
    currency: 'INR',
    autoInvoice: true,
    updatedAt: now,
  });

  console.log('✅ Platform admins and platform settings initialized in Cloud Firestore.');

  // Businesses to initialize (Primary tenant + default tenant)
  const businesses = [
    {
      id: 'biz_cafe_delight_101',
      name: 'Cafe Delight & Restaurant',
      ownerName: 'Jenish Kanani',
      ownerEmail: 'owner@cafedelight.com',
      phone: '+91 98765 43210',
      category: 'cafe' as const,
      address: 'Shop 12, Sunrise Hub, Bodakdev, Ahmedabad, Gujarat 380054',
      plan: 'pro' as const,
      status: 'ACTIVE' as const,
      gstin: '24AAAAA0000A1Z5',
    },
    {
      id: 'demo-business-owner-101',
      name: 'The Royal Bistro & Cafe',
      ownerName: 'Chef Jenish',
      ownerEmail: 'owner@foodpos.app',
      phone: '+91 98765 43210',
      category: 'cafe' as const,
      address: '506 Sahajanand Trade Center, Opp. High Court, Ahmedabad, Gujarat 380060',
      plan: 'pro' as const,
      status: 'ACTIVE' as const,
      gstin: '24BBBBB1111B1Z2',
    }
  ];

  for (const b of businesses) {
    console.log(`\n[2/5] Initializing Tenant: ${b.name} (${b.id})...`);

    // Root business document
    await setDoc(doc(db, 'businesses', b.id), {
      id: b.id,
      name: b.name,
      ownerEmail: b.ownerEmail,
      status: b.status,
      plan: b.plan,
      createdAt: now,
      updatedAt: now,
    });

    // Register in platform shops directory
    const shopDirRef = doc(db, 'platform', 'shops', 'directory', b.id);
    await setDoc(shopDirRef, {
      id: b.id,
      name: b.name,
      ownerName: b.ownerName,
      ownerEmail: b.ownerEmail,
      phone: b.phone,
      category: b.category,
      address: b.address,
      currency: 'INR',
      currencySymbol: '₹',
      status: b.status,
      plan: b.plan,
      planExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
    });

    // Profile & Settings
    const profileData = {
      id: b.id,
      name: b.name,
      ownerName: b.ownerName,
      ownerEmail: b.ownerEmail,
      phone: b.phone,
      category: b.category,
      address: b.address,
      currency: 'INR',
      currencySymbol: '₹',
      status: b.status,
      plan: b.plan,
      planExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'businesses', b.id, 'profile', 'current'), profileData);
    await setDoc(doc(db, 'businesses', b.id, 'meta', 'profile'), profileData);

    const settingsData = {
      tax: {
        enabled: true,
        gstin: b.gstin,
        defaultGstRate: 5,
        pricingMode: 'exclusive' as const,
        isInterState: false,
      },
      receipt: {
        defaultFormat: 'compact80' as const,
        showLogo: true,
        showAddress: true,
        showPhone: true,
        showGstin: true,
        footerMessage: 'Thank you for dining with us! Visit again.',
      },
      billing: {
        defaultPaymentMethod: 'CASH' as const,
        billNumberPrefix: 'BILL-',
        nextBillNumber: 1003,
      },
      tables: {
        enabled: true,
        availableTables: ['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05', 'Table 06', 'Takeaway', 'Parcel'],
      },
      permissions: {
        cashiersCanCollectPayments: true,
      },
    };
    await setDoc(doc(db, 'businesses', b.id, 'settings', 'current'), settingsData);
    await setDoc(doc(db, 'businesses', b.id, 'meta', 'settings'), settingsData);

    // Bill Number Counter
    await setDoc(doc(db, 'businesses', b.id, 'meta', 'counters'), {
      lastBillNumber: 1002,
      prefix: 'BILL-',
      updatedAt: now,
    });

    // Members Subcollection
    console.log(`[3/5] Seeding Members & Staff for ${b.id}...`);
    const members = [
      {
        id: `mem_owner_${b.id}`,
        businessId: b.id,
        name: b.ownerName,
        email: b.ownerEmail,
        role: 'OWNER',
        canCollectPayment: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `mem_mgr_${b.id}`,
        businessId: b.id,
        name: 'Rahul Sharma',
        email: `manager.${b.id}@foodpos.app`,
        role: 'MANAGER',
        canCollectPayment: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `mem_cashier_${b.id}`,
        businessId: b.id,
        name: 'Amit Patel',
        email: `cashier.${b.id}@foodpos.app`,
        role: 'CASHIER',
        canCollectPayment: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    for (const mem of members) {
      await setDoc(doc(db, 'businesses', b.id, 'members', mem.id), mem);
    }

    // Categories Subcollection
    console.log(`[4/5] Seeding Categories, Menu, Suppliers & Inventory for ${b.id}...`);
    const categories = [
      { id: `cat_bev_${b.id}`, businessId: b.id, name: 'Beverages', sortOrder: 1, isActive: true },
      { id: `cat_snk_${b.id}`, businessId: b.id, name: 'Burgers & Quick Bites', sortOrder: 2, isActive: true },
      { id: `cat_meals_${b.id}`, businessId: b.id, name: 'Combos & Thalis', sortOrder: 3, isActive: true },
    ];
    for (const cat of categories) {
      await setDoc(doc(db, 'businesses', b.id, 'categories', cat.id), cat);
    }

    // Menu Items Subcollection
    const menuItems = [
      {
        id: `item_chai_${b.id}`,
        businessId: b.id,
        name: 'Special Masala Chai',
        price: 30,
        categoryId: `cat_bev_${b.id}`,
        categoryName: 'Beverages',
        gstRate: 5,
        isVeg: true,
        isActive: true,
        sortOrder: 1,
      },
      {
        id: `item_coffee_${b.id}`,
        businessId: b.id,
        name: 'Cold Coffee with Ice Cream',
        price: 95,
        categoryId: `cat_bev_${b.id}`,
        categoryName: 'Beverages',
        gstRate: 5,
        isVeg: true,
        isActive: true,
        sortOrder: 2,
      },
      {
        id: `item_burger_${b.id}`,
        businessId: b.id,
        name: 'Cheese Paneer Burger',
        price: 130,
        categoryId: `cat_snk_${b.id}`,
        categoryName: 'Burgers & Quick Bites',
        gstRate: 5,
        isVeg: true,
        isActive: true,
        sortOrder: 3,
      },
      {
        id: `item_fries_${b.id}`,
        businessId: b.id,
        name: 'Crispy Peri Peri Fries',
        price: 110,
        categoryId: `cat_snk_${b.id}`,
        categoryName: 'Burgers & Quick Bites',
        gstRate: 5,
        isVeg: true,
        isActive: true,
        sortOrder: 4,
      },
      {
        id: `item_thali_${b.id}`,
        businessId: b.id,
        name: 'Special Deluxe Executive Thali',
        price: 220,
        categoryId: `cat_meals_${b.id}`,
        categoryName: 'Combos & Thalis',
        gstRate: 5,
        isVeg: true,
        isActive: true,
        sortOrder: 5,
      },
    ];
    for (const item of menuItems) {
      await setDoc(doc(db, 'businesses', b.id, 'menuItems', item.id), item);
    }

    // Customers Subcollection
    const customers = [
      {
        id: `cust_walkin_${b.id}`,
        businessId: b.id,
        name: 'Walk-in Counter Guest',
        mobile: '9876543210',
        totalOrders: 15,
        totalSpent: 4200,
        createdAt: now,
      },
      {
        id: `cust_vip_${b.id}`,
        businessId: b.id,
        name: 'Rahul Varma',
        mobile: '9825012345',
        totalOrders: 8,
        totalSpent: 2850,
        createdAt: now,
      },
    ];
    for (const cust of customers) {
      await setDoc(doc(db, 'businesses', b.id, 'customers', cust.id), cust);
    }

    // Suppliers Subcollection
    const supplier = {
      id: `sup_dairy_${b.id}`,
      businessId: b.id,
      name: 'Pooja Dairy & Provisions',
      companyName: 'Pooja Dairy Farm LLP',
      mobile: '9898011223',
      whatsapp: '9898011223',
      email: 'poojadairy@example.com',
      address: 'Dairy Colony, GIDC, Ahmedabad',
      gstin: '24AABCP1234F1Z9',
      suppliedProducts: 'Fresh Milk, Amul Butter, Paneer, Cheese',
      paymentTerms: 'Weekly',
      notes: 'Priority morning delivery by 7:30 AM',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'businesses', b.id, 'suppliers', supplier.id), supplier);

    // Inventory Subcollection
    const inventoryItems = [
      {
        id: `inv_milk_${b.id}`,
        businessId: b.id,
        name: 'Fresh Cow Milk (Gold)',
        category: 'Dairy',
        unit: 'l',
        currentStock: 35,
        minimumStock: 10,
        purchasePrice: 62,
        supplierId: supplier.id,
        supplierName: supplier.name,
        lastPurchaseDate: now,
        stockStatus: 'IN_STOCK',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `inv_paneer_${b.id}`,
        businessId: b.id,
        name: 'Fresh Malai Paneer',
        category: 'Dairy',
        unit: 'kg',
        currentStock: 12,
        minimumStock: 5,
        purchasePrice: 340,
        supplierId: supplier.id,
        supplierName: supplier.name,
        lastPurchaseDate: now,
        stockStatus: 'IN_STOCK',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `inv_coffee_${b.id}`,
        businessId: b.id,
        name: 'Robusta Roasted Coffee Beans',
        category: 'Beverage Raw Materials',
        unit: 'kg',
        currentStock: 8,
        minimumStock: 3,
        purchasePrice: 650,
        supplierId: supplier.id,
        supplierName: supplier.name,
        lastPurchaseDate: now,
        stockStatus: 'IN_STOCK',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `inv_buns_${b.id}`,
        businessId: b.id,
        name: 'Brioche Burger Buns',
        category: 'Bakery',
        unit: 'packets',
        currentStock: 4,
        minimumStock: 10,
        purchasePrice: 45,
        supplierId: supplier.id,
        supplierName: supplier.name,
        lastPurchaseDate: now,
        stockStatus: 'LOW_STOCK',
        createdAt: now,
        updatedAt: now,
      },
    ];
    for (const inv of inventoryItems) {
      await setDoc(doc(db, 'businesses', b.id, 'inventory', inv.id), inv);
    }

    // Purchase Order & Stock Movement Subcollection
    const poId = `po_1001_${b.id}`;
    const poData = {
      id: poId,
      poNumber: 'PO-1001',
      businessId: b.id,
      supplierId: supplier.id,
      supplierName: supplier.name,
      items: [
        {
          inventoryItemId: `inv_milk_${b.id}`,
          itemName: 'Fresh Cow Milk (Gold)',
          unit: 'l',
          quantityOrdered: 20,
          quantityReceived: 20,
          unitCost: 62,
          lineTotal: 1240,
        },
        {
          inventoryItemId: `inv_paneer_${b.id}`,
          itemName: 'Fresh Malai Paneer',
          unit: 'kg',
          quantityOrdered: 5,
          quantityReceived: 5,
          unitCost: 340,
          lineTotal: 1700,
        },
      ],
      subtotal: 2940,
      discount: 0,
      taxAmount: 147,
      totalAmount: 3087,
      status: 'RECEIVED',
      amountPaid: 3087,
      balanceDue: 0,
      paymentStatus: 'PAID',
      orderDate: now,
      receivedDate: now,
      notes: 'Delivered in chilled van. Quality approved.',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'businesses', b.id, 'purchaseOrders', poId), poData);

    const stockMovement = {
      id: `sm_1001_${b.id}`,
      businessId: b.id,
      inventoryItemId: `inv_milk_${b.id}`,
      itemName: 'Fresh Cow Milk (Gold)',
      type: 'PURCHASE_RECEIPT',
      quantityChange: 20,
      previousStock: 15,
      newStock: 35,
      reason: 'PO-1001 Delivery Received',
      referenceId: 'PO-1001',
      createdAt: now,
    };
    await setDoc(doc(db, 'businesses', b.id, 'stockMovements', stockMovement.id), stockMovement);

    // Orders & Payments Subcollection
    console.log(`[5/5] Seeding Orders & Payments Subcollections for ${b.id}...`);

    // 1. Completed & Fully Paid Order
    const completedOrderId = `ord_comp_1001_${b.id}`;
    const completedOrder = {
      id: completedOrderId,
      businessId: b.id,
      billNumber: 'BILL-1001',
      tableNumber: 'Table 02',
      orderType: 'DINE_IN',
      items: [
        {
          itemId: `item_burger_${b.id}`,
          name: 'Cheese Paneer Burger',
          quantity: 2,
          unitPrice: 130,
          lineTotal: 260,
          gstRate: 5,
        },
        {
          itemId: `item_coffee_${b.id}`,
          name: 'Cold Coffee with Ice Cream',
          quantity: 2,
          unitPrice: 95,
          lineTotal: 190,
          gstRate: 5,
        },
      ],
      extras: [
        {
          id: 'ext_cheese_slice',
          name: 'Extra Cheese Slice',
          quantity: 2,
          unitPrice: 25,
          lineTotal: 50,
          gstRate: 5,
        },
      ],
      subtotal: 500,
      discountType: 'fixed',
      discountValue: 50,
      discountAmount: 50,
      taxableAmount: 450,
      gstRate: 5,
      gstAmount: 22.5,
      cgst: 11.25,
      sgst: 11.25,
      igst: 0,
      grandTotal: 472.5,
      amountPaid: 472.5,
      balanceDue: 0,
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      status: 'COMPLETED',
      customerName: 'Rahul Varma',
      customerPhone: '9825012345',
      createdBy: b.ownerEmail,
      createdAt: now,
      updatedAt: now,
      syncedWithCloud: true,
    };
    await setDoc(doc(db, 'businesses', b.id, 'orders', completedOrderId), completedOrder);

    // Payment subcollection record
    const paymentRecordId = `pay_1001_${b.id}`;
    const paymentRecord = {
      id: paymentRecordId,
      orderId: completedOrderId,
      businessId: b.id,
      amount: 472.5,
      paymentMethod: 'UPI',
      transactionRef: 'UPI/UTR-432109876543',
      collectedBy: b.ownerEmail,
      receivedAt: now,
      notes: 'GPay QR Scan received at counter',
    };
    await setDoc(doc(db, 'businesses', b.id, 'orders', completedOrderId, 'payments', paymentRecordId), paymentRecord);

    // 2. Draft / Open & Unpaid Order
    const draftOrderId = `ord_draft_1002_${b.id}`;
    const draftOrder = {
      id: draftOrderId,
      businessId: b.id,
      billNumber: 'BILL-1002',
      tableNumber: 'Table 04',
      orderType: 'DINE_IN',
      items: [
        {
          itemId: `item_thali_${b.id}`,
          name: 'Special Deluxe Executive Thali',
          quantity: 2,
          unitPrice: 220,
          lineTotal: 440,
          gstRate: 5,
        },
        {
          itemId: `item_chai_${b.id}`,
          name: 'Special Masala Chai',
          quantity: 2,
          unitPrice: 30,
          lineTotal: 60,
          gstRate: 5,
        },
      ],
      extras: [],
      subtotal: 500,
      discountType: 'fixed',
      discountValue: 0,
      discountAmount: 0,
      taxableAmount: 500,
      gstRate: 5,
      gstAmount: 25,
      cgst: 12.5,
      sgst: 12.5,
      igst: 0,
      grandTotal: 525,
      amountPaid: 0,
      balanceDue: 525,
      paymentMethod: 'CASH',
      paymentStatus: 'UNPAID',
      status: 'OPEN',
      customerName: 'Table 04 Guests',
      customerPhone: '',
      createdBy: b.ownerEmail,
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      updatedAt: now,
      syncedWithCloud: true,
    };
    await setDoc(doc(db, 'businesses', b.id, 'orders', draftOrderId), draftOrder);

    // Expenses Subcollection
    const expenseId = `exp_1001_${b.id}`;
    const expense = {
      id: expenseId,
      businessId: b.id,
      category: 'Kitchen Supplies',
      amount: 450,
      paymentMethod: 'CASH',
      description: 'Tissue rolls and food delivery containers',
      date: now,
      createdBy: b.ownerEmail,
      createdAt: now,
    };
    await setDoc(doc(db, 'businesses', b.id, 'expenses', expenseId), expense);

    // Activity Logs Subcollection
    const activityId = `act_1001_${b.id}`;
    const activity = {
      id: activityId,
      businessId: b.id,
      action: 'SYSTEM_INITIALIZATION',
      module: 'Core Database',
      performedBy: 'superadmin@foodpos.app',
      details: { businessId: b.id, businessName: b.name, status: 'INITIALIZED' },
      createdAt: now,
    };
    await setDoc(doc(db, 'businesses', b.id, 'activityLogs', activityId), activity);

    console.log(`✅ Complete subcollections initialized for tenant ${b.id}`);
  }
}

async function verifyAllCollections() {
  console.log('\n====================================================');
  console.log('🔍 VERIFYING CLOUD FIRESTORE COLLECTIONS & DOCUMENTS');
  console.log('====================================================');

  const bizId = 'biz_cafe_delight_101';
  const checks = [
    { name: 'Platform Admin Root', path: 'platform/admins' },
    { name: 'Platform Admin Account', path: 'platform/admins/directory/superadmin_master' },
    { name: 'Platform Settings Root', path: 'platform/settings' },
    { name: 'Platform General Settings', path: 'platform/settings/config/general' },
    { name: 'Platform Billing Settings', path: 'platform/settings/config/billing' },
    { name: 'Platform Shops Directory', path: `platform/shops/directory/${bizId}` },
    { name: 'Business Root Doc', path: `businesses/${bizId}` },
    { name: 'Business Profile (current)', path: `businesses/${bizId}/profile/current` },
    { name: 'Business Settings (current)', path: `businesses/${bizId}/settings/current` },
    { name: 'Business Meta Profile', path: `businesses/${bizId}/meta/profile` },
    { name: 'Business Meta Settings', path: `businesses/${bizId}/meta/settings` },
    { name: 'Business Counters', path: `businesses/${bizId}/meta/counters` },
    { name: 'Business Member (Owner)', path: `businesses/${bizId}/members/mem_owner_${bizId}` },
    { name: 'Business Category', path: `businesses/${bizId}/categories/cat_snk_${bizId}` },
    { name: 'Business Menu Item', path: `businesses/${bizId}/menuItems/item_burger_${bizId}` },
    { name: 'Business Customer', path: `businesses/${bizId}/customers/cust_vip_${bizId}` },
    { name: 'Business Supplier', path: `businesses/${bizId}/suppliers/sup_dairy_${bizId}` },
    { name: 'Business Inventory', path: `businesses/${bizId}/inventory/inv_milk_${bizId}` },
    { name: 'Business Purchase Order', path: `businesses/${bizId}/purchaseOrders/po_1001_${bizId}` },
    { name: 'Business Stock Movement', path: `businesses/${bizId}/stockMovements/sm_1001_${bizId}` },
    { name: 'Business Completed Order', path: `businesses/${bizId}/orders/ord_comp_1001_${bizId}` },
    { name: 'Business Payment Subcollection', path: `businesses/${bizId}/orders/ord_comp_1001_${bizId}/payments/pay_1001_${bizId}` },
    { name: 'Business Draft/Open Order', path: `businesses/${bizId}/orders/ord_draft_1002_${bizId}` },
    { name: 'Business Expense', path: `businesses/${bizId}/expenses/exp_1001_${bizId}` },
    { name: 'Business Activity Log', path: `businesses/${bizId}/activityLogs/act_1001_${bizId}` },
  ];

  let passed = 0;
  for (const check of checks) {
    const segments = check.path.split('/');
    let docRef;
    if (segments.length === 2) {
      docRef = doc(db, segments[0], segments[1]);
    } else if (segments.length === 4) {
      docRef = doc(db, segments[0], segments[1], segments[2], segments[3]);
    } else if (segments.length === 6) {
      docRef = doc(db, segments[0], segments[1], segments[2], segments[3], segments[4], segments[5]);
    } else {
      console.warn(`Skipping invalid path: ${check.path}`);
      continue;
    }

    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log(`✅ [CONFIRMED] ${check.name.padEnd(30)} -> ${check.path}`);
      passed++;
    } else {
      console.error(`❌ [NOT FOUND] ${check.name.padEnd(30)} -> ${check.path}`);
    }
  }

  console.log(`\nVerification Score: ${passed}/${checks.length} verified directly from Cloud Firestore!`);
  if (passed === checks.length) {
    console.log('🎉 ALL CLOUD FIRESTORE COLLECTIONS & DOCUMENTS PERSISTED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

async function main() {
  try {
    await ensureBusinessOwnerAuth();
    await authenticateSuperAdmin();
    await populateDatabase();
    await verifyAllCollections();
  } catch (error: any) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
