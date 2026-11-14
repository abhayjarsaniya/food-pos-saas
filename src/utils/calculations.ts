import { BillExtra, DiscountType, OrderItem, PricingMode } from '../types';

/**
 * Rounds a number safely to 2 decimal places
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates item line total
 */
export function calculateItemTotal(unitPrice: number, quantity: number): number {
  return round2(unitPrice * quantity);
}

/**
 * Calculates total discount amount
 */
export function calculateDiscount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): number {
  if (discountValue <= 0 || subtotal <= 0) return 0;
  if (discountType === 'percentage') {
    const val = (subtotal * discountValue) / 100;
    return round2(Math.min(subtotal, val));
  }
  return round2(Math.min(subtotal, discountValue));
}

export interface BillCalculationParams {
  items: OrderItem[];
  extras?: BillExtra[];
  discountType: DiscountType;
  discountValue: number;
  gstEnabled: boolean;
  pricingMode: PricingMode;
  defaultGstRate: number;
  isInterState?: boolean;
}

export interface BillCalculationSummary {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  effectiveGstRate: number;
  grandTotal: number;
}

/**
 * Computes complete billing numbers accurately including custom extras
 */
export function calculateBill(params: BillCalculationParams): BillCalculationSummary {
  const {
    items,
    extras = [],
    discountType,
    discountValue,
    gstEnabled,
    pricingMode,
    defaultGstRate,
    isInterState = false,
  } = params;

  // Subtotal is sum of regular menu item line totals + custom extras line totals
  const itemsSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const extrasSubtotal = extras.reduce((sum, ext) => sum + ext.unitPrice * ext.quantity, 0);
  const subtotal = round2(itemsSubtotal + extrasSubtotal);

  const discountAmount = calculateDiscount(subtotal, discountType, discountValue);
  const netBeforeTax = Math.max(0, round2(subtotal - discountAmount));

  if (!gstEnabled || netBeforeTax === 0) {
    return {
      subtotal,
      discountAmount,
      taxableAmount: netBeforeTax,
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      effectiveGstRate: 0,
      grandTotal: netBeforeTax,
    };
  }

  // Determine average or effective GST rate across items and extras
  let totalWeightedTaxRate = 0;
  let totalQuantity = 0;

  items.forEach((item) => {
    const itemRate = typeof item.gstRate === 'number' && item.gstRate >= 0 ? item.gstRate : defaultGstRate;
    totalWeightedTaxRate += itemRate * (item.unitPrice * item.quantity);
    totalQuantity += item.unitPrice * item.quantity;
  });

  extras.forEach((ext) => {
    const extRate = typeof ext.gstRate === 'number' && ext.gstRate >= 0 ? ext.gstRate : defaultGstRate;
    totalWeightedTaxRate += extRate * (ext.unitPrice * ext.quantity);
    totalQuantity += ext.unitPrice * ext.quantity;
  });

  const effectiveGstRate = totalQuantity > 0 
    ? round2(totalWeightedTaxRate / totalQuantity)
    : defaultGstRate;

  let taxableAmount = 0;
  let gstAmount = 0;
  let grandTotal = 0;

  if (pricingMode === 'inclusive') {
    // Price includes GST
    // Taxable = Net / (1 + Rate / 100)
    taxableAmount = round2(netBeforeTax / (1 + effectiveGstRate / 100));
    gstAmount = round2(netBeforeTax - taxableAmount);
    grandTotal = netBeforeTax;
  } else {
    // Exclusive: GST added on top
    taxableAmount = netBeforeTax;
    gstAmount = round2((taxableAmount * effectiveGstRate) / 100);
    grandTotal = round2(taxableAmount + gstAmount);
  }

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = gstAmount;
  } else {
    cgstAmount = round2(gstAmount / 2);
    sgstAmount = round2(gstAmount - cgstAmount); // Ensure total matches exactly
  }

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    effectiveGstRate,
    grandTotal,
  };
}

/**
 * Format currency with ₹
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '₹0.00';
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
