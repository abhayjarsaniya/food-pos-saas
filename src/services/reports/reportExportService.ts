import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, MenuItem, InventoryItem, StockMovement, PurchaseOrder, Supplier, Expense, Customer } from '../../types';
import { round2 } from '../../utils/calculations';

export type ReportType =
  | 'all_orders'
  | 'sales_summary'
  | 'payment_collection'
  | 'pending_payments'
  | 'paid_orders'
  | 'partially_paid_orders'
  | 'unpaid_orders'
  | 'cancelled_orders'
  | 'product_sales'
  | 'category_sales'
  | 'customer_orders'
  | 'inventory_stock'
  | 'stock_movement'
  | 'purchase_orders'
  | 'suppliers_list'
  | 'expenses'
  | 'tax_gst';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom';

export type ReportBreakdown = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ReportCategoryMeta {
  id: ReportType;
  label: string;
  categoryGroup: 'Sales & Orders' | 'Payments & Dues' | 'Inventory & Supplies' | 'Financial & Tax';
  description: string;
}

export const REPORT_CATEGORIES: ReportCategoryMeta[] = [
  // Sales & Orders
  { id: 'all_orders', label: 'All Orders', categoryGroup: 'Sales & Orders', description: 'Complete order records including table, type and status' },
  { id: 'sales_summary', label: 'Sales Summary & Revenue', categoryGroup: 'Sales & Orders', description: 'Gross sales, discounts, net sales and transaction counts' },
  { id: 'product_sales', label: 'Product & Variant Sales', categoryGroup: 'Sales & Orders', description: 'Units sold and revenue generated per menu item and variant' },
  { id: 'category_sales', label: 'Category-wise Sales', categoryGroup: 'Sales & Orders', description: 'Revenue and volume grouped by food category' },
  { id: 'customer_orders', label: 'Customer Directory & Spends', categoryGroup: 'Sales & Orders', description: 'Customer order frequency, total spending and loyalty' },

  // Payments & Dues
  { id: 'payment_collection', label: 'Payment Collection (Cash/UPI/Card)', categoryGroup: 'Payments & Dues', description: 'Tally of payments received via Cash, UPI, Card and Other' },
  { id: 'pending_payments', label: 'Pending Payments & Dues', categoryGroup: 'Payments & Dues', description: 'Open bills with outstanding balance due' },
  { id: 'paid_orders', label: 'Fully Paid Bills', categoryGroup: 'Payments & Dues', description: 'Orders settled in full with zero balance' },
  { id: 'partially_paid_orders', label: 'Partially Paid Bills', categoryGroup: 'Payments & Dues', description: 'Bills with partial deposit and remaining balance' },
  { id: 'unpaid_orders', label: 'Unpaid / Credit Bills', categoryGroup: 'Payments & Dues', description: 'Bills with zero payment received to date' },
  { id: 'cancelled_orders', label: 'Cancelled & Voided Orders', categoryGroup: 'Payments & Dues', description: 'Audit report of cancelled, voided or refunded bills' },

  // Inventory & Supplies
  { id: 'inventory_stock', label: 'Inventory Stock Status', categoryGroup: 'Inventory & Supplies', description: 'Current stock levels, low-stock warnings and valuation' },
  { id: 'stock_movement', label: 'Stock Movements & Audit Logs', categoryGroup: 'Inventory & Supplies', description: 'Raw material in/out transactions, wastage and adjustments' },
  { id: 'purchase_orders', label: 'Purchase Orders & Inward', categoryGroup: 'Inventory & Supplies', description: 'Supplier purchase orders, delivery status and dues' },
  { id: 'suppliers_list', label: 'Suppliers & Vendors Directory', categoryGroup: 'Inventory & Supplies', description: 'Supplier directory, cumulative purchases and payables' },

  // Financial & Tax
  { id: 'expenses', label: 'Expenses & Petty Cash', categoryGroup: 'Financial & Tax', description: 'Operating expenses, petty cash vouchers and salaries' },
  { id: 'tax_gst', label: 'Tax & GST Summary', categoryGroup: 'Financial & Tax', description: 'Taxable order values, CGST, SGST and total tax collected' },
];

export interface ExportDataPayload {
  orders: Order[];
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  expenses: Expense[];
  customers: Customer[];
  menuItems: MenuItem[];
}

export interface ComputedReportSummary {
  recordCount: number;
  totalGross: number;
  totalDiscount: number;
  totalNet: number;
  totalTax: number;
  totalCollected: number;
  totalOutstanding: number;
  cashCollection: number;
  upiCollection: number;
  cardCollection: number;
  otherCollection: number;
  rows: Record<string, any>[];
  columns: { key: string; header: string; align?: 'left' | 'right' | 'center' }[];
}

/**
 * Calculates start and end Date objects for a chosen preset
 */
