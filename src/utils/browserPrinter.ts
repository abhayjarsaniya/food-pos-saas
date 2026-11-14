import { BusinessProfile, BusinessSettings, Order } from '../types';
import { formatDateTime } from '../services/pdf/receiptGenerator';

/**
 * Triggers native browser print dialog with printer-friendly thermal or standard receipt styling
 */
export function printReceiptInBrowser(
  order: Order,
  profile: BusinessProfile,
  settings: BusinessSettings,
  format: 'compact80' | 'compact58' | 'a4' = 'compact80'
): void {
  const is58 = format === 'compact58';
  const isA4 = format === 'a4';
  const widthStyle = isA4 ? 'max-width: 800px; margin: 20px auto;' : is58 ? 'max-width: 58mm; margin: 0 auto;' : 'max-width: 80mm; margin: 0 auto;';

  const extrasHtml = (order.extras || [])
    .map(
      (ext) => `
    <tr>
      <td style="padding: 4px 0;">[Extra] ${ext.name}<br/><span style="font-size: 11px; color: #555;">${ext.quantity} x ₹${ext.unitPrice.toFixed(2)}</span></td>
      <td style="text-align: right; padding: 4px 0; vertical-align: top;">₹${ext.lineTotal.toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 4px 0;">${item.name}<br/><span style="font-size: 11px; color: #555;">${item.quantity} x ₹${item.unitPrice.toFixed(2)}</span></td>
      <td style="text-align: right; padding: 4px 0; vertical-align: top;">₹${item.lineTotal.toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  const statusBadge =
    order.paymentStatus === 'UNPAID'
      ? `<div style="border: 2px dashed #dc2626; padding: 8px; text-align: center; margin: 12px 0; font-weight: bold; color: #dc2626; font-size: 13px;">
          *** PAYMENT PENDING ***<br/>
          <span style="font-size: 11px; font-weight: normal; color: #111;">Balance Due: ₹${order.balanceDue.toFixed(2)}</span>
        </div>`
      : order.paymentStatus === 'PARTIAL' || order.paymentStatus === 'PARTIALLY_PAID'
      ? `<div style="border: 2px dashed #d97706; padding: 8px; text-align: center; margin: 12px 0; font-weight: bold; color: #d97706; font-size: 13px;">
          *** PARTIALLY PAID ***<br/>
          <span style="font-size: 11px; font-weight: normal; color: #111;">Received: ₹${order.amountPaid.toFixed(2)} | Balance: ₹${order.balanceDue.toFixed(2)}</span>
        </div>`
      : `<div style="border: 2px solid #16a34a; padding: 8px; text-align: center; margin: 12px 0; font-weight: bold; color: #16a34a; font-size: 13px;">
          *** PAID ***<br/>
          <span style="font-size: 11px; font-weight: normal; color: #111;">${order.paymentMethod} - Received Full ₹${order.amountPaid.toFixed(2)}</span>
        </div>`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt - ${order.billNumber}</title>
        <style>
          @page {
            margin: ${isA4 ? '15mm' : '3mm'};
            size: ${isA4 ? 'A4' : is58 ? '58mm auto' : '80mm auto'};
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
            font-size: ${isA4 ? '13px' : '12px'};
            line-height: 1.4;
            color: #000;
            background: #fff;
            padding: ${isA4 ? '20px' : '4px'};
          }
          .receipt-container {
            ${widthStyle}
          }
          .text-center { text-align: center; }
          .divider { border-top: 1px dashed #666; margin: 8px 0; }
          .solid-divider { border-top: 2px solid #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          @media print {
            body { padding: 0; }
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="text-center">
            <h2 style="margin: 0 0 4px 0; font-size: 16px; letter-spacing: 0.5px;">${profile.name.toUpperCase()}</h2>
            ${profile.address ? `<div style="font-size: 11px; color: #444;">${profile.address}</div>` : ''}
            ${profile.phone ? `<div style="font-size: 11px;">Ph: ${profile.phone}</div>` : ''}
            ${order.taxConfigSnapshot.enabled && order.taxConfigSnapshot.gstin ? `<div style="font-size: 11px;">GSTIN: ${order.taxConfigSnapshot.gstin}</div>` : ''}
          </div>

          <div class="divider"></div>

          <div style="font-size: 11px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Bill No: <strong>${order.billNumber}</strong></span>
              <span>${formatDateTime(order.createdAt)}</span>
            </div>
            ${order.tableNumber ? `<div style="margin-top: 2px;">Table / Type: <strong>${order.tableNumber}</strong></div>` : ''}
            ${order.customer?.name || order.customer?.phone ? `<div style="margin-top: 2px;">Customer: ${[order.customer.name, order.customer.phone].filter(Boolean).join(' | ')}</div>` : ''}
          </div>

          <div class="divider"></div>

          <table>
            ${itemsHtml}
            ${extrasHtml}
          </table>

          <div class="divider"></div>

          <table style="font-size: 12px;">
            <tr>
              <td>Subtotal</td>
              <td style="text-align: right;">₹${order.subtotal.toFixed(2)}</td>
            </tr>
            ${order.discountAmount > 0 ? `<tr><td>Discount</td><td style="text-align: right;">- ₹${order.discountAmount.toFixed(2)}</td></tr>` : ''}
            ${order.taxConfigSnapshot.enabled && order.gstAmount > 0 ? `
              <tr><td>Taxable Amount</td><td style="text-align: right;">₹${order.taxableAmount.toFixed(2)}</td></tr>
              ${order.taxConfigSnapshot.isInterState ? `<tr><td>IGST</td><td style="text-align: right;">₹${order.igstAmount.toFixed(2)}</td></tr>` : `
                <tr><td>CGST</td><td style="text-align: right;">₹${order.cgstAmount.toFixed(2)}</td></tr>
                <tr><td>SGST</td><td style="text-align: right;">₹${order.sgstAmount.toFixed(2)}</td></tr>
              `}
            ` : ''}
          </table>

          <div class="solid-divider"></div>

          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin: 6px 0;">
            <span>GRAND TOTAL:</span>
            <span>₹${order.grandTotal.toFixed(2)}</span>
          </div>

          ${statusBadge}

          ${settings.receipt?.footerMessage ? `<div class="text-center" style="font-size: 10px; font-style: italic; margin-top: 10px; color: #444;">${settings.receipt.footerMessage}</div>` : ''}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=450,height=600');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
