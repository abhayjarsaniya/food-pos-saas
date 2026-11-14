import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BusinessProfile, BusinessSettings, Order, ReceiptFormat } from '../../types';

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Generate PDF instance for A4, Compact 80mm, or Compact 58mm
 */
export function generateReceiptPdf(
  order: Order,
  profile: BusinessProfile,
  settings: BusinessSettings,
  formatOverride?: ReceiptFormat
): jsPDF {
  const format = formatOverride || settings.receipt?.defaultFormat || 'compact80';

  if (format === 'compact58') {
    return generateCompact58Pdf(order, profile, settings);
  } else if (format === 'compact80') {
    return generateCompact80Pdf(order, profile, settings);
  } else {
    return generateA4Pdf(order, profile, settings);
  }
}

/**
 * Generate 80mm thermal receipt PDF
 */
function generateCompact80Pdf(
  order: Order,
  profile: BusinessProfile,
  settings: BusinessSettings
): jsPDF {
  const extrasCount = order.extras?.length || 0;
  const baseHeight = 170;
  const itemsHeight = (order.items.length + extrasCount) * 11;
  const totalHeight = Math.max(190, baseHeight + itemsHeight);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, totalHeight],
  });

  const pageWidth = 80;
  let y = 8;

  // Header - Business Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(profile.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  if (settings.receipt?.showAddress && profile.address) {
    const splitAddr = doc.splitTextToSize(profile.address, 70);
    doc.text(splitAddr, pageWidth / 2, y, { align: 'center' });
    y += splitAddr.length * 4;
  }

  if (settings.receipt?.showPhone && profile.phone) {
    doc.text(`Phone: ${profile.phone}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  if (settings.receipt?.showGstin && order.taxConfigSnapshot.enabled && order.taxConfigSnapshot.gstin) {
    doc.text(`GSTIN: ${order.taxConfigSnapshot.gstin}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  // Divider
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, 75, y);
  y += 4;

  // Bill & Table Info
  doc.setFontSize(8);
  doc.text(`Bill No: ${order.billNumber}`, 5, y);
  doc.text(formatDateTime(order.createdAt), 75, y, { align: 'right' });
  y += 4;

  if (order.tableNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Table / Type: ${order.tableNumber}`, 5, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
  }

  if (order.customer?.name || order.customer?.phone) {
    const cust = [order.customer.name, order.customer.phone].filter(Boolean).join(' | ');
    doc.text(`Customer: ${cust}`, 5, y);
    y += 4;
  }

  // Divider
  doc.line(5, y, 75, y);
  y += 3;

  // Items & Extras Table
  const tableRows: string[][] = [];

  // 1. Regular items
  order.items.forEach((item) => {
    tableRows.push([
      `${item.name}\n${item.quantity} x Rs. ${item.unitPrice.toFixed(2)}`,
      `Rs. ${item.lineTotal.toFixed(2)}`,
    ]);
  });

  // 2. Custom extras
  if (order.extras && order.extras.length > 0) {
    order.extras.forEach((ext) => {
      tableRows.push([
        `[EXTRA] ${ext.name}\n${ext.quantity} x Rs. ${ext.unitPrice.toFixed(2)}`,
        `Rs. ${ext.lineTotal.toFixed(2)}`,
      ]);
    });
  }

  autoTable(doc, {
    startY: y,
    margin: { left: 5, right: 5 },
    body: tableRows,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      textColor: [20, 20, 20],
    },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 22, halign: 'right' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // Divider
  doc.line(5, y, 75, y);
  y += 4;

  // Financial calculations
  const printRow = (label: string, value: string, isBold = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(label, 5, y);
    doc.text(value, 75, y, { align: 'right' });
    y += 4;
  };

  printRow('Subtotal:', `Rs. ${order.subtotal.toFixed(2)}`);

  if (order.discountAmount > 0) {
    printRow('Discount:', `- Rs. ${order.discountAmount.toFixed(2)}`);
  }

  if (order.taxConfigSnapshot.enabled && order.gstAmount > 0) {
    printRow('Taxable Amount:', `Rs. ${order.taxableAmount.toFixed(2)}`);
    if (order.taxConfigSnapshot.isInterState) {
      printRow('IGST:', `Rs. ${order.igstAmount.toFixed(2)}`);
    } else {
      printRow('CGST:', `Rs. ${order.cgstAmount.toFixed(2)}`);
      printRow('SGST:', `Rs. ${order.sgstAmount.toFixed(2)}`);
    }
  }

  // Grand Total Box
  doc.setLineDashPattern([], 0);
  doc.line(5, y, 75, y);
  y += 4;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL:', 5, y);
  doc.text(`Rs. ${order.grandTotal.toFixed(2)}`, 75, y, { align: 'right' });
  y += 5;
  doc.line(5, y, 75, y);
  y += 4;

  // PROMINENT PAYMENT STATUS BANNER
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  if (order.paymentStatus === 'UNPAID') {
    doc.rect(5, y - 1, 70, 11);
    doc.text('*** PAYMENT PENDING ***', pageWidth / 2, y + 3, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Amount Due: Rs. ${order.balanceDue.toFixed(2)}`, pageWidth / 2, y + 7, { align: 'center' });
    y += 14;
  } else if (order.paymentStatus === 'PARTIAL' || order.paymentStatus === 'PARTIALLY_PAID') {
    doc.rect(5, y - 1, 70, 13);
    doc.text('*** PARTIALLY PAID ***', pageWidth / 2, y + 3, { align: 'center' });
    doc.setFontSize(7.5);
    doc.text(`Received: Rs. ${order.amountPaid.toFixed(2)} | Due: Rs. ${order.balanceDue.toFixed(2)}`, pageWidth / 2, y + 8, { align: 'center' });
    y += 16;
  } else {
    doc.rect(5, y - 1, 70, 10);
    doc.text('*** PAID ***', pageWidth / 2, y + 3, { align: 'center' });
    doc.setFontSize(7.5);
    doc.text(`Method: ${order.paymentMethod} - Received Full`, pageWidth / 2, y + 7, { align: 'center' });
    y += 13;
  }

  // Footer message
  if (settings.receipt?.footerMessage) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    const splitFooter = doc.splitTextToSize(settings.receipt.footerMessage, 70);
    doc.text(splitFooter, pageWidth / 2, y, { align: 'center' });
  }

  return doc;
}

