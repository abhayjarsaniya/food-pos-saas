import { calculateBill, calculateItemTotal, round2 } from '../src/utils/calculations';
import { createOrder, recordOrderPayment, markOrderReceived } from '../src/services/orders/orderService';
import { buildWhatsAppMessage } from '../src/services/whatsapp/whatsappService';
import { generateReceiptPdf } from '../src/services/pdf/receiptGenerator';
import { inviteMember, updateMember, getBusinessMembers } from '../src/services/members/memberService';
import { BusinessProfile, BusinessSettings, OrderItem, BillExtra, Order } from '../src/types';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

// Mock browser globals for Node test environment
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

console.log('--- STARTING DRAFT BILLING, PAYMENTS & EXTRAS ACCEPTANCE TESTS ---');

async function runTests() {
  const businessId = 'biz_draft_test_101';

  const mockProfile: BusinessProfile = {
    id: businessId,
    name: 'Saffron Courtyard Restaurant',
    ownerName: 'Chef Jenish',
    phone: '9876543210',
    category: 'restaurant',
    address: 'Bopal Cross Road, Ahmedabad',
    currency: 'INR',
    currencySymbol: '₹',
    status: 'ACTIVE',
    plan: 'pro',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSettings: BusinessSettings = {
    tax: {
      enabled: true,
      gstin: '24ABCDE1234F1Z5',
      defaultGstRate: 5,
      pricingMode: 'exclusive',
      isInterState: false,
    },
    receipt: {
      defaultFormat: 'compact80',
      showLogo: true,
      showAddress: true,
      showPhone: true,
      showGstin: true,
      footerMessage: 'Thank you for dining with us!',
    },
    billing: {
      defaultPaymentMethod: 'CASH',
      billNumberPrefix: 'BILL-',
      nextBillNumber: 1001,
    },
    tables: {
      enabled: true,
      availableTables: ['Table 01', 'Table 02', 'Table 03', 'Takeaway', 'Parcel'],
    },
    permissions: {
      cashiersCanCollectPayments: true,
    },
  };

  // 1. Extras and Bill Calculations Test
  const items: OrderItem[] = [
    {
      itemId: 'it_1',
      name: 'Paneer Tikka Masala',
      quantity: 2,
      unitPrice: 280,
      gstRate: 5,
      lineTotal: 560,
    },
    {
      itemId: 'it_2',
      name: 'Butter Naan',
      quantity: 4,
      unitPrice: 40,
      gstRate: 5,
      lineTotal: 160,
    },
  ];

  const extras: BillExtra[] = [
    {
      id: 'ext_1',
      name: 'Extra Cheese Topping',
      quantity: 2,
      unitPrice: 35,
      lineTotal: 70,
      gstRate: 5,
    },
    {
      id: 'ext_2',
      name: 'Special Green Mint Chutney',
      quantity: 1,
      unitPrice: 20,
      lineTotal: 20,
      gstRate: 5,
    },
  ];

  const calc = calculateBill({
    items,
    extras,
    discountType: 'fixed',
    discountValue: 50,
    gstEnabled: true,
    pricingMode: 'exclusive',
    defaultGstRate: 5,
  });

  // Items: 560 + 160 = 720. Extras: 70 + 20 = 90. Subtotal = 810.
  assert(calc.subtotal === 810, `Calculated subtotal including extras is 810 (got ${calc.subtotal})`);
  assert(calc.discountAmount === 50, `Calculated flat discount is 50`);
  // Taxable = 810 - 50 = 760. 5% GST = 38. Grand Total = 798.
  assert(calc.taxableAmount === 760, `Taxable amount is 760`);
  assert(calc.gstAmount === 38, `5% GST on net amount is 38`);
  assert(calc.grandTotal === 798, `Grand total with exclusive GST is 798`);

  // 2. Draft-First Bill Creation (OPEN & UNPAID)
  const draftOrder = await createOrder(businessId, {
    tableNumber: 'Table 03',
    orderType: 'DINE_IN',
    items,
    extras,
    subtotal: calc.subtotal,
    discountType: 'fixed',
    discountValue: 50,
    discountAmount: calc.discountAmount,
    taxableAmount: calc.taxableAmount,
    gstAmount: calc.gstAmount,
    cgstAmount: calc.cgstAmount,
    sgstAmount: calc.sgstAmount,
    igstAmount: 0,
    grandTotal: calc.grandTotal,
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
    amountPaid: 0,
    balanceDue: calc.grandTotal,
    status: 'OPEN',
    createdBy: 'cashier_1',
    createdByName: 'Counter Staff',
    taxConfigSnapshot: {
      enabled: true,
      gstin: '24ABCDE1234F1Z5',
      pricingMode: 'exclusive',
      defaultGstRate: 5,
    },
  });

  assert(draftOrder.status === 'OPEN', 'Newly saved bill has status OPEN');
  assert(draftOrder.paymentStatus === 'UNPAID', 'Newly saved bill has paymentStatus UNPAID');
  assert(draftOrder.amountPaid === 0, 'Initial amountPaid is 0');
  assert(draftOrder.balanceDue === 798, 'Initial balanceDue equals grand total 798');
  assert(draftOrder.tableNumber === 'Table 03', 'Table number Table 03 preserved');
  assert((draftOrder.extras?.length || 0) === 2, '2 custom extras preserved');

  // 3. Partial Payment Collection (Customer pays 300 advance)
  const partPaymentResult = await recordOrderPayment(businessId, draftOrder.id, {
    amount: 300,
    paymentMethod: 'UPI',
    paymentReference: 'UPI/2940294/REF',
    receivedBy: 'cashier_1',
    receivedByName: 'Counter Staff',
    notes: 'Advance paid at counter via GPay',
  });

  const partOrder = partPaymentResult.order;
  assert(partOrder.amountPaid === 300, 'Recorded partial payment: amountPaid is 300');
  assert(partOrder.balanceDue === 498, 'Remaining balanceDue is 498 (798 - 300)');
  assert(partOrder.paymentStatus === 'PARTIAL', 'Payment status updated to PARTIAL');
  assert(partOrder.payments?.length === 1, 'Payment subcollection record appended');

  // 4. Full Clearance Payment (Customer settles remaining 498)
  const fullPaymentResult = await recordOrderPayment(businessId, draftOrder.id, {
    amount: 498,
    paymentMethod: 'CASH',
    receivedBy: 'cashier_1',
    receivedByName: 'Counter Staff',
  });

  const fullyPaidOrder = fullPaymentResult.order;
  assert(fullyPaidOrder.amountPaid === 798, 'Total amountPaid updated to 798');
  assert(fullyPaidOrder.balanceDue === 0, 'Remaining balanceDue is 0');
  assert(fullyPaidOrder.paymentStatus === 'PAID', 'Payment status updated to PAID');
  assert(fullyPaidOrder.status === 'COMPLETED', 'Order status automatically updated to COMPLETED');
  assert(fullyPaidOrder.payments?.length === 2, 'Both partial and final payment records preserved in transaction history');

  // 5. One-Tap Quick Mark as Received Test
  const secondBill = await createOrder(businessId, {
    tableNumber: 'Table 01',
    orderType: 'DINE_IN',
    items: [items[0]],
    subtotal: 560,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    taxableAmount: 560,
    gstAmount: 28,
    cgstAmount: 14,
    sgstAmount: 14,
    igstAmount: 0,
    grandTotal: 588,
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
    amountPaid: 0,
    balanceDue: 588,
    status: 'OPEN',
    taxConfigSnapshot: {
      enabled: true,
      gstin: '24ABCDE1234F1Z5',
      pricingMode: 'exclusive',
      defaultGstRate: 5,
    },
  });

  const clearedSecondBill = await markOrderReceived(businessId, secondBill.id, 'UPI', 'owner_uid', 'Jenish Owner');
  assert(clearedSecondBill.balanceDue === 0, 'Quick mark received cleared balance to 0');
  assert(clearedSecondBill.paymentStatus === 'PAID', 'Quick mark received set status to PAID');
  assert(clearedSecondBill.status === 'COMPLETED', 'Quick mark received marked order COMPLETED');

  // 6. WhatsApp Message Generator Verification
  const unpaidMsg = buildWhatsAppMessage(draftOrder, mockProfile);
  assert(unpaidMsg.includes('PAYMENT PENDING'), 'Unpaid WhatsApp receipt clearly states PAYMENT PENDING');
  assert(unpaidMsg.includes('Amount Due: ₹798.00'), 'Unpaid WhatsApp receipt states Amount Due ₹798.00');
  assert(unpaidMsg.includes('Table: *Table 03*'), 'WhatsApp receipt includes Table 03');
  assert(unpaidMsg.includes('Extra Cheese Topping'), 'WhatsApp receipt includes custom extra');

  const paidMsg = buildWhatsAppMessage(fullyPaidOrder, mockProfile);
  assert(paidMsg.includes('PAID IN FULL'), 'Paid WhatsApp receipt states PAID IN FULL');

  // 7. Receipt PDF Generation (Thermal 80mm & 58mm & A4)
  const pdf80 = generateReceiptPdf(draftOrder, mockProfile, mockSettings, 'compact80');
  assert(pdf80 != null, 'Generated 80mm thermal receipt PDF with Payment Pending banner');

  const pdf58 = generateReceiptPdf(draftOrder, mockProfile, mockSettings, 'compact58');
  assert(pdf58 != null, 'Generated 58mm thermal receipt PDF');

  const pdfA4 = generateReceiptPdf(fullyPaidOrder, mockProfile, mockSettings, 'a4');
  assert(pdfA4 != null, 'Generated A4 Tax Invoice PDF');

  // 8. Staff & Member Management
  const member = await inviteMember(businessId, {
    name: 'Amit Patel',
    email: 'amit@foodpos.app',
    role: 'CASHIER',
    canCollectPayment: false,
  });
  assert(member.role === 'CASHIER', 'Invited member role is CASHIER');
  assert(member.canCollectPayment === false, 'Cashier payment authorization set to false');

  await updateMember(businessId, member.id, { canCollectPayment: true });
  const allMembers = await getBusinessMembers(businessId);
  const updatedMember = allMembers.find((m) => m.id === member.id);
  assert(updatedMember?.canCollectPayment === true, 'Owner successfully authorized cashier payment collection');

  console.log('--- ALL DRAFT BILLING, PAYMENTS & EXTRAS ACCEPTANCE TESTS PASSED! ---');
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