export function getDateRange(preset: DateRangePreset, customStart?: string, customEnd?: string): { from: Date; to: Date; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  let from = startOfDay(now);
  let to = endOfDay(now);
  let label = "Today";

  switch (preset) {
    case 'today':
      from = startOfDay(now);
      to = endOfDay(now);
      label = "Today";
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = startOfDay(y);
      to = endOfDay(y);
      label = "Yesterday";
      break;
    }
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const mon = new Date(now);
      mon.setDate(diff);
      from = startOfDay(mon);
      to = endOfDay(now);
      label = "This Week (Mon - Today)";
      break;
    }
    case 'last_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const lastMon = new Date(now);
      lastMon.setDate(diff - 7);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastSun.getDate() + 6);
      from = startOfDay(lastMon);
      to = endOfDay(lastSun);
      label = "Last Week";
      break;
    }
    case 'this_month':
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = endOfDay(now);
      label = "This Month (M-T-D)";
      break;
    case 'last_month': {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      label = "Last Month";
      break;
    }
    case 'this_year':
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = endOfDay(now);
      label = "This Year (Y-T-D)";
      break;
    case 'last_30_days': {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      from = startOfDay(d30);
      to = endOfDay(now);
      label = "Last 30 Days";
      break;
    }
    case 'last_90_days': {
      const d90 = new Date(now);
      d90.setDate(d90.getDate() - 90);
      from = startOfDay(d90);
      to = endOfDay(now);
      label = "Last 90 Days";
      break;
    }
    case 'custom':
      if (customStart && customEnd) {
        from = startOfDay(new Date(customStart));
        to = endOfDay(new Date(customEnd));
        label = `${customStart} to ${customEnd}`;
      } else {
        from = startOfDay(now);
        to = endOfDay(now);
        label = "Custom Period";
      }
      break;
  }

  return { from, to, label };
}

/**
 * Filter orders strictly by date range
 */
export function filterOrdersByRange(orders: Order[], from: Date, to: Date): Order[] {
  return orders.filter((o) => {
    const d = new Date(o.createdAt);
    return d >= from && d <= to;
  });
}

/**
 * Process report rows and compute real aggregate metrics
 */