/**
 * Generate 58mm thermal receipt PDF
 */
function generateCompact58Pdf(
  order: Order,
  profile: BusinessProfile,
  settings: BusinessSettings
): jsPDF {
  const extrasCount = order.extras?.length || 0;
  const baseHeight = 160;
  const itemsHeight = (order.items.length + extrasCount) * 11;
  const totalHeight = Math.max(180, baseHeight + itemsHeight);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [58, totalHeight],
  });

  const pageWidth = 58;
  let y = 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(profile.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (profile.phone) {
    doc.text(`Ph: ${profile.phone}`, pageWidth / 2, y, { align: 'center' });
    y += 3.5;
  }

  doc.setLineDashPattern([1, 1], 0);
  doc.line(3, y, 55, y);
  y += 3;

  doc.text(`Bill: ${order.billNumber}`, 3, y);
  if (order.tableNumber) {
    doc.text(`Tbl: ${order.tableNumber}`, 55, y, { align: 'right' });
  }
  y += 3.5;
  doc.text(formatDateTime(order.createdAt), 3, y);
  y += 3.5;

  doc.line(3, y, 55, y);
  y += 2.5;

  const tableRows: string[][] = [];
  order.items.forEach((item) => {
    tableRows.push([`${item.name} (${item.quantity}x${item.unitPrice})`, `${item.lineTotal.toFixed(2)}`]);
  });
  order.extras?.forEach((ext) => {
    tableRows.push([`+ ${ext.name} (${ext.quantity}x${ext.unitPrice})`, `${ext.lineTotal.toFixed(2)}`]);
  });

  autoTable(doc, {
    startY: y,
    margin: { left: 3, right: 3 },
    body: tableRows,
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 1, textColor: [20, 20, 20] },
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 16, halign: 'right' } },
  });

  y = (doc as any).lastAutoTable.finalY + 2;
  doc.line(3, y, 55, y);
  y += 3.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TOTAL:', 3, y);
  doc.text(`Rs. ${order.grandTotal.toFixed(2)}`, 55, y, { align: 'right' });
  y += 4.5;

  // Prominent Status
  doc.rect(3, y - 1, 52, 9);
  if (order.paymentStatus === 'UNPAID') {
    doc.text('PAYMENT PENDING', pageWidth / 2, y + 3, { align: 'center' });
    doc.setFontSize(6.5);
    doc.text(`Due: Rs. ${order.balanceDue.toFixed(2)}`, pageWidth / 2, y + 6.5, { align: 'center' });
  } else if (order.paymentStatus === 'PARTIAL' || order.paymentStatus === 'PARTIALLY_PAID') {
    doc.text('PARTIALLY PAID', pageWidth / 2, y + 3, { align: 'center' });
    doc.setFontSize(6.5);
    doc.text(`Bal Due: Rs. ${order.balanceDue.toFixed(2)}`, pageWidth / 2, y + 6.5, { align: 'center' });
  } else {
    doc.text('PAID', pageWidth / 2, y + 4, { align: 'center' });
  }
  y += 12;

  if (settings.receipt?.footerMessage) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.text(settings.receipt.footerMessage, pageWidth / 2, y, { align: 'center' });
  }

  return doc;
}

/**
 * Generate A4 Tax Invoice PDF
 */
