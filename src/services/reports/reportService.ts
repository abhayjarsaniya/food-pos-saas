import { Order } from '../../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { round2 } from '../../utils/calculations';

export type DateFilterType = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export interface BestSellerItem {
  name: string;
  quantity: number;
  salesValue: number;
}

export interface ReportSummary {
  totalOrders: number;
  grossSales: number;
  totalDiscounts: number;
  taxCollected: number;
  netSales: number;
  averageOrderValue: number;
  cashCollection: number;
  upiCollection: number;
  cardCollection: number;
  otherCollection: number;
  totalCollected: number;
  outstandingAmount: number;
  bestSellers: BestSellerItem[];
  dailyBreakdown: { date: string; sales: number; orders: number }[];
  paymentDistribution: { method: string; amount: number; percentage: number }[];
}

/**
 * Filter orders by date range
 */
export function filterOrdersByDate(
  orders: Order[],
  filterType: DateFilterType,
  customStart?: Date,
  customEnd?: Date
): Order[] {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  let from = startOfDay(now);
  let to = endOfDay(now);

  if (filterType === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    from = startOfDay(yesterday);
    to = endOfDay(yesterday);
  } else if (filterType === 'this_week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    from = startOfDay(new Date(now.setDate(diff)));
    to = endOfDay(new Date());
  } else if (filterType === 'this_month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    to = endOfDay(new Date());
  } else if (filterType === 'custom' && customStart && customEnd) {
    from = startOfDay(customStart);
    to = endOfDay(customEnd);
  }

  return orders.filter((o) => {
    // Only valid non-voided/cancelled orders count towards financial reports
    if (o.status === 'VOIDED' || o.status === 'CANCELLED') return false;
    const orderDate = new Date(o.createdAt);
    return orderDate >= from && orderDate <= to;
  });
}

/**
 * Computes financial metrics for reports strictly distinguishing Sales, Collections, and Outstanding
 */