export function computeReportData(
  reportType: ReportType,
  data: ExportDataPayload,
  from: Date,
  to: Date
): ComputedReportSummary {
  const dateFilteredOrders = filterOrdersByRange(data.orders, from, to);

  // Helper for payment tally
  const tallyPayments = (ords: Order[]) => {
    let cash = 0, upi = 0, card = 0, other = 0;
    ords.forEach((o) => {
      if (o.status === 'CANCELLED' || o.status === 'VOIDED') return;
      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p) => {
          if (p.paymentMethod === 'CASH') cash += p.amount;
          else if (p.paymentMethod === 'UPI') upi += p.amount;
          else if (p.paymentMethod === 'CARD') card += p.amount;
          else other += p.amount;
        });
      } else {
        const amt = o.amountPaid || (o.paymentStatus === 'PAID' ? o.grandTotal : 0);
        if (amt > 0) {
          if (o.paymentMethod === 'CASH') cash += amt;
          else if (o.paymentMethod === 'UPI') upi += amt;
          else if (o.paymentMethod === 'CARD') card += amt;
          else other += amt;
        }
      }
    });
    return { cash: round2(cash), upi: round2(upi), card: round2(card), other: round2(other) };
  };

  switch (reportType) {
    case 'all_orders': {
      const validOrders = dateFilteredOrders;
      let totalGross = 0, totalNet = 0, totalTax = 0, totalDisc = 0, totalOutstanding = 0;
      
      const rows = validOrders.map((o) => {
        const isVoid = o.status === 'CANCELLED' || o.status === 'VOIDED';
        if (!isVoid) {
          totalGross += (o.subtotal || 0);
          totalNet += (o.grandTotal || 0);
          totalTax += (o.gstAmount || 0);
          totalDisc += (o.discountAmount || 0);
          totalOutstanding += (o.balanceDue || 0);
        }
        return {
          'Bill Number': o.billNumber,
          'Date & Time': new Date(o.createdAt).toLocaleString(),
          'Order Type': o.orderType || 'DINE_IN',
          'Table': o.tableNumber || '-',
          'Customer': o.customer?.name || (o as any).customerName || 'Walk-in',
          'Customer Phone': o.customer?.phone || (o as any).customerPhone || '-',
          'Subtotal (₹)': round2(o.subtotal),
          'Discount (₹)': round2(o.discountAmount),
          'Tax/GST (₹)': round2(o.gstAmount),
          'Grand Total (₹)': round2(o.grandTotal),
          'Amount Paid (₹)': round2(o.amountPaid || (o.paymentStatus === 'PAID' ? o.grandTotal : 0)),
          'Balance Due (₹)': round2(o.balanceDue || 0),
          'Payment Status': o.paymentStatus,
          'Payment Mode': o.paymentMethod || '-',
          'Order Status': o.status,
        };
      });

      const pt = tallyPayments(validOrders);
      const totalCollected = round2(pt.cash + pt.upi + pt.card + pt.other);

      return {
        recordCount: rows.length,
        totalGross: round2(totalGross),
        totalDiscount: round2(totalDisc),
        totalNet: round2(totalNet),
        totalTax: round2(totalTax),
        totalCollected,
        totalOutstanding: round2(totalOutstanding),
        cashCollection: pt.cash,
        upiCollection: pt.upi,
        cardCollection: pt.card,
        otherCollection: pt.other,
        rows,
        columns: [
          { key: 'Bill Number', header: 'Bill #' },
          { key: 'Date & Time', header: 'Date & Time' },
          { key: 'Order Type', header: 'Type' },
          { key: 'Table', header: 'Table' },
          { key: 'Customer', header: 'Customer' },
          { key: 'Grand Total (₹)', header: 'Total (₹)', align: 'right' },
          { key: 'Amount Paid (₹)', header: 'Paid (₹)', align: 'right' },
          { key: 'Balance Due (₹)', header: 'Due (₹)', align: 'right' },
          { key: 'Payment Status', header: 'Payment Status' },
          { key: 'Order Status', header: 'Status' },
        ],
      };
    }

    case 'sales_summary': {
      const validOrders = dateFilteredOrders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'VOIDED');
      let totalGross = 0, totalNet = 0, totalTax = 0, totalDisc = 0, totalOutstanding = 0;

      // Group by date
      const dailyMap = new Map<string, { count: number; gross: number; disc: number; tax: number; net: number; collected: number; due: number }>();

      validOrders.forEach((o) => {
        const dKey = o.createdAt.split('T')[0];
        const cur = dailyMap.get(dKey) || { count: 0, gross: 0, disc: 0, tax: 0, net: 0, collected: 0, due: 0 };
        const paid = o.amountPaid || (o.paymentStatus === 'PAID' ? o.grandTotal : 0);
        const due = o.balanceDue || 0;

        totalGross += o.subtotal;
        totalNet += o.grandTotal;
        totalTax += o.gstAmount;
        totalDisc += o.discountAmount;
        totalOutstanding += due;

        dailyMap.set(dKey, {
          count: cur.count + 1,
          gross: cur.gross + o.subtotal,
          disc: cur.disc + o.discountAmount,
          tax: cur.tax + o.gstAmount,
          net: cur.net + o.grandTotal,
          collected: cur.collected + paid,
          due: cur.due + due,
        });
      });

      const pt = tallyPayments(validOrders);
      const totalCollected = round2(pt.cash + pt.upi + pt.card + pt.other);

      const rows = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, st]) => ({
          'Date': date,
          'Total Orders': st.count,
          'Gross Sales (₹)': round2(st.gross),
          'Discounts (₹)': round2(st.disc),
          'GST/Tax (₹)': round2(st.tax),
          'Net Sales (₹)': round2(st.net),
          'Collected (₹)': round2(st.collected),
          'Outstanding Due (₹)': round2(st.due),
          'Avg Order Value (₹)': st.count > 0 ? round2(st.net / st.count) : 0,
        }));

      return {
        recordCount: validOrders.length,
        totalGross: round2(totalGross),
        totalDiscount: round2(totalDisc),
        totalNet: round2(totalNet),
        totalTax: round2(totalTax),
        totalCollected,
        totalOutstanding: round2(totalOutstanding),
        cashCollection: pt.cash,
        upiCollection: pt.upi,
        cardCollection: pt.card,
        otherCollection: pt.other,
        rows,
        columns: [
          { key: 'Date', header: 'Date' },
          { key: 'Total Orders', header: 'Orders', align: 'center' },
          { key: 'Gross Sales (₹)', header: 'Gross (₹)', align: 'right' },
          { key: 'Discounts (₹)', header: 'Discount (₹)', align: 'right' },
          { key: 'GST/Tax (₹)', header: 'Tax (₹)', align: 'right' },
          { key: 'Net Sales (₹)', header: 'Net Sales (₹)', align: 'right' },
          { key: 'Collected (₹)', header: 'Collected (₹)', align: 'right' },
          { key: 'Outstanding Due (₹)', header: 'Due (₹)', align: 'right' },
          { key: 'Avg Order Value (₹)', header: 'AOV (₹)', align: 'right' },
        ],
      };
    }

    case 'payment_collection': {
      const validOrders = dateFilteredOrders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'VOIDED');
      const pt = tallyPayments(validOrders);
      const totalCollected = round2(pt.cash + pt.upi + pt.card + pt.other);

      const rows: Record<string, any>[] = [];
      validOrders.forEach((o) => {
        if (o.payments && o.payments.length > 0) {
          o.payments.forEach((p) => {
            rows.push({
              'Bill Number': o.billNumber,
              'Date & Time': new Date(p.receivedAt || o.createdAt).toLocaleString(),
              'Payment Mode': p.paymentMethod,
              'Amount Collected (₹)': round2(p.amount),
              'Reference/Note': p.paymentReference || p.notes || '-',
              'Customer': o.customer?.name || (o as any).customerName || 'Walk-in',
            });
          });
        } else {
          const amt = o.amountPaid || (o.paymentStatus === 'PAID' ? o.grandTotal : 0);
          if (amt > 0) {
            rows.push({
              'Bill Number': o.billNumber,
              'Date & Time': new Date(o.createdAt).toLocaleString(),
              'Payment Mode': o.paymentMethod || 'CASH',
              'Amount Collected (₹)': round2(amt),
              'Reference/Note': '-',
              'Customer': o.customer?.name || (o as any).customerName || 'Walk-in',
            });
          }
        }
      });

      return {
        recordCount: rows.length,
        totalGross: totalCollected,
        totalDiscount: 0,
        totalNet: totalCollected,
        totalTax: 0,
        totalCollected,
        totalOutstanding: 0,
        cashCollection: pt.cash,
        upiCollection: pt.upi,
        cardCollection: pt.card,
        otherCollection: pt.other,
        rows,
        columns: [
          { key: 'Bill Number', header: 'Bill #' },
          { key: 'Date & Time', header: 'Date & Time' },
          { key: 'Payment Mode', header: 'Payment Mode' },
          { key: 'Amount Collected (₹)', header: 'Amount (₹)', align: 'right' },
          { key: 'Customer', header: 'Customer' },
          { key: 'Reference/Note', header: 'Reference' },
        ],
      };
    }

    case 'pending_payments':
    case 'unpaid_orders':
    case 'partially_paid_orders': {
      let filtered = dateFilteredOrders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'VOIDED');
      if (reportType === 'pending_payments') {
        filtered = filtered.filter((o) => (o.balanceDue || 0) > 0 || o.paymentStatus !== 'PAID');
      } else if (reportType === 'unpaid_orders') {
        filtered = filtered.filter((o) => o.paymentStatus === 'UNPAID');
      } else if (reportType === 'partially_paid_orders') {
        filtered = filtered.filter((o) => o.paymentStatus === 'PARTIAL' || o.paymentStatus === 'PARTIALLY_PAID');
      }

      let totalGross = 0, totalNet = 0, totalPaid = 0, totalDue = 0;
      const rows = filtered.map((o) => {
        const paid = o.amountPaid || (o.paymentStatus === 'PAID' ? o.grandTotal : 0);
        const due = o.balanceDue || (o.grandTotal - paid);
        totalGross += o.subtotal;
        totalNet += o.grandTotal;
        totalPaid += paid;
        totalDue += due;

        return {
          'Bill Number': o.billNumber,
          'Date & Time': new Date(o.createdAt).toLocaleString(),
          'Customer': o.customer?.name || (o as any).customerName || 'Walk-in',
          'Phone': o.customer?.phone || (o as any).customerPhone || '-',
          'Table': o.tableNumber || '-',
          'Bill Total (₹)': round2(o.grandTotal),
          'Amount Paid (₹)': round2(paid),
          'Balance Due (₹)': round2(due),
          'Payment Status': o.paymentStatus,
        };
      });

      const pt = tallyPayments(filtered);

      return {
        recordCount: rows.length,
        totalGross: round2(totalGross),
        totalDiscount: 0,
        totalNet: round2(totalNet),
        totalTax: 0,
        totalCollected: round2(totalPaid),
        totalOutstanding: round2(totalDue),
        cashCollection: pt.cash,
        upiCollection: pt.upi,
        cardCollection: pt.card,
        otherCollection: pt.other,
        rows,
        columns: [
          { key: 'Bill Number', header: 'Bill #' },
          { key: 'Date & Time', header: 'Date & Time' },
          { key: 'Customer', header: 'Customer' },
          { key: 'Phone', header: 'Phone' },
          { key: 'Table', header: 'Table' },
          { key: 'Bill Total (₹)', header: 'Total (₹)', align: 'right' },
          { key: 'Amount Paid (₹)', header: 'Paid (₹)', align: 'right' },
          { key: 'Balance Due (₹)', header: 'Due (₹)', align: 'right' },
          { key: 'Payment Status', header: 'Status' },
        ],
      };
    }

    case 'paid_orders': {
      const filtered = dateFilteredOrders.filter((o) => o.paymentStatus === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'VOIDED');
      let totalNet = 0;
      const rows = filtered.map((o) => {
        totalNet += o.grandTotal;
        return {
          'Bill Number': o.billNumber,
          'Date & Time': new Date(o.createdAt).toLocaleString(),
          'Customer': o.customer?.name || (o as any).customerName || 'Walk-in',
          'Table': o.tableNumber || '-',
          'Total (₹)': round2(o.grandTotal),
          'Payment Method': o.paymentMethod || 'CASH',
        };
      });
      const pt = tallyPayments(filtered);
      return {
        recordCount: rows.length,
        totalGross: round2(totalNet),
        totalDiscount: 0,
        totalNet: round2(totalNet),
        totalTax: 0,
        totalCollected: round2(totalNet),
        totalOutstanding: 0,
        cashCollection: pt.cash,
        upiCollection: pt.upi,
        cardCollection: pt.card,
        otherCollection: pt.other,
        rows,
        columns: [
          { key: 'Bill Number', header: 'Bill #' },
          { key: 'Date & Time', header: 'Date & Time' },
          { key: 'Customer', header: 'Customer' },
          { key: 'Table', header: 'Table' },
          { key: 'Total (₹)', header: 'Total (₹)', align: 'right' },
          { key: 'Payment Method', header: 'Mode' },
        ],
      };
    }

    case 'cancelled_orders': {
      const filtered = dateFilteredOrders.filter((o) => o.status === 'CANCELLED' || o.status === 'VOIDED');
      let totalVoidValue = 0;
      const rows = filtered.map((o) => {
        totalVoidValue += o.grandTotal;
        return {
          'Bill Number': o.billNumber,
          'Date & Time': new Date(o.createdAt).toLocaleString(),
          'Customer': o.customer?.name || (o as any).customerName || 'Walk-in',
          'Table': o.tableNumber || '-',
          'Grand Total (₹)': round2(o.grandTotal),
          'Order Status': o.status,
          'Reason / Note': (o as any).voidReason || (o as any).cancelReason || 'Cancelled by staff',
        };
      });
      return {
        recordCount: rows.length,
        totalGross: round2(totalVoidValue),
        totalDiscount: 0,
        totalNet: round2(totalVoidValue),
        totalTax: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'Bill Number', header: 'Bill #' },
          { key: 'Date & Time', header: 'Date & Time' },
          { key: 'Customer', header: 'Customer' },
          { key: 'Table', header: 'Table' },
          { key: 'Grand Total (₹)', header: 'Total (₹)', align: 'right' },
          { key: 'Order Status', header: 'Status' },
          { key: 'Reason / Note', header: 'Reason' },
        ],
      };
    }

    case 'product_sales': {
      const validOrders = dateFilteredOrders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'VOIDED');
      const itemMap = new Map<string, { name: string; variant: string; quantity: number; revenue: number }>();

      validOrders.forEach((o) => {
        o.items.forEach((item) => {
          const key = `${item.name}__${item.variantName || 'Regular'}`;
          const cur = itemMap.get(key) || { name: item.name, variant: item.variantName || 'Regular', quantity: 0, revenue: 0 };
          itemMap.set(key, {
            name: item.name,
            variant: item.variantName || 'Regular',
            quantity: cur.quantity + item.quantity,
            revenue: cur.revenue + item.lineTotal,
          });
        });
      });

      let totalQty = 0, totalRev = 0;
      const rows = Array.from(itemMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((it) => {
          totalQty += it.quantity;
          totalRev += it.revenue;
          return {
            'Item Name': it.name,
            'Variant': it.variant,
            'Quantity Sold': it.quantity,
            'Total Revenue (₹)': round2(it.revenue),
            'Avg Price (₹)': it.quantity > 0 ? round2(it.revenue / it.quantity) : 0,
          };
        });

      return {
        recordCount: rows.length,
        totalGross: round2(totalRev),
        totalDiscount: 0,
        totalNet: round2(totalRev),
        totalTax: 0,
        totalCollected: round2(totalRev),
        totalOutstanding: 0,
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'Item Name', header: 'Item Name' },
          { key: 'Variant', header: 'Variant' },
          { key: 'Quantity Sold', header: 'Qty Sold', align: 'center' },
          { key: 'Total Revenue (₹)', header: 'Revenue (₹)', align: 'right' },
          { key: 'Avg Price (₹)', header: 'Avg Price (₹)', align: 'right' },
        ],
      };
    }

    case 'category_sales': {
      const validOrders = dateFilteredOrders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'VOIDED');
      const catMap = new Map<string, { name: string; quantity: number; revenue: number }>();

      // Build item-to-category lookup
      const itemCatLookup = new Map<string, string>();
      data.menuItems.forEach((m) => {
        itemCatLookup.set(m.name.toLowerCase(), m.categoryName || 'General');
      });

      validOrders.forEach((o) => {
        o.items.forEach((item) => {
          const catName = itemCatLookup.get(item.name.toLowerCase()) || 'General';
          const cur = catMap.get(catName) || { name: catName, quantity: 0, revenue: 0 };
          catMap.set(catName, {
            name: catName,
            quantity: cur.quantity + item.quantity,
            revenue: cur.revenue + item.lineTotal,
          });
        });
      });

      let totalQty = 0, totalRev = 0;
      const rows = Array.from(catMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((c) => {
          totalQty += c.quantity;
          totalRev += c.revenue;
          return {
            'Category Name': c.name,
            'Total Quantity Sold': c.quantity,
            'Total Sales (₹)': round2(c.revenue),
            'Share of Revenue (%)': totalRev > 0 ? round2((c.revenue / totalRev) * 100) : 0,
          };
        });

      // Recalculate share accurately
      const sumRev = totalRev;
      rows.forEach((r: any) => {
        r['Share of Revenue (%)'] = sumRev > 0 ? round2((r['Total Sales (₹)'] / sumRev) * 100) : 0;
      });

      return {
        recordCount: rows.length,
        totalGross: round2(totalRev),
        totalDiscount: 0,
        totalNet: round2(totalRev),
        totalTax: 0,
        totalCollected: round2(totalRev),
        totalOutstanding: 0,
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'Category Name', header: 'Category' },
          { key: 'Total Quantity Sold', header: 'Qty Sold', align: 'center' },
          { key: 'Total Sales (₹)', header: 'Sales (₹)', align: 'right' },
          { key: 'Share of Revenue (%)', header: 'Share (%)', align: 'right' },
        ],
      };
    }

    case 'customer_orders': {
      // Aggregate by customer
      const custMap = new Map<string, { name: string; phone: string; visits: number; spend: number; lastVisit: string }>();

      data.customers.forEach((c) => {
        custMap.set(c.phone, {
          name: c.name,
          phone: c.phone,
          visits: c.totalOrders || 0,
          spend: c.totalSpent || 0,
          lastVisit: c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '-',
        });
      });

      // Add any phone from orders
      data.orders.forEach((o) => {
        const ph = o.customer?.phone || (o as any).customerPhone;
        const name = o.customer?.name || (o as any).customerName || 'Walk-in';
        if (ph && !custMap.has(ph)) {
          custMap.set(ph, {
            name,
            phone: ph,
            visits: 1,
            spend: o.grandTotal,
            lastVisit: new Date(o.createdAt).toLocaleDateString(),
          });
        }
      });

      let totalSpend = 0;
      const rows = Array.from(custMap.values())
        .sort((a, b) => b.spend - a.spend)
        .map((c) => {
          totalSpend += c.spend;
          return {
            'Customer Name': c.name,
            'Phone Number': c.phone,
            'Total Visits': c.visits,
            'Total Spend (₹)': round2(c.spend),
            'Avg Spend per Visit (₹)': c.visits > 0 ? round2(c.spend / c.visits) : 0,
            'Last Visit': c.lastVisit,
          };
        });

      return {
        recordCount: rows.length,
        totalGross: round2(totalSpend),
        totalDiscount: 0,
        totalNet: round2(totalSpend),
        totalTax: 0,
        totalCollected: round2(totalSpend),
        totalOutstanding: 0,
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'Customer Name', header: 'Name' },
          { key: 'Phone Number', header: 'Phone' },
          { key: 'Total Visits', header: 'Visits', align: 'center' },
          { key: 'Total Spend (₹)', header: 'Total Spend (₹)', align: 'right' },
          { key: 'Avg Spend per Visit (₹)', header: 'Avg Spend (₹)', align: 'right' },
          { key: 'Last Visit', header: 'Last Visit' },
        ],
      };
    }

    case 'inventory_stock': {
      let totalStockVal = 0;
      const rows = data.inventory.map((item) => {
        const stockVal = (item.currentStock || 0) * (item.purchasePrice || 0);
        totalStockVal += stockVal;
        return {
          'Material Name': item.name,
          'Category': item.category || 'Raw Material',
          'Current Stock': `${item.currentStock} ${item.unit}`,
          'Min Threshold': `${item.minimumStock} ${item.unit}`,
          'Cost Per Unit (₹)': round2(item.purchasePrice || 0),
          'Total Valuation (₹)': round2(stockVal),
          'Stock Status': item.stockStatus || (item.currentStock <= 0 ? 'OUT_OF_STOCK' : item.currentStock <= item.minimumStock ? 'LOW_STOCK' : 'IN_STOCK'),
        };
      });

      return {
        recordCount: rows.length,
        totalGross: round2(totalStockVal),
        totalDiscount: 0,
        totalNet: round2(totalStockVal),
        totalTax: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'Material Name', header: 'Material' },
          { key: 'Category', header: 'Category' },
          { key: 'Current Stock', header: 'Current Stock', align: 'center' },
          { key: 'Cost Per Unit (₹)', header: 'Unit Cost (₹)', align: 'right' },
          { key: 'Total Valuation (₹)', header: 'Valuation (₹)', align: 'right' },
          { key: 'Stock Status', header: 'Status' },
        ],
      };
    }

    case 'stock_movement': {
      const filtered = data.stockMovements.filter((m) => {
        const d = new Date(m.createdAt);
        return d >= from && d <= to;
      });

      const rows = filtered.map((m) => ({
        'Date & Time': new Date(m.createdAt).toLocaleString(),
        'Material Name': m.itemName,
        'Movement Type': m.type,
        'Quantity Changed': `${m.quantityChange > 0 ? '+' : ''}${m.quantityChange}`,
        'Previous Stock': `${m.previousStock}`,
        'New Stock': `${m.newStock}`,
        'Reason / Notes': m.reason || '-',
      }));

      return {
        recordCount: rows.length,
        totalGross: 0,
        totalDiscount: 0,
        totalNet: 0,
        totalTax: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'Date & Time', header: 'Date & Time' },
          { key: 'Material Name', header: 'Material' },
          { key: 'Movement Type', header: 'Type' },
          { key: 'Quantity Changed', header: 'Change', align: 'center' },
          { key: 'New Stock', header: 'New Stock', align: 'center' },
          { key: 'Reason / Notes', header: 'Reason' },
        ],
      };
    }

    case 'purchase_orders': {
      const filtered = data.purchaseOrders.filter((po) => {
        const d = new Date(po.createdAt);
        return d >= from && d <= to;
      });

      let totalPO = 0, totalPaid = 0, totalDue = 0;
      const rows = filtered.map((po) => {
        totalPO += po.totalAmount;
        totalPaid += po.amountPaid;
        totalDue += po.balanceDue;

        return {
          'PO Number': po.poNumber,
          'Date': new Date(po.createdAt).toLocaleDateString(),
          'Supplier Name': po.supplierName,
          'Total Amount (₹)': round2(po.totalAmount),
          'Amount Paid (₹)': round2(po.amountPaid),
          'Balance Due (₹)': round2(po.balanceDue),
          'Delivery Status': po.status,
          'Payment Status': po.paymentStatus,
        };
      });

      return {
        recordCount: rows.length,
        totalGross: round2(totalPO),
        totalDiscount: 0,
        totalNet: round2(totalPO),
        totalTax: 0,
        totalCollected: round2(totalPaid),
        totalOutstanding: round2(totalDue),
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'PO Number', header: 'PO #' },
          { key: 'Date', header: 'Date' },
          { key: 'Supplier Name', header: 'Supplier' },
          { key: 'Total Amount (₹)', header: 'Total (₹)', align: 'right' },
          { key: 'Amount Paid (₹)', header: 'Paid (₹)', align: 'right' },
          { key: 'Balance Due (₹)', header: 'Due (₹)', align: 'right' },
          { key: 'Delivery Status', header: 'Delivery' },
          { key: 'Payment Status', header: 'Payment' },
        ],
      };
    }

    case 'suppliers_list': {
      // Calculate financials from purchase orders
      const supFinancials = new Map<string, { purchases: number; paid: number; due: number }>();
      data.purchaseOrders.forEach((po) => {
        const cur = supFinancials.get(po.supplierId) || { purchases: 0, paid: 0, due: 0 };
        supFinancials.set(po.supplierId, {
          purchases: cur.purchases + po.totalAmount,
          paid: cur.paid + po.amountPaid,
          due: cur.due + po.balanceDue,
        });
      });

      let totalPurchases = 0, totalPaid = 0, totalDue = 0;
      const rows = data.suppliers.map((s) => {
        const fin = supFinancials.get(s.id) || { purchases: 0, paid: 0, due: 0 };
        totalPurchases += fin.purchases;
        totalPaid += fin.paid;
        totalDue += fin.due;

        return {
          'Company Name': s.companyName,
          'Contact Person': s.name || '-',
          'Phone': s.mobile || s.whatsapp || '-',
          'GST Number': s.gstin || '-',
          'Total Purchases (₹)': round2(fin.purchases),
          'Total Paid (₹)': round2(fin.paid),
          'Outstanding Payable (₹)': round2(fin.due),
          'Status': s.isArchived ? 'Archived' : 'Active',
        };
      });

      return {
        recordCount: rows.length,
        totalGross: round2(totalPurchases),
        totalDiscount: 0,
        totalNet: round2(totalPurchases),
        totalTax: 0,
        totalCollected: round2(totalPaid),
        totalOutstanding: round2(totalDue),
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'Company Name', header: 'Supplier' },
          { key: 'Contact Person', header: 'Contact Person' },
          { key: 'Phone', header: 'Phone' },
          { key: 'Total Purchases (₹)', header: 'Purchases (₹)', align: 'right' },
          { key: 'Total Paid (₹)', header: 'Paid (₹)', align: 'right' },
          { key: 'Outstanding Payable (₹)', header: 'Due (₹)', align: 'right' },
          { key: 'Status', header: 'Status' },
        ],
      };
    }

    case 'expenses': {
      const filtered = data.expenses.filter((e) => {
        const d = new Date(e.date || e.createdAt);
        return d >= from && d <= to;
      });

      let totalExpense = 0, cashExp = 0, digitalExp = 0;
      const rows = filtered.map((e) => {
        totalExpense += e.amount;
        if (e.paymentMethod === 'CASH') cashExp += e.amount;
        else digitalExp += e.amount;

        return {
          'Date': new Date(e.date || e.createdAt).toLocaleDateString(),
          'Title / Description': e.description || e.category,
          'Category': e.category,
          'Amount (₹)': round2(e.amount),
          'Payment Mode': e.paymentMethod,
          'Recorded By': e.createdBy || 'Owner',
          'Receipt Attached': e.isVoided ? 'Voided' : 'Valid',
        };
      });

      return {
        recordCount: rows.length,
        totalGross: round2(totalExpense),
        totalDiscount: 0,
        totalNet: round2(totalExpense),
        totalTax: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        cashCollection: round2(cashExp),
        upiCollection: round2(digitalExp),
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'Date', header: 'Date' },
          { key: 'Title / Description', header: 'Title' },
          { key: 'Category', header: 'Category' },
          { key: 'Amount (₹)', header: 'Amount (₹)', align: 'right' },
          { key: 'Payment Mode', header: 'Mode' },
          { key: 'Recorded By', header: 'Recorded By' },
        ],
      };
    }

    case 'tax_gst': {
      const validOrders = dateFilteredOrders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'VOIDED' && o.gstAmount > 0);
      let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalTax = 0;

      const rows = validOrders.map((o) => {
        const taxable = o.subtotal - o.discountAmount;
        const halfGst = round2(o.gstAmount / 2);
        totalTaxable += taxable;
        totalCGST += halfGst;
        totalSGST += halfGst;
        totalTax += o.gstAmount;

        return {
          'Bill Number': o.billNumber,
          'Date': new Date(o.createdAt).toLocaleDateString(),
          'Customer': o.customer?.name || (o as any).customerName || 'Walk-in',
          'Taxable Value (₹)': round2(taxable),
          'CGST (₹)': halfGst,
          'SGST (₹)': halfGst,
          'Total GST (₹)': round2(o.gstAmount),
          'Invoice Total (₹)': round2(o.grandTotal),
        };
      });

      return {
        recordCount: rows.length,
        totalGross: round2(totalTaxable),
        totalDiscount: 0,
        totalNet: round2(totalTaxable + totalTax),
        totalTax: round2(totalTax),
        totalCollected: 0,
        totalOutstanding: 0,
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows,
        columns: [
          { key: 'Bill Number', header: 'Bill #' },
          { key: 'Date', header: 'Date' },
          { key: 'Customer', header: 'Customer' },
          { key: 'Taxable Value (₹)', header: 'Taxable (₹)', align: 'right' },
          { key: 'CGST (₹)', header: 'CGST (₹)', align: 'right' },
          { key: 'SGST (₹)', header: 'SGST (₹)', align: 'right' },
          { key: 'Total GST (₹)', header: 'Total GST (₹)', align: 'right' },
          { key: 'Invoice Total (₹)', header: 'Total (₹)', align: 'right' },
        ],
      };
    }

    default:
      return {
        recordCount: 0,
        totalGross: 0,
        totalDiscount: 0,
        totalNet: 0,
        totalTax: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        otherCollection: 0,
        rows: [],
        columns: [],
      };
  }
}

