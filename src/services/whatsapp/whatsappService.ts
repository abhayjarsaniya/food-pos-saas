import { BusinessProfile, BusinessSettings, Order } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { downloadReceiptPdf, formatDateTime, getReceiptPdfBlob } from '../pdf/receiptGenerator';

/**
 * Standardize phone number for WhatsApp wa.me links
 * Default +91 for Indian 10-digit mobile numbers
 */
export function formatWhatsAppPhone(phone?: string): string {
  if (!phone) return '';
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }
  return cleaned;
}

/**
 * Builds the WhatsApp message template distinguishing Paid, Partial, and Unpaid bills
 */
export function buildWhatsAppMessage(order: Order, profile: BusinessProfile): string {
  const itemsText = order.items
    .map((item) => `• ${item.name} × ${item.quantity} – ${formatCurrency(item.lineTotal)}`)
    .join('\n');

  const extrasText = order.extras && order.extras.length > 0
    ? '\n' + order.extras.map((ext) => `• [Extra] ${ext.name} × ${ext.quantity} – ${formatCurrency(ext.lineTotal)}`).join('\n')
    : '';

  const tableLine = order.tableNumber ? `Table: *${order.tableNumber}*\n` : '';

  const discountLine = order.discountAmount > 0 
    ? `Discount: -${formatCurrency(order.discountAmount)}\n` 
    : '';

  const gstLine = order.taxConfigSnapshot.enabled && order.gstAmount > 0
    ? `GST: ${formatCurrency(order.gstAmount)}\n`
    : '';

  // Payment Status Block
  let paymentBlock = '';
  if (order.paymentStatus === 'UNPAID') {
    paymentBlock = `*STATUS: PAYMENT PENDING (UNPAID)*
*Amount Due: ${formatCurrency(order.balanceDue)}*`;
  } else if (order.paymentStatus === 'PARTIAL' || order.paymentStatus === 'PARTIALLY_PAID') {
    paymentBlock = `*STATUS: PARTIALLY PAID*
*Amount Received: ${formatCurrency(order.amountPaid)}*
*Remaining Balance: ${formatCurrency(order.balanceDue)}*`;
  } else {
    paymentBlock = `*STATUS: PAID IN FULL (${order.paymentMethod})*
*Amount Received: ${formatCurrency(order.amountPaid || order.grandTotal)}*`;
  }

  return `Hello!

Thank you for visiting *${profile.name}*.

*Your bill summary:*
Bill No: *${order.billNumber}*
${tableLine}Date: ${formatDateTime(order.createdAt)}

${itemsText}${extrasText}

Subtotal: ${formatCurrency(order.subtotal)}
${discountLine}${gstLine}*Grand Total: ${formatCurrency(order.grandTotal)}*

${paymentBlock}

Thank you for dining with us!`;
}

export interface ShareResult {
  sharedViaWebShare: boolean;
  openedWhatsAppChat: boolean;
  pdfDownloaded: boolean;
  message: string;
}

/**
 * Executes the WhatsApp share flow with native PDF file sharing and fallback
 */
export async function shareBillToWhatsApp(
  order: Order,
  profile: BusinessProfile,
  settings: BusinessSettings
): Promise<ShareResult> {
  const messageText = buildWhatsAppMessage(order, profile);
  const pdfBlob = getReceiptPdfBlob(order, profile, settings);
  const filename = `${order.billNumber}.pdf`;
  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

  // 1. Check if Web Share API with files is supported
  const canShareFiles = 
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [pdfFile] });

  if (canShareFiles) {
    try {
      await navigator.share({
        title: `Bill ${order.billNumber} - ${profile.name}`,
        text: messageText,
        files: [pdfFile],
      });
      return {
        sharedViaWebShare: true,
        openedWhatsAppChat: false,
        pdfDownloaded: false,
        message: 'Receipt shared successfully via native share sheet!',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          sharedViaWebShare: false,
          openedWhatsAppChat: false,
          pdfDownloaded: false,
          message: 'Share cancelled by user.',
        };
      }
      console.warn('Native file share failed, falling back to download + WhatsApp link:', err);
    }
  }

  // 2. Fallback: Download PDF & open WhatsApp conversation
  downloadReceiptPdf(order, profile, settings);

  const phone = formatWhatsAppPhone(order.customer?.phone);
  const encodedText = encodeURIComponent(messageText);
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  window.open(waUrl, '_blank');

  return {
    sharedViaWebShare: false,
    openedWhatsAppChat: true,
    pdfDownloaded: true,
    message: 'PDF downloaded! WhatsApp opened. Please attach the downloaded PDF in the WhatsApp chat.',
  };
}
