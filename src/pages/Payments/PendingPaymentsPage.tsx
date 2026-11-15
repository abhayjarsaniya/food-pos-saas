import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrders, markOrderReceived, recordOrderPayment } from '../../services/orders/orderService';
import { Order, PaymentMethod, PaymentStatus } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { printReceiptInBrowser } from '../../utils/browserPrinter';
import { shareBillToWhatsApp } from '../../services/whatsapp/whatsappService';
import { 
  CreditCard, 
  Wallet, 
  QrCode, 
  Receipt, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  UtensilsCrossed, 
  User, 
  Phone, 
  DollarSign, 
  Printer, 
  Share2, 
  X, 
  AlertCircle 
} from 'lucide-react';

export const PendingPaymentsPage: React.FC = () => {
  const { profile, settings, user, userRole, canCollectPayment } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('UNPAID');
  const [tableFilter, setTableFilter] = useState<string>('ALL');

  // Receive Payment Modal State
  const [activeOrderForPayment, setActiveOrderForPayment] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Quick Action Confirmation State
  const [confirmQuickOrderId, setConfirmQuickOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadOrders();
    }
  }, [profile?.id]);

  const loadOrders = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const data = await getOrders(profile.id);
      setOrders(data);
    } catch (err) {
      console.warn('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const availableTables = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.tableNumber) set.add(o.tableNumber);
    });
    return Array.from(set);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === 'VOIDED' || o.status === 'CANCELLED') return false;

      // Filter by status
      if (statusFilter === 'UNPAID' && o.paymentStatus !== 'UNPAID') return false;
      if (statusFilter === 'PARTIAL' && o.paymentStatus !== 'PARTIAL' && o.paymentStatus !== 'PARTIALLY_PAID') return false;
      if (statusFilter === 'PAID' && o.paymentStatus !== 'PAID') return false;

      // Filter by table
      if (tableFilter !== 'ALL' && o.tableNumber !== tableFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesBill = o.billNumber.toLowerCase().includes(q);
        const matchesCustomer = (o.customer?.name || '').toLowerCase().includes(q);
        const matchesPhone = (o.customer?.phone || '').includes(q);
        const matchesTable = (o.tableNumber || '').toLowerCase().includes(q);
        return matchesBill || matchesCustomer || matchesPhone || matchesTable;
      }

      return true;
    });
  }, [orders, statusFilter, tableFilter, searchQuery]);

  const totalOutstanding = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'VOIDED' && o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.balanceDue || 0), 0);
  }, [orders]);

  const handleOpenReceiveModal = (order: Order) => {
    setActiveOrderForPayment(order);
    setPaymentAmount(order.balanceDue.toString());
    setPaymentMethod('CASH');
    setPaymentRef('');
    setPaymentNotes('');
    setPaymentError(null);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !activeOrderForPayment) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('Enter a valid payment amount greater than zero.');
      return;
    }
    if (amount > activeOrderForPayment.balanceDue + 0.01) {
      setPaymentError(`Amount cannot exceed the balance due of ${formatCurrency(activeOrderForPayment.balanceDue)}`);
      return;
    }

    // Permission check for cashiers
    if (userRole === 'CASHIER' && !canCollectPayment) {
      setPaymentError('You do not have permission to record payments. Please request an owner or manager.');
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentError(null);

    try {
      await recordOrderPayment(profile.id, activeOrderForPayment.id, {
        amount,
        paymentMethod,
        paymentReference: paymentRef,
        notes: paymentNotes,
        receivedBy: user?.uid || 'cashier',
        receivedByName: user?.displayName || user?.email || 'Counter Staff',
      });

      await loadOrders();
      setActiveOrderForPayment(null);
    } catch (err: any) {
      setPaymentError(err.message || 'Payment recording failed.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Owner Quick Action: Mark Full Payment as Received
  const handleQuickMarkReceived = async (order: Order) => {
    if (!profile?.id) return;
    if (userRole === 'CASHIER' && !canCollectPayment) {
      alert('Cashier is not authorized to clear outstanding payments.');
      return;
    }

    try {
      await markOrderReceived(
        profile.id,
        order.id,
        'CASH',
        user?.uid || 'owner',
        user?.displayName || 'Owner'
      );
      setConfirmQuickOrderId(null);
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to mark as received.');
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-16">
      {/* Header & Outstanding KPI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-zinc-200 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-zinc-900" />
            <h1 className="text-lg font-bold text-zinc-900">Payment Collection & Pending Bills</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Collect customer payments for open bills, view dues by table, and print receipts
          </p>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between sm:justify-end gap-3">
          <div>
            <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
              Total Outstanding Balance
            </p>
            <p className="text-base sm:text-lg font-black text-amber-950 font-mono">
              {formatCurrency(totalOutstanding)}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-zinc-200 rounded-2xl space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bill #, customer, table, mobile..."
              className="w-full pl-11 pr-4 min-h-[50px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs sm:text-sm">
            {(['UNPAID', 'PARTIAL', 'PAID', 'ALL'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[46px] px-4 py-2 rounded-2xl font-bold whitespace-nowrap transition-all active:scale-95 ${
                  statusFilter === st
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {st === 'UNPAID' ? 'Pending Dues' : st === 'PARTIAL' ? 'Partially Paid' : st === 'PAID' ? 'Fully Paid' : 'All Orders'}
              </button>
            ))}
          </div>

          {/* Table Filter */}
          {availableTables.length > 0 && (
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="min-h-[48px] text-sm font-bold px-4 py-2 bg-zinc-50 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer"
            >
              <option value="ALL">All Tables</option>
              {availableTables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="p-8 text-center text-zinc-400 text-xs">Loading payment orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white border border-zinc-200 rounded-2xl text-zinc-400 text-xs space-y-1">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
          <p className="font-bold text-zinc-700">No matching orders found</p>
          <p>All matching bills are paid or no active bills match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredOrders.map((ord) => {
            const isFullyPaid = ord.paymentStatus === 'PAID';
            const isPartial = ord.paymentStatus === 'PARTIAL' || ord.paymentStatus === 'PARTIALLY_PAID';

            return (
              <div
                key={ord.id}
                className="p-4 bg-white border border-zinc-200/90 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3"
              >
                {/* Order Top Info */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md">
                        {ord.billNumber}
                      </span>
                      {ord.tableNumber && (
                        <span className="text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {ord.tableNumber}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isFullyPaid
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPartial
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isFullyPaid ? 'Paid' : isPartial ? 'Partially Paid' : 'Unpaid Due'}
                    </span>
                  </div>

                  {/* Customer & Time */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2">
                    <div className="flex items-center gap-1 truncate">
                      {ord.customer?.name || ord.customer?.phone ? (
                        <>
                          <User className="w-3 h-3 text-zinc-400" />
                          <span className="font-medium text-zinc-700 truncate">
                            {[ord.customer.name, ord.customer.phone].filter(Boolean).join(' • ')}
                          </span>
                        </>
                      ) : (
                        <span>Walk-in Customer</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-mono text-zinc-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{formatDateTime(ord.createdAt)}</span>
                    </div>
                  </div>

                  {/* Items snapshot */}
                  <div className="p-2 bg-zinc-50 rounded-xl text-xs space-y-0.5">
                    {ord.items.slice(0, 3).map((it) => (
                      <div key={it.itemId} className="flex justify-between text-zinc-600">
                        <span className="truncate pr-2">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="font-mono">{formatCurrency(it.lineTotal)}</span>
                      </div>
                    ))}
                    {ord.extras && ord.extras.length > 0 && (
                      <div className="text-[10px] text-amber-700 font-medium">
                        +{ord.extras.length} Custom Extra(s)
                      </div>
                    )}
                    {ord.items.length > 3 && (
                      <span className="text-[10px] text-zinc-400 block pt-0.5">
                        +{ord.items.length - 3} more item(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Financial Summary & Actions */}
                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="text-zinc-500">
                      Total: <span className="font-bold text-zinc-900">{formatCurrency(ord.grandTotal)}</span>
                      {ord.amountPaid > 0 && (
                        <span className="ml-2 text-emerald-600">
                          Recv: {formatCurrency(ord.amountPaid)}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      {ord.balanceDue > 0 ? (
                        <span className="text-sm font-bold text-rose-600">
                          Due: {formatCurrency(ord.balanceDue)}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Fully Cleared</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar (Touch friendly min 52px height) */}
                  <div className="flex items-center gap-2 pt-2">
                    {!isFullyPaid && (
                      <>
                        {userRole === 'CASHIER' && !canCollectPayment ? (
                          <div className="flex-1 min-h-[52px] px-3 bg-zinc-100 text-zinc-500 rounded-2xl flex items-center justify-center text-xs font-medium">
                            Payment collection requires owner authorization
                          </div>
                        ) : (
                          <>
                            {/* Receive Payment Modal Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenReceiveModal(ord)}
                              className="flex-1 min-h-[52px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-2xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              <Wallet className="w-5 h-5" />
                              <span>Receive Payment</span>
                            </button>

                            {/* Owner Quick Action: Mark Full as Received */}
                            {confirmQuickOrderId === ord.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleQuickMarkReceived(ord)}
                                  className="min-h-[52px] px-3.5 bg-zinc-900 text-white text-xs sm:text-sm font-bold rounded-2xl active:scale-95 transition-all shadow-xs"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmQuickOrderId(null)}
                                  className="min-h-[52px] px-3 text-zinc-500 text-xs sm:text-sm rounded-2xl hover:bg-zinc-100 active:scale-95 transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmQuickOrderId(ord.id)}
                                className="min-h-[52px] px-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs sm:text-sm font-bold rounded-2xl transition-all active:scale-95 shrink-0"
                                title="One-tap mark full payment as received"
                              >
                                Mark Full
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* Print Receipt Dialog */}
                    <button
                      type="button"
                      onClick={() => profile && printReceiptInBrowser(ord, profile, settings, 'compact80')}
                      className="w-12 h-12 min-w-[48px] min-h-[48px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0"
                      title="Print receipt"
                    >
                      <Printer className="w-5 h-5" />
                    </button>

                    {/* WhatsApp */}
                    <button
                      type="button"
                      onClick={() => profile && shareBillToWhatsApp(ord, profile, settings)}
                      className="w-12 h-12 min-w-[48px] min-h-[48px] bg-zinc-100 hover:bg-[#25D366] hover:text-white text-zinc-700 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0"
                      title="Share to WhatsApp"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RECEIVE PAYMENT MODAL */}
      {activeOrderForPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Record Payment</h3>
                <p className="text-xs text-zinc-500 font-mono">
                  Bill: {activeOrderForPayment.billNumber} • {activeOrderForPayment.tableNumber}
                </p>
              </div>
              <button
                onClick={() => setActiveOrderForPayment(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bill Financial Status */}
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1 font-mono text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Bill Grand Total:</span>
                <span className="font-bold text-zinc-900">{formatCurrency(activeOrderForPayment.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Already Paid:</span>
                <span className="text-emerald-600 font-semibold">{formatCurrency(activeOrderForPayment.amountPaid || 0)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-bold pt-1 border-t border-zinc-200 text-sm">
                <span>Balance Due:</span>
                <span>{formatCurrency(activeOrderForPayment.balanceDue)}</span>
              </div>
            </div>

            {paymentError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3.5">
              {/* Payment Amount */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Received Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  max={activeOrderForPayment.balanceDue}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 min-h-[54px] text-lg sm:text-xl bg-white border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 font-mono font-bold"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'CASH' as PaymentMethod, label: 'Cash' },
                    { id: 'UPI' as PaymentMethod, label: 'UPI' },
                    { id: 'CARD' as PaymentMethod, label: 'Card' },
                    { id: 'OTHER' as PaymentMethod, label: 'Other' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`min-h-[48px] text-xs sm:text-sm font-bold rounded-2xl border transition-all active:scale-95 ${
                        paymentMethod === m.id
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference ID / Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UPI Ref / Card Last 4"
                  className="w-full px-4 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveOrderForPayment(null)}
                  className="flex-1 min-h-[52px] text-sm font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-2xl active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 min-h-[52px] text-sm sm:text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-xs transition-all disabled:opacity-50 active:scale-95"
                >
                  {isSubmittingPayment ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
