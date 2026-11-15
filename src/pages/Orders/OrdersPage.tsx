import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrders, subscribeToOrders, voidOrder } from '../../services/orders/orderService';
import { Order, PaymentMethod, PaymentStatus, OrderStatus } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { downloadReceiptPdf, formatDateTime } from '../../services/pdf/receiptGenerator';
import { shareBillToWhatsApp } from '../../services/whatsapp/whatsappService';
import { printReceiptInBrowser } from '../../utils/browserPrinter';
import { 
  Search, 
  Filter, 
  Receipt, 
  Download, 
  Share2, 
  Ban, 
  Eye, 
  X, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Printer,
  Sparkles,
  UtensilsCrossed
} from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const { profile, settings } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected Order for Details & Actions
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Void Modal State
  const [voidingOrder, setVoidingOrder] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    setLoading(true);
    const unsubscribe = subscribeToOrders(
      profile.id,
      (data) => {
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.warn('Real-time orders error:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [profile?.id]);

  const filteredOrders = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return orders.filter((order) => {
      // Search Bill number or Phone or Name
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesBill = order.billNumber.toLowerCase().includes(query);
        const matchesPhone = order.customer?.phone?.includes(query);
        const matchesName = order.customer?.name?.toLowerCase().includes(query);
        if (!matchesBill && !matchesPhone && !matchesName) return false;
      }

      // Date Filter
      if (dateFilter === 'today' && !order.createdAt.startsWith(todayStr)) return false;
      if (dateFilter === 'yesterday' && !order.createdAt.startsWith(yesterdayStr)) return false;
      if (dateFilter === 'week') {
        const diffDays = (new Date().getTime() - new Date(order.createdAt).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }
      if (dateFilter === 'month') {
        const diffDays = (new Date().getTime() - new Date(order.createdAt).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }

      // Payment Filter
      if (paymentFilter !== 'all' && order.paymentMethod !== paymentFilter) return false;

      // Status Filter
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      return true;
    });
  }, [orders, searchQuery, dateFilter, paymentFilter, statusFilter]);

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim() || !voidingOrder || !profile) {
      setVoidError('A mandatory void reason must be entered.');
      return;
    }

    setVoidSubmitting(true);
    setVoidError(null);

    try {
      await voidOrder(profile.id, voidingOrder.id, voidReason.trim());
      // Refresh local list
      setOrders((prev) =>
        prev.map((o) =>
          o.id === voidingOrder.id
            ? { ...o, status: 'VOIDED', voidReason: voidReason.trim() }
            : o
        )
      );
      if (selectedOrder?.id === voidingOrder.id) {
        setSelectedOrder((prev) => prev ? { ...prev, status: 'VOIDED', voidReason: voidReason.trim() } : null);
      }
      setVoidingOrder(null);
      setVoidReason('');
    } catch (err: any) {
      setVoidError(err.message || 'Failed to void order.');
    } finally {
      setVoidSubmitting(false);
    }
  };

  const handleWhatsAppShare = async (order: Order) => {
    if (!profile) return;
    try {
      setShareFeedback('Opening WhatsApp share...');
      const res = await shareBillToWhatsApp(order, profile, settings);
      setShareFeedback(res.message);
    } catch {
      setShareFeedback('Share cancelled.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Order History</h1>
          <p className="text-xs text-zinc-500">
            Search historical bills, download receipts, re-share via WhatsApp or void orders
          </p>
        </div>
        <div className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-xl w-fit">
          Total Bills: {filteredOrders.length}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="relative">
          <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Bill No (e.g. BILL-1001) or customer phone / name..."
            className="w-full pl-11 pr-4 min-h-[50px] bg-zinc-50 focus:bg-white text-sm sm:text-base rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#145C43] transition-all"
          />
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Date Range */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Date Filter
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#145C43] cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Payment Method
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#145C43] cursor-pointer"
            >
              <option value="all">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI / QR</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Order Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#145C43] cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="OPEN">Open (In Progress)</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="text-center py-12 text-zinc-400 text-xs">
            Loading order records...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-6">
            <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-700">No orders found</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Try adjusting your search query or filters.
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isVoided = order.status === 'VOIDED' || order.status === 'CANCELLED';
            return (
              <div
                key={order.id}
                className={`p-4 bg-white border rounded-2xl shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isVoided ? 'border-rose-200 bg-rose-50/20' : 'border-zinc-200/90'
                }`}
              >
                {/* Order Identity & Customer */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isVoided ? 'bg-rose-100 text-rose-600' : 'bg-zinc-100 text-zinc-800'
                    }`}
                  >
                    <Receipt className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-sm font-bold text-zinc-950 font-mono">
                        {order.billNumber}
                      </span>
                      {order.tableNumber && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
                          {order.tableNumber}
                        </span>
                      )}
                      {/* Order Status Badge */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        order.status === 'COMPLETED'
                          ? 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                          : order.status === 'OPEN'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}>
                        {order.status}
                      </span>
                      {/* Payment Status Badge */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : order.paymentStatus === 'PARTIAL' || order.paymentStatus === 'PARTIALLY_PAID'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {order.paymentStatus === 'UNPAID' ? 'UNPAID' : order.paymentStatus}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 mt-1">
                      {order.customer?.name || 'Walk-in'} • {order.customer?.phone || 'No Phone'}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDateTime(order.createdAt)}</span>
                      <span>•</span>
                      <span className="font-medium text-zinc-600">{order.paymentMethod}</span>
                      <span>•</span>
                      <span>{order.items.length + (order.extras?.length || 0)} items</span>
                    </div>

                    {isVoided && order.voidReason && (
                      <p className="text-xs text-rose-600 mt-1 font-medium">
                        Reason: {order.voidReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-100 gap-2">
                  <div className="text-right">
                    <div className="text-base font-bold text-zinc-950 font-mono">
                      {formatCurrency(order.grandTotal)}
                    </div>
                    {order.balanceDue > 0 && (
                      <span className="text-[10px] text-rose-600 font-bold block">
                        Due: {formatCurrency(order.balanceDue)}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons (Touch Friendly min 44x44px) */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl flex items-center justify-center transition-all active:scale-90"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => profile && printReceiptInBrowser(order, profile, settings, 'compact80')}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl flex items-center justify-center transition-all active:scale-90"
                      title="Print Receipt"
                    >
                      <Printer className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => handleWhatsAppShare(order)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center transition-all active:scale-90"
                      title="Share Receipt on WhatsApp"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => profile && downloadReceiptPdf(order, profile, settings)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl flex items-center justify-center transition-all active:scale-90"
                      title="Download PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>

                    {!isVoided && (
                      <button
                        onClick={() => {
                          setVoidingOrder(order);
                          setVoidReason('');
                          setVoidError(null);
                        }}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center transition-all active:scale-90"
                        title="Void Transaction"
                      >
                        <Ban className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div>
                <span className="text-xs font-mono font-bold text-zinc-950">
                  {selectedOrder.billNumber}
                </span>
                <p className="text-xs text-zinc-500">{formatDateTime(selectedOrder.createdAt)}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Details */}
            {selectedOrder.customer && (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs">
                <span className="font-semibold text-zinc-800">Customer:</span>{' '}
                {selectedOrder.customer.name || 'Walk-in'} • {selectedOrder.customer.phone || 'N/A'}
              </div>
            )}

            {/* Items Table */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100 text-xs">
              <div className="bg-zinc-100 p-2 font-semibold text-zinc-700 grid grid-cols-12">
                <span className="col-span-6">Item</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="p-2.5 grid grid-cols-12 items-center">
                  <span className="col-span-6 font-medium text-zinc-900 truncate">
                    {item.name}
                  </span>
                  <span className="col-span-2 text-center text-zinc-600 font-mono">
                    {item.quantity}
                  </span>
                  <span className="col-span-2 text-right text-zinc-600 font-mono">
                    {item.unitPrice.toFixed(2)}
                  </span>
                  <span className="col-span-2 text-right font-bold text-zinc-900 font-mono">
                    {item.lineTotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(selectedOrder.discountAmount)}</span>
                </div>
              )}
              {selectedOrder.taxConfigSnapshot.enabled && selectedOrder.gstAmount > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>GST ({selectedOrder.taxConfigSnapshot.defaultGstRate}%):</span>
                  <span>{formatCurrency(selectedOrder.gstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-zinc-950 pt-2 border-t border-zinc-200">
                <span>Grand Total:</span>
                <span>{formatCurrency(selectedOrder.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-500 pt-1">
                <span>Payment:</span>
                <span>{selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})</span>
              </div>
            </div>

            {/* Sharing & Download Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => handleWhatsAppShare(selectedOrder)}
                className="py-2.5 px-3 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share WhatsApp</span>
              </button>

              <button
                onClick={() => profile && downloadReceiptPdf(selectedOrder, profile, settings, 'compact80')}
                className="py-2.5 px-3 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY VOID REASON MODAL */}
      {voidingOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Void Order {voidingOrder.billNumber}</h3>
                <p className="text-xs text-zinc-500">
                  This transaction will be cancelled and excluded from revenue reports.
                </p>
              </div>
            </div>

            {voidError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {voidError}
              </div>
            )}

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Mandatory Void Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Customer cancelled order before preparation, Wrong item selected by cashier, etc."
                  className="w-full p-3 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVoidingOrder(null)}
                  className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidSubmitting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-2xs disabled:opacity-50"
                >
                  {voidSubmitting ? 'Voiding...' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