export function generateReportSummary(orders: Order[]): ReportSummary {
  // Filter out voided and cancelled orders strictly
  const validOrders = orders.filter((o) => o.status !== 'VOIDED' && o.status !== 'CANCELLED');

  let grossSales = 0;
  let totalDiscounts = 0;
  let taxCollected = 0;
  let netSales = 0;
  let cashCollection = 0;
  let upiCollection = 0;
  let cardCollection = 0;
  let otherCollection = 0;
  let outstandingAmount = 0;

  const itemMap = new Map<string, { quantity: number; salesValue: number }>();
  const dailyMap = new Map<string, { sales: number; orders: number }>();

  validOrders.forEach((o) => {
    grossSales += (o.subtotal - o.discountAmount);
    totalDiscounts += o.discountAmount;
    taxCollected += o.gstAmount;
    netSales += o.grandTotal;
    outstandingAmount += (o.balanceDue || 0);

    // If individual payment records exist, tally each payment by its specific method
    if (o.payments && o.payments.length > 0) {
      o.payments.forEach((p) => {
        if (p.paymentMethod === 'CASH') cashCollection += p.amount;
        else if (p.paymentMethod === 'UPI') upiCollection += p.amount;
        else if (p.paymentMethod === 'CARD') cardCollection += p.amount;
        else otherCollection += p.amount;
      });
    } else {
      // Fallback to order-level recorded collected amount
      const collected = o.amountPaid || (o.paymentStatus === 'PAID' ? o.grandTotal : 0);
      if (collected > 0) {
        if (o.paymentMethod === 'CASH') cashCollection += collected;
        else if (o.paymentMethod === 'UPI') upiCollection += collected;
        else if (o.paymentMethod === 'CARD') cardCollection += collected;
        else otherCollection += collected;
      }
    }

    // Best-selling items tally
    o.items.forEach((item) => {
      const existing = itemMap.get(item.name) || { quantity: 0, salesValue: 0 };
      itemMap.set(item.name, {
        quantity: existing.quantity + item.quantity,
        salesValue: existing.salesValue + item.lineTotal,
      });
    });

    // Daily breakdown tally
    const dateKey = o.createdAt.split('T')[0];
    const dayStats = dailyMap.get(dateKey) || { sales: 0, orders: 0 };
    dailyMap.set(dateKey, {
      sales: dayStats.sales + o.grandTotal,
      orders: dayStats.orders + 1,
    });
  });

  const totalOrders = validOrders.length;
  const averageOrderValue = totalOrders > 0 ? round2(netSales / totalOrders) : 0;
  const totalCollected = round2(cashCollection + upiCollection + cardCollection + otherCollection);

  // Best sellers sorted descending
  const bestSellers: BestSellerItem[] = Array.from(itemMap.entries())
    .map(([name, data]) => ({
      name,
      quantity: data.quantity,
      salesValue: round2(data.salesValue),
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Daily breakdown sorted chronological
  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      sales: round2(data.sales),
      orders: data.orders,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Payment distribution
  const paymentDistribution = [
    { method: 'UPI', amount: round2(upiCollection), percentage: totalCollected > 0 ? round2((upiCollection / totalCollected) * 100) : 0 },
    { method: 'Cash', amount: round2(cashCollection), percentage: totalCollected > 0 ? round2((cashCollection / totalCollected) * 100) : 0 },
    { method: 'Card', amount: round2(cardCollection), percentage: totalCollected > 0 ? round2((cardCollection / totalCollected) * 100) : 0 },
    { method: 'Other', amount: round2(otherCollection), percentage: totalCollected > 0 ? round2((otherCollection / totalCollected) * 100) : 0 },
  ];

  return {
    totalOrders,
    grossSales: round2(grossSales),
    totalDiscounts: round2(totalDiscounts),
    taxCollected: round2(taxCollected),
    netSales: round2(netSales),
    averageOrderValue,
    cashCollection: round2(cashCollection),
    upiCollection: round2(upiCollection),
    cardCollection: round2(cardCollection),
    otherCollection: round2(otherCollection),
    totalCollected,
    outstandingAmount: round2(outstandingAmount),
    bestSellers,
    dailyBreakdown,
    paymentDistribution,
  };
}

/**
 * Export report as CSV
 */
export function exportReportToCSV(summary: ReportSummary, title: string): void {
  const lines: string[] = [];

  lines.push(`"${title}"`);
  lines.push(`"Generated On","${new Date().toLocaleString()}"`);
  lines.push('');
  lines.push('"Key Metric","Value"');
  lines.push(`"Total Orders",${summary.totalOrders}`);
  lines.push(`"Net Sales (Rs.)",${summary.netSales}`);
  lines.push(`"Gross Sales (Rs.)",${summary.grossSales}`);
  lines.push(`"Tax Collected (Rs.)",${summary.taxCollected}`);
  lines.push(`"Discounts Given (Rs.)",${summary.totalDiscounts}`);
  lines.push(`"Average Order Value (Rs.)",${summary.averageOrderValue}`);
  lines.push(`"Cash Collected (Rs.)",${summary.cashCollection}`);
  lines.push(`"UPI Collected (Rs.)",${summary.upiCollection}`);
  lines.push(`"Card Collected (Rs.)",${summary.cardCollection}`);
  lines.push(`"Other Collected (Rs.)",${summary.otherCollection}`);
  lines.push(`"Outstanding Balance (Rs.)",${summary.outstandingAmount}`);
  lines.push('');
  lines.push('"Best Selling Items"');
  lines.push('"Item Name","Quantity Sold","Sales Value (Rs.)"');

  summary.bestSellers.forEach((item) => {
    lines.push(`"${item.name.replace(/"/g, '""')}",${item.quantity},${item.salesValue}`);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Revenue_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export report as PDF
 */
export function exportReportToPDF(summary: ReportSummary, title: string, businessName: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(businessName, 20, y);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 20, y + 7);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 190, y + 7, { align: 'right' });
  y += 18;

  // Key figures table
  const metrics = [
    ['Total Orders', summary.totalOrders.toString()],
    ['Net Sales', `Rs. ${summary.netSales.toFixed(2)}`],
    ['Tax Collected', `Rs. ${summary.taxCollected.toFixed(2)}`],
    ['Discounts Given', `Rs. ${summary.totalDiscounts.toFixed(2)}`],
    ['Average Order Value', `Rs. ${summary.averageOrderValue.toFixed(2)}`],
    ['Cash Collection', `Rs. ${summary.cashCollection.toFixed(2)}`],
    ['UPI Collection', `Rs. ${summary.upiCollection.toFixed(2)}`],
    ['Card Collection', `Rs. ${summary.cardCollection.toFixed(2)}`],
    ['Outstanding Balance', `Rs. ${summary.outstandingAmount.toFixed(2)}`],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Financial Metric', 'Amount']],
    body: metrics,
    theme: 'grid',
    headStyles: { fillColor: [24, 24, 27] },
    styles: { fontSize: 9 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Best sellers table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Top Selling Menu Items', 20, y);
  y += 4;

  const bRows = summary.bestSellers.map((b) => [b.name, b.quantity.toString(), `Rs. ${b.salesValue.toFixed(2)}`]);

  autoTable(doc, {
    startY: y,
    head: [['Item Name', 'Qty Sold', 'Total Revenue']],
    body: bRows,
    theme: 'striped',
    headStyles: { fillColor: [24, 24, 27] },
    styles: { fontSize: 9 },
  });

  doc.save(`Revenue_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}
