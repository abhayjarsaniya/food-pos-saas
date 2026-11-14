import { MenuItem, Order, OrderItem, PaymentMethod, PaymentStatus } from '../../types';
import { calculateBill, calculateItemTotal, round2 } from '../../utils/calculations';
import { getOrdersFromIndexedDB, saveOrderToIndexedDB, deleteOrderFromIndexedDB } from '../offline/indexedDb';

export const DEMO_MENU_ITEMS: Omit<MenuItem, 'id' | 'businessId'>[] = [
  { name: 'Special Executive Thali', price: 180, categoryId: 'cat_main', categoryName: 'Main Course', isVeg: true, isActive: true, sortOrder: 1 },
  { name: 'Paneer Butter Masala', price: 210, categoryId: 'cat_main', categoryName: 'Main Course', isVeg: true, isActive: true, sortOrder: 2 },
  { name: 'Butter Garlic Naan', price: 45, categoryId: 'cat_main', categoryName: 'Main Course', isVeg: true, isActive: true, sortOrder: 3 },
  { name: 'Hyderabadi Veg Biryani', price: 160, categoryId: 'cat_main', categoryName: 'Main Course', isVeg: true, isActive: true, sortOrder: 4 },
  { name: 'Mysore Masala Dosa', price: 110, categoryId: 'cat_south', categoryName: 'South Indian', isVeg: true, isActive: true, sortOrder: 5 },
  { name: 'Medu Vada Sambhar (2 pcs)', price: 70, categoryId: 'cat_south', categoryName: 'South Indian', isVeg: true, isActive: true, sortOrder: 6 },
  { name: 'Special Mumbai Pav Bhaji', price: 120, categoryId: 'cat_street', categoryName: 'Street Food', isVeg: true, isActive: true, sortOrder: 7 },
  { name: 'Delhi Style Chole Bhature', price: 130, categoryId: 'cat_street', categoryName: 'Street Food', isVeg: true, isActive: true, sortOrder: 8 },
  { name: 'Samosa Chaat with Dahi', price: 65, categoryId: 'cat_street', categoryName: 'Street Food', isVeg: true, isActive: true, sortOrder: 9 },
  { name: 'Cheese Grilled Sandwich', price: 95, categoryId: 'cat_bites', categoryName: 'Quick Bites', isVeg: true, isActive: true, sortOrder: 10 },
  { name: 'Crispy French Fries (Peri Peri)', price: 85, categoryId: 'cat_bites', categoryName: 'Quick Bites', isVeg: true, isActive: true, sortOrder: 11 },
  { name: 'Veg Hakka Noodles', price: 135, categoryId: 'cat_bites', categoryName: 'Quick Bites', isVeg: true, isActive: true, sortOrder: 12 },
  { name: 'Cutting Masala Chai', price: 25, categoryId: 'cat_beverages', categoryName: 'Beverages', isVeg: true, isActive: true, sortOrder: 13 },
  { name: 'Cold Coffee with Ice Cream', price: 90, categoryId: 'cat_beverages', categoryName: 'Beverages', isVeg: true, isActive: true, sortOrder: 14 },
  { name: 'Punjabi Sweet Lassi', price: 60, categoryId: 'cat_beverages', categoryName: 'Beverages', isVeg: true, isActive: true, sortOrder: 15 },
  { name: 'Hot Gulab Jamun (2 pcs)', price: 50, categoryId: 'cat_desserts', categoryName: 'Desserts', isVeg: true, isActive: true, sortOrder: 16 },
];

export const DEMO_CUSTOMERS = [
  { name: 'Rahul Sharma', phone: '9820011223' },
  { name: 'Amit Verma', phone: '9819922334' },
  { name: 'Priya Patel', phone: '9825033445' },
  { name: 'Rohit Gupta', phone: '9876044556' },
  { name: 'Sneha Shah', phone: '9824055667' },
  { name: 'Vikram Singh', phone: '9811066778' },
  { name: 'Neha Joshi', phone: '9898077889' },
  { name: 'Ankit Mehta', phone: '9879088990' },
  { name: 'Pooja Jain', phone: '9825199001' },
  { name: 'Raj Malhotra', phone: '9810112233' },
  { name: 'Deepak Rao', phone: '9845123344' },
  { name: 'Kavita Dave', phone: '9824134455' },
  { name: 'Manish Trivedi', phone: '9879145566' },
  { name: 'Ritu Agarwal', phone: '9818156677' },
  { name: 'Sanjay Chawla', phone: '9810167788' },
  { name: 'Swati Desai', phone: '9825178899' },
  { name: 'Gaurav Kulkarni', phone: '9820189900' },
  { name: 'Sunita Nair', phone: '9847190011' },
  { name: 'Alok Pandey', phone: '9839201122' },
  { name: 'Megha Reddy', phone: '9849212233' },
  { name: 'Karan Kapoor', phone: '9811223344' },
  { name: 'Tanvi Shah', phone: '9824234455' },
  { name: 'Nikhil Roy', phone: '9830245566' },
  { name: 'Bhavna Parekh', phone: '9825256677' },
  { name: 'Harshil Vora', phone: '9879267788' },
];