/**
 * Trigger file download helper
 */
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * EXCEL (.XLSX) EXPORT
 */
export function exportToExcel(
  summary: ComputedReportSummary,
  reportTitle: string,
  businessName: string,
  dateLabel: string
): void {
  const wb = XLSX.utils.book_new();

  // Create custom worksheet with business details and headers
  const headerData = [
    [businessName],
    [`Report: ${reportTitle}`],
    [`Period: ${dateLabel}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Total Records: ${summary.recordCount}`],
    [], // Blank row
  ];

  const ws = XLSX.utils.aoa_to_sheet(headerData);

  // Append table rows
  if (summary.rows.length > 0) {
    XLSX.utils.sheet_add_json(ws, summary.rows, { origin: 'A7', skipHeader: false });
  }

  // Set column widths based on longest string in each column
  const cols = summary.columns.map((c) => ({ wch: Math.max(c.header.length + 4, 15) }));
  ws['!cols'] = cols;

  XLSX.utils.book_append_sheet(wb, ws, 'Report Data');

  // Convert to binary array and trigger download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadFile(blob, filename);
}

/**
 * PDF EXPORT
 */
export function exportToPDF(
  summary: ComputedReportSummary,
  reportTitle: string,
  businessName: string,
  dateLabel: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 18;

  // Header Banner with Brand Dark Green
  doc.setFillColor(20, 92, 67); // #145C43
  doc.rect(14, y, 182, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(businessName, 20, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(234, 245, 239); // Light green text
  doc.text(`${reportTitle} • ${dateLabel}`, 20, y + 16);

  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 190, y + 16, { align: 'right' });

  y += 28;

  // Key Figures Summary Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(32, 41, 35);
  doc.text('Key Summary Metrics', 14, y);
  y += 4;

  const summaryMetrics: string[][] = [
    ['Total Records', summary.recordCount.toString()],
    ['Primary Amount / Net Total', `₹ ${summary.totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Total Collected', `₹ ${summary.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    ['Outstanding Due / Balance', `₹ ${summary.totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
  ];

  if (summary.cashCollection > 0 || summary.upiCollection > 0) {
    summaryMetrics.push([
      'Payment Distribution',
      `Cash: ₹${summary.cashCollection} | UPI: ₹${summary.upiCollection} | Card: ₹${summary.cardCollection}`,
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: summaryMetrics,
    theme: 'grid',
    headStyles: { fillColor: [20, 92, 67], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Detail Data Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(32, 41, 35);
  doc.text('Detailed Report Breakdown', 14, y);
  y += 4;

  if (summary.rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(104, 115, 109);
    doc.text('No matching records found for this period.', 14, y + 4);
  } else {
    // Limit to visible columns if too wide for portrait
    const headers = summary.columns.map((c) => c.header);
    const body = summary.rows.map((row) => summary.columns.map((c) => String(row[c.key] ?? '')));

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [20, 92, 67], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [247, 249, 247] },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Page number footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(146, 155, 149);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 8,
          { align: 'center' }
        );
      },
    });
  }

  const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

/**
 * CSV EXPORT
 */
export function exportToCSV(
  summary: ComputedReportSummary,
  reportTitle: string,
  businessName: string,
  dateLabel: string
): void {
  const lines: string[] = [];

  // Metadata headers
  lines.push(`"${businessName.replace(/"/g, '""')}"`);
  lines.push(`"Report: ${reportTitle.replace(/"/g, '""')}"`);
  lines.push(`"Period: ${dateLabel.replace(/"/g, '""')}"`);
  lines.push(`"Generated: ${new Date().toLocaleString()}"`);
  lines.push(`"Total Records",${summary.recordCount}`);
  lines.push(`"Net Amount",${summary.totalNet}`);
  lines.push(`"Total Collected",${summary.totalCollected}`);
  lines.push(`"Outstanding Due",${summary.totalOutstanding}`);
  lines.push('');

  // Table header
  if (summary.columns.length > 0) {
    lines.push(summary.columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(','));
  }

  // Table rows
  summary.rows.forEach((row) => {
    const rowVals = summary.columns.map((c) => {
      const val = row[c.key] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    lines.push(rowVals.join(','));
  });

  // UTF-8 BOM ensures Excel displays UTF-8 correctly
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(blob, filename);
}

/**
 * JSON EXPORT
 */
export function exportToJSON(
  summary: ComputedReportSummary,
  reportTitle: string,
  businessName: string,
  dateLabel: string
): void {
  const exportObject = {
    businessName,
    reportTitle,
    datePeriod: dateLabel,
    generatedAt: new Date().toISOString(),
    summaryMetrics: {
      recordCount: summary.recordCount,
      totalNet: summary.totalNet,
      totalGross: summary.totalGross,
      totalDiscount: summary.totalDiscount,
      totalTax: summary.totalTax,
      totalCollected: summary.totalCollected,
      totalOutstanding: summary.totalOutstanding,
      cashCollection: summary.cashCollection,
      upiCollection: summary.upiCollection,
      cardCollection: summary.cardCollection,
      otherCollection: summary.otherCollection,
    },
    records: summary.rows,
  };

  const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json;charset=utf-8;' });
  const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
  downloadFile(blob, filename);
}
