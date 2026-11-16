import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../contexts/OrdersContext';
import { 
  markOrderReceived, 
  recordOrderPayment, 
  normalizePaymentStatus, 
  normalizeOrderStatus,
  isEligiblePendingPayment
} from '../../services/orders/orderService';
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
  AlertCircle,
  LayoutGrid,
  List
} from 'lucide-react';

export const PendingPaymentsPage: React.FC = () => {
  const { profile, settings, user, userRole, canCollectPayment, currentMember } = useAuth();
  const { orders, loading, refreshOrders } = useOrders();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'ALL'>('PENDING');
  const [tableFilter, setTableFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>(() => {
    return (localStorage.getItem('food_pos_pending_view') as any) || 'GRID';
  });

  const handleSetViewMode = (mode: 'GRID' | 'LIST') => {
    setViewMode(mode);
    try {
      localStorage.setItem('food_pos_pending_view', mode);
    } catch {}
  };

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

  const availableTables = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.tableNumber) set.add(o.tableNumber);
    });
    return Array.from(set);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const ordStatus = normalizeOrderStatus(o.orderStatus || o.status);
      if (ordStatus === 'Cancelled') return false;

      const payStatus = normalizePaymentStatus(o.canonicalPaymentStatus || o.paymentStatus);
      const grandTotal = typeof o.grandTotal === 'number' ? o.grandTotal : parseFloat(o.grandTotal) || 0;
      const amountPaid = typeof o.amountPaid === 'number' ? o.amountPaid : parseFloat(o.amountPaid) || 0;
      const balance = o.balanceDue !== undefined && o.balanceDue !== null 
        ? (typeof o.balanceDue === 'number' ? o.balanceDue : parseFloat(o.balanceDue) || 0)
        : Math.max(0, grandTotal - amountPaid);

      // Filter by status tab
      if (statusFilter === 'PENDING') {
        if (!isEligiblePendingPayment(o)) return false;
      } else if (statusFilter === 'UNPAID') {
        if (payStatus !== 'Unpaid' || balance <= 0) return false;
      } else if (statusFilter === 'PARTIAL') {
        if (payStatus !== 'Partially Paid' || balance <= 0) return false;
      } else if (statusFilter === 'PAID') {
        if (payStatus !== 'Paid' && balance > 0) return false;
      }

      // Filter by table
      if (tableFilter !== 'ALL') {
        const tbl = o.tableNumber || o.tableName;
        if (tbl !== tableFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesBill = (o.billNumber || '').toLowerCase().includes(q);
        const matchesCustomer = (o.customer?.name || o.customerName || '').toLowerCase().includes(q);
        const matchesPhone = (o.customer?.phone || o.customerId || '').includes(q);
        const matchesTable = (o.tableNumber || o.tableName || '').toLowerCase().includes(q);
        return matchesBill || matchesCustomer || matchesPhone || matchesTable;
      }

      return true;
    });
  }, [orders, statusFilter, tableFilter, searchQuery]);

  const totalOutstanding = useMemo(() => {
    return orders
      .filter((o) => isEligiblePendingPayment(o))
      .reduce((sum, o) => {
        const bal = o.balanceDue !== undefined && o.balanceDue !== null 
          ? (typeof o.balanceDue === 'number' ? o.balanceDue : parseFloat(o.balanceDue) || 0)
          : Math.max(0, (o.grandTotal || 0) - (o.amountPaid || 0));
        return sum + bal;
      }, 0);
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

    // Permission check for cashiers & staff
    if (!canCollectPayment && userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN') {
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
        receivedBy: currentMember?.id || user?.uid || 'cashier',
        receivedByName: currentMember?.name || user?.displayName || user?.email || 'Counter Staff',
        memberPermissions: currentMember?.permissions?.pendingPayments || (canCollectPayment ? undefined : { canCollectPayment: false }),
      });

      await refreshOrders();
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
    if (!canCollectPayment && userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN') {
      alert('Staff is not authorized to clear outstanding payments.');
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
      await refreshOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to mark as received.');
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0 pb-6">
      {/* Header & Outstanding KPI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#E5EAE6] rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#145C43]" />
            <h1 className="text-lg font-bold text-[#202923]">Payment Collection & Pending Bills</h1>
          </div>
          <p className="hidden md:block text-xs text-[#68736D] mt-0.5">
            Collect customer payments for open bills, view dues by table, and print receipts
          </p>
        </div>

        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-center justify-between sm:justify-end gap-3">
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
      <div className="p-4 bg-white border border-[#E5EAE6] rounded-2xl space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bill #, customer, table, mobile..."
              className="w-full pl-11 pr-4 min-h-[48px] text-sm bg-zinc-50 border border-[#E5EAE6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145C43]"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {(['PENDING', 'UNPAID', 'PARTIAL', 'PAID', 'ALL'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#145C43] text-white shadow-xs'
                    : 'bg-zinc-100 text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43]'
                }`}
              >
                {st === 'PENDING'
                  ? 'All Pending Dues'
                  : st === 'UNPAID'
                  ? 'Unpaid'
                  : st === 'PARTIAL'
                  ? 'Partially Paid'
                  : st === 'PAID'
                  ? 'Fully Paid'
                  : 'All Orders'}
              </button>
            ))}
          </div>

          {/* Table Filter */}
          {availableTables.length > 0 && (
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="min-h-[44px] text-xs font-bold px-3 py-2 bg-zinc-50 border border-[#E5EAE6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145C43] cursor-pointer"
            >
              <option value="ALL">All Tables</option>
              {availableTables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {/* View Mode Switcher: Cards vs Table List */}
          <div className="flex items-center gap-1 bg-[#F7F9F7] p-1 rounded-xl border border-[#E5EAE6] shadow-2xs self-end sm:self-center">
            <button
              type="button"
              onClick={() => handleSetViewMode('GRID')}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'GRID'
                  ? 'bg-[#145C43] text-white shadow-2xs'
                  : 'text-[#68736D] hover:bg-white hover:text-[#202923]'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetViewMode('LIST')}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'LIST'
                  ? 'bg-[#145C43] text-white shadow-2xs'
                  : 'text-[#68736D] hover:bg-white hover:text-[#202923]'
              }`}
              title="Table List View"
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="p-8 text-center text-zinc-400 text-xs">Loading payment orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E5EAE6] rounded-2xl text-zinc-400 text-xs space-y-1">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
          <p className="font-bold text-zinc-700">No matching orders found</p>
          <p>All matching bills are paid or no active bills match this filter.</p>
        </div>
      ) : viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
                        {!canCollectPayment && userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN' ? (
                          <div className="flex-1 min-h-[52px] px-3 bg-zinc-100 text-zinc-500 rounded-2xl flex items-center justify-center text-xs font-medium">
                            Payment collection requires authorization
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
                                  className="min-h-[52px] px-3.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-2xl active:scale-95 transition-all shadow-xs cursor-pointer"
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
      ) : (
        /* TABLE LIST VIEW - Clean desktop table view for pending bills */
        <div className="bg-white border border-[#E5EAE6] rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F7F9F7] border-b border-[#E5EAE6] text-[11px] font-bold text-[#68736D] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Bill #</th>
                  <th className="py-3.5 px-4">Table</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Time</th>
                  <th className="py-3.5 px-4">Items Summary</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-right">Balance Due</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAE6]">
                {filteredOrders.map((ord) => {
                  const isFullyPaid = ord.paymentStatus === 'PAID';
                  return (
                    <tr key={ord.id} className="hover:bg-[#F7F9F7]/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#202923]">
                        {ord.billNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        {ord.tableNumber ? (
                          <span className="font-bold text-[#145C43] bg-[#EAF5EF] px-2 py-0.5 rounded-full text-[11px]">
                            {ord.tableNumber}
                          </span>
                        ) : (
                          <span className="text-[#929B95]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-[#202923] block">
                          {ord.customer?.name || ord.customerName || 'Walk-in'}
                        </span>
                        {ord.customer?.phone && (
                          <span className="text-[11px] text-[#68736D] font-mono">{ord.customer.phone}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#68736D] text-[11px] whitespace-nowrap">
                        {formatDateTime(ord.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-[#202923]">
                        {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#202923]">
                        {formatCurrency(ord.grandTotal)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        {ord.balanceDue > 0 ? (
                          <span className="text-sm font-extrabold text-rose-600">
                            {formatCurrency(ord.balanceDue)}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600">Cleared</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isFullyPaid && (canCollectPayment || userRole === 'OWNER' || userRole === 'SUPER_ADMIN') && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReceiveModal(ord)}
                                className="min-h-[38px] px-3 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                              >
                                Receive
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickMarkReceived(ord)}
                                className="min-h-[38px] px-2.5 bg-[#F7F9F7] hover:bg-[#EAF5EF] text-[#202923] hover:text-[#145C43] text-xs font-semibold rounded-xl border border-[#E5EAE6] cursor-pointer"
                                title="Mark full payment"
                              >
                                Mark Full
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => profile && printReceiptInBrowser(ord, profile, settings, 'compact80')}
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43] rounded-xl border border-[#E5EAE6] cursor-pointer"
                            title="Print receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                  className="w-full px-4 min-h-[54px] text-lg sm:text-xl bg-white border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#145C43] font-mono font-bold"
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
                      className={`min-h-[48px] text-xs sm:text-sm font-bold rounded-2xl border transition-all active:scale-95 cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-[#145C43] text-white border-[#145C43] shadow-xs'
                          : 'bg-zinc-50 text-[#68736D] border-zinc-200 hover:bg-[#EAF5EF] hover:text-[#145C43]'
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
                  className="w-full px-4 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#145C43]/20 focus:border-[#145C43]"
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
                  className="flex-1 min-h-[52px] text-sm sm:text-base font-bold text-white bg-[#145C43] hover:bg-[#0F4935] rounded-2xl shadow-xs transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
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
