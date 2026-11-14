import { calculateBill, calculateDiscount, formatCurrency } from '../src/utils/calculations';
import { filterOrdersByDate, generateReportSummary } from '../src/services/reports/reportService';
import { buildWhatsAppMessage, formatWhatsAppPhone } from '../src/services/whatsapp/whatsappService';
import { generateReceiptPdf } from '../src/services/pdf/receiptGenerator';
import { BusinessProfile, BusinessSettings, Order, OrderItem } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- STARTING FOOD POS ACCEPTANCE TEST SUITE ---');

// 1. Discount Calculations Test (Percentage & Fixed)
const subtotal1000 = 1000;
const flatDiscount = calculateDiscount(subtotal1000, 'fixed', 150);
assert(flatDiscount === 150, 'Flat discount calculates 150 from 1000');

const pctDiscount = calculateDiscount(subtotal1000, 'percentage', 10);
assert(pctDiscount === 100, '10% discount calculates 100 from 1000');

const cappedDiscount = calculateDiscount(100, 'fixed', 250);
assert(cappedDiscount === 100, 'Discount is capped at subtotal amount');

// 2. GST Disabled Calculation Test
const items: OrderItem[] = [
  { itemId: '1', name: 'Burger', quantity: 2, unitPrice: 120, lineTotal: 240, gstRate: 5 },
  { itemId: '2', name: 'Coke', quantity: 1, unitPrice: 60, lineTotal: 60, gstRate: 5 },
];

const billNoGst = calculateBill({
  items,
  discountType: 'fixed',
  discountValue: 0,
  gstEnabled: false,
  pricingMode: 'exclusive',
  defaultGstRate: 5,
});

assert(billNoGst.subtotal === 300, 'Subtotal without GST is 300');
assert(billNoGst.gstAmount === 0, 'GST is 0 when disabled');
assert(billNoGst.grandTotal === 300, 'Grand total without GST is 300');

// 3. GST Exclusive Calculation Test
const billGstExclusive = calculateBill({
  items,
  discountType: 'fixed',
  discountValue: 0,
  gstEnabled: true,
  pricingMode: 'exclusive',
  defaultGstRate: 5,
  isInterState: false,
});

assert(billGstExclusive.taxableAmount === 300, 'Exclusive Taxable is 300');
assert(billGstExclusive.gstAmount === 15, 'Exclusive 5% GST is 15');
assert(billGstExclusive.cgstAmount === 7.5, 'CGST is 7.50');
assert(billGstExclusive.sgstAmount === 7.5, 'SGST is 7.50');
assert(billGstExclusive.grandTotal === 315, 'Grand total with exclusive GST is 315');

// 4. GST Inclusive Calculation Test
const billGstInclusive = calculateBill({
  items,
  discountType: 'fixed',
  discountValue: 0,
  gstEnabled: true,
  pricingMode: 'inclusive',
  defaultGstRate: 5,
});

assert(billGstInclusive.grandTotal === 300, 'Inclusive grand total remains 300');
assert(billGstInclusive.taxableAmount === 285.71, 'Inclusive taxable amount is 285.71 (300 / 1.05)');
assert(billGstInclusive.gstAmount === 14.29, 'Inclusive GST amount is 14.29');

// 5. WhatsApp Message Formatting Test
const mockProfile: BusinessProfile = {
  id: 'biz_1',
  name: 'Spice Garden',
  ownerName: 'Jenish',
  phone: '9876543210',
  category: 'restaurant',
  address: 'Ahmedabad',
  currency: 'INR',
  currencySymbol: '₹',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockOrder: Order = {
  id: 'ord_1',
  billNumber: 'BILL-1001',
  businessId: 'biz_1',
  customer: { name: 'Rahul', phone: '9876500000' },
  items,
  subtotal: 300,
  discountType: 'fixed',
  discountValue: 0,
  discountAmount: 0,
  taxableAmount: 300,
  gstAmount: 15,
  cgstAmount: 7.5,
  sgstAmount: 7.5,
  igstAmount: 0,
  grandTotal: 315,
  paymentMethod: 'UPI',
  paymentStatus: 'PAID',
  amountPaid: 315,
  balanceDue: 0,
  status: 'COMPLETED',
  taxConfigSnapshot: {
    enabled: true,
    gstin: '24AAAAA0000A1Z5',
    pricingMode: 'exclusive',
    defaultGstRate: 5,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const waMsg = buildWhatsAppMessage(mockOrder, mockProfile);
assert(waMsg.includes('Spice Garden'), 'WhatsApp message contains business name');
assert(waMsg.includes('BILL-1001'), 'WhatsApp message contains bill number');
assert(waMsg.includes('Burger'), 'WhatsApp message contains itemized lines');
assert(waMsg.includes('₹315.00'), 'WhatsApp message contains grand total');

// 6. WhatsApp Phone Number Sanitization (+91 normalization)
assert(formatWhatsAppPhone('9876500000') === '919876500000', '10-digit phone normalized to 91 prefix');
assert(formatWhatsAppPhone('+919876500000') === '919876500000', '+91 phone normalized to 91 prefix');

// 7. PDF Generation Test (Compact 80mm & A4)
const mockSettings: BusinessSettings = {
  tax: { enabled: true, gstin: '24ABC', defaultGstRate: 5, pricingMode: 'exclusive' },
  receipt: { defaultFormat: 'compact80', showLogo: true, showAddress: true, showPhone: true, showGstin: true, footerMessage: 'Thanks!' },
  billing: { defaultPaymentMethod: 'CASH', billNumberPrefix: 'BILL-', nextBillNumber: 1002 },
};

const pdf80 = generateReceiptPdf(mockOrder, mockProfile, mockSettings, 'compact80');
assert(pdf80 !== null && typeof pdf80.output === 'function', 'Compact 80mm thermal PDF generates successfully');

const pdfA4 = generateReceiptPdf(mockOrder, mockProfile, mockSettings, 'a4');
assert(pdfA4 !== null && typeof pdfA4.output === 'function', 'A4 tax invoice PDF generates successfully');

// 8. Voided Order & Revenue Exclusion Test
const voidedOrder: Order = {
  ...mockOrder,
  id: 'ord_void_1',
  billNumber: 'BILL-1002',
  grandTotal: 500,
  amountPaid: 500,
  status: 'VOIDED',
  voidReason: 'Customer walked out before billing completed',
};

const reportSummary = generateReportSummary([mockOrder, voidedOrder]);
assert(reportSummary.totalOrders === 1, 'Voided order is excluded from total order count');
assert(reportSummary.netSales === 315, 'Voided order amount 500 is completely excluded from net sales');
assert(reportSummary.upiCollection === 315, 'Voided payment collection is not added to collections');

console.log('--- ALL ACCEPTANCE CRITERIA ENGINE TESTS PASSED! ---');