/**
 * Generate 60 realistic orders (32 yesterday + 28 today)
 */
export async function seedDemoData(targetBusinessId = 'demo-business-owner-101'): Promise<{
  ordersCreated: number;
  yesterdayCount: number;
  todayCount: number;
}> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const ordersToCreate: Order[] = [];

  // 32 orders for Yesterday
  for (let i = 1; i <= 32; i++) {
    const hour = i % 3 === 0 ? 13 : i % 2 === 0 ? 20 : 16;
    const minute = (i * 7) % 60;
    const orderDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), hour, minute, 0);

    const order = buildSyntheticOrder({
      businessId: targetBusinessId,
      billSeq: 1000 + i,
      date: orderDate,
      customerIdx: i % DEMO_CUSTOMERS.length,
    });
    ordersToCreate.push(order);
  }

  // 28 orders for Today
  for (let j = 1; j <= 28; j++) {
    const hour = j % 3 === 0 ? 12 : j % 2 === 0 ? 15 : 18;
    const minute = (j * 9) % 60;
    const orderDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);

    const order = buildSyntheticOrder({
      businessId: targetBusinessId,
      billSeq: 1032 + j,
      date: orderDate,
      customerIdx: (j + 5) % DEMO_CUSTOMERS.length,
    });
    ordersToCreate.push(order);
  }

  // Save in IndexedDB
  for (const ord of ordersToCreate) {
    await saveOrderToIndexedDB(ord);
  }

  return {
    ordersCreated: ordersToCreate.length,
    yesterdayCount: 32,
    todayCount: 28,
  };
}

/**
 * Clears demo orders from target business
 */
export async function resetDemoData(targetBusinessId = 'demo-business-owner-101'): Promise<number> {
  const allOrders = await getOrdersFromIndexedDB();
  const demoOrders = allOrders.filter((o) => o.isDemo && o.businessId === targetBusinessId);

  for (const o of demoOrders) {
    await deleteOrderFromIndexedDB(o.id);
  }

  return demoOrders.length;
}

function buildSyntheticOrder(params: {
  businessId: string;
  billSeq: number;
  date: Date;
  customerIdx: number;
}): Order {
  const { businessId, billSeq, date, customerIdx } = params;
  const cust = DEMO_CUSTOMERS[customerIdx];

  // Pick 1 to 4 items from DEMO_MENU_ITEMS
  const itemCount = 1 + (billSeq % 3);
  const selectedItems: OrderItem[] = [];

  for (let k = 0; k < itemCount; k++) {
    const menuIdx = (billSeq + k * 4) % DEMO_MENU_ITEMS.length;
    const m = DEMO_MENU_ITEMS[menuIdx];
    const qty = 1 + ((billSeq + k) % 3);
    selectedItems.push({
      itemId: `demo_item_${menuIdx}`,
      name: m.name,
      quantity: qty,
      unitPrice: m.price,
      gstRate: 5,
      lineTotal: calculateItemTotal(m.price, qty),
      isVeg: m.isVeg,
    });
  }

  const subtotal = selectedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const discountAmount = billSeq % 5 === 0 ? 20 : 0;
  const taxableAmount = subtotal - discountAmount;
  const gstAmount = round2((taxableAmount * 5) / 100);
  const grandTotal = round2(taxableAmount + gstAmount);

  // Distribution of payment methods: 50% UPI, 40% Cash, 10% Card
  const paymentMethod: PaymentMethod = billSeq % 10 < 5 ? 'UPI' : billSeq % 10 < 9 ? 'CASH' : 'CARD';
  
  // 90% PAID, 7% PARTIAL, 3% UNPAID
  let paymentStatus: PaymentStatus = 'PAID';
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

  const iso = date.toISOString();

  return {
    id: `ord_demo_${billSeq}_${date.getTime()}`,
    billNumber: `BILL-${billSeq}`,
    businessId,
    customer: cust,
    items: selectedItems,
    subtotal,
    discountType: 'fixed',
    discountValue: discountAmount,
    discountAmount,
    taxableAmount,
    gstAmount,
    cgstAmount: round2(gstAmount / 2),
    sgstAmount: round2(gstAmount / 2),
    igstAmount: 0,
    grandTotal,
    paymentMethod,
    paymentStatus,
    amountPaid,
    balanceDue,
    status: 'COMPLETED',
    taxConfigSnapshot: {
      enabled: true,
      gstin: '24ABCDE1234F1Z5',
      pricingMode: 'exclusive',
      defaultGstRate: 5,
    },
    isDemo: true,
    syncedWithCloud: true,
    createdAt: iso,
    updatedAt: iso,
  };
}