function generateA4Pdf(
  order: Order,
  profile: BusinessProfile,
  settings: BusinessSettings
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  let y = 15;

  // Tax Invoice Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TAX INVOICE', pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Seller Details
  doc.setFontSize(12);
  doc.text(profile.name.toUpperCase(), 14, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (profile.address) {
    doc.text(profile.address, 14, y);
    y += 4.5;
  }
  if (profile.phone) {
    doc.text(`Phone: ${profile.phone}`, 14, y);
    y += 4.5;
  }
  if (order.taxConfigSnapshot.enabled && order.taxConfigSnapshot.gstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${order.taxConfigSnapshot.gstin}`, 14, y);
    doc.setFont('helvetica', 'normal');
    y += 4.5;
  }

  // Invoice Meta Box
  const metaY = 23;
  doc.rect(130, metaY, 66, 32);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice No: ${order.billNumber}`, 134, metaY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDateTime(order.createdAt)}`, 134, metaY + 12);
  if (order.tableNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Table / Order: ${order.tableNumber}`, 134, metaY + 18);
    doc.setFont('helvetica', 'normal');
  }
  doc.text(`Payment: ${order.paymentMethod}`, 134, metaY + 24);

  // Status Badge in Meta Box
  const statusLabel = order.paymentStatus === 'UNPAID' 
    ? 'PAYMENT PENDING' 
    : order.paymentStatus === 'PARTIAL' || order.paymentStatus === 'PARTIALLY_PAID'
    ? 'PARTIALLY PAID' 
    : 'PAID';
  doc.setFont('helvetica', 'bold');
  doc.text(`Status: ${statusLabel}`, 134, metaY + 29);

  y = Math.max(y + 4, metaY + 36);

  // Customer Section
  if (order.customer?.name || order.customer?.phone) {
    doc.rect(14, y, 182, 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Billed To Customer:', 18, y + 5);
    doc.setFont('helvetica', 'normal');
    const cust = [order.customer.name, order.customer.phone].filter(Boolean).join(' | Phone: ');
    doc.text(cust, 56, y + 5);
    y += 16;
  }

  // Items Table
  const tableRows: any[][] = [];
  let sNo = 1;

  order.items.forEach((item) => {
    tableRows.push([
      sNo++,
      item.name,
      item.quantity,
      item.unitPrice.toFixed(2),
      order.taxConfigSnapshot.enabled ? `${item.gstRate}%` : '0%',
      item.lineTotal.toFixed(2),
    ]);
  });

  order.extras?.forEach((ext) => {
    tableRows.push([
      sNo++,
      `[Extra] ${ext.name}`,
      ext.quantity,
      ext.unitPrice.toFixed(2),
      order.taxConfigSnapshot.enabled ? `${ext.gstRate || 5}%` : '0%',
      ext.lineTotal.toFixed(2),
    ]);
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Item Description', 'Qty', 'Unit Price', 'GST Rate', 'Amount (INR)']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 82 },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 30, halign: 'right' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Totals Box
  const summaryX = 120;
  const summaryWidth = 76;
  doc.rect(summaryX, y, summaryWidth, 42);

  const printSummaryRow = (lbl: string, val: string, isBold = false, offset: number) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 9.5 : 8.5);
    doc.text(lbl, summaryX + 4, y + offset);
    doc.text(val, summaryX + summaryWidth - 4, y + offset, { align: 'right' });
  };

  printSummaryRow('Subtotal:', `Rs. ${order.subtotal.toFixed(2)}`, false, 6);
  printSummaryRow('Discount:', `- Rs. ${order.discountAmount.toFixed(2)}`, false, 12);
  printSummaryRow('Taxable Amount:', `Rs. ${order.taxableAmount.toFixed(2)}`, false, 18);
  printSummaryRow('GST Amount:', `Rs. ${order.gstAmount.toFixed(2)}`, false, 24);
  printSummaryRow('Grand Total:', `Rs. ${order.grandTotal.toFixed(2)}`, true, 31);
  printSummaryRow('Balance Due:', `Rs. ${order.balanceDue.toFixed(2)}`, true, 38);

  y += 50;

  // Prominent Payment Box
  doc.rect(14, y, 182, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  if (order.paymentStatus === 'UNPAID') {
    doc.text('PAYMENT STATUS: PAYMENT PENDING (UNPAID)', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Outstanding Balance Due: Rs. ${order.balanceDue.toFixed(2)}`, 18, y + 11);
  } else if (order.paymentStatus === 'PARTIAL' || order.paymentStatus === 'PARTIALLY_PAID') {
    doc.text('PAYMENT STATUS: PARTIALLY PAID', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Received: Rs. ${order.amountPaid.toFixed(2)} | Remaining Balance Due: Rs. ${order.balanceDue.toFixed(2)}`, 18, y + 11);
  } else {
    doc.text('PAYMENT STATUS: PAID IN FULL', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Payment Method: ${order.paymentMethod} | Amount Received: Rs. ${order.amountPaid.toFixed(2)}`, 18, y + 11);
  }

  y += 24;

  if (settings.receipt?.footerMessage) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(settings.receipt.footerMessage, pageWidth / 2, y, { align: 'center' });
  }

  return doc;
}

export function downloadReceiptPdf(
  order: Order,
  profile: BusinessProfile,
  settings: BusinessSettings,
  format?: ReceiptFormat
): void {
  const doc = generateReceiptPdf(order, profile, settings, format);
  doc.save(`${order.billNumber}.pdf`);
}

export function getReceiptPdfBlob(
  order: Order,
  profile: BusinessProfile,
  settings: BusinessSettings,
  format?: ReceiptFormat
): Blob {
  const doc = generateReceiptPdf(order, profile, settings, format);
  return doc.output('blob');
}
