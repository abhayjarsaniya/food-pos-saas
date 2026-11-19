import React, { useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../contexts/OrdersContext';
import { Order } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { filterOrdersByDate } from '../../services/reports/reportService';
import { 
  PlusCircle, 
  Receipt, 
  ShoppingBag, 
  UtensilsCrossed, 
  BarChart3, 
  TrendingUp, 
  Wallet, 
  QrCode, 
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { profile, settings, userRole, hasNavAccess } = useAuth();
  const navigate = useNavigate();
  const { orders, loading } = useOrders();

  // Cook / Kitchen Staff auto-redirect to Kitchen Orders
  if (userRole === 'KITCHEN') {
    return <Navigate to="/kitchen" replace />;
  }

  // If user does not have permission for dashboard, route to first accessible module
  if (!hasNavAccess('dashboard')) {
    if (hasNavAccess('billing')) return <Navigate to="/billing" replace />;
    if (hasNavAccess('kitchen')) return <Navigate to="/kitchen" replace />;
    if (hasNavAccess('orders')) return <Navigate to="/orders" replace />;
    if (hasNavAccess('tables')) return <Navigate to="/tables" replace />;
  }

  // Compute Today's Stats from actual orders
  const todayStats = useMemo(() => {
    const todaysOrders = filterOrdersByDate(orders, 'today').filter((o) => o.status !== 'VOIDED');

    let revenue = 0;
    let cash = 0;
    let upi = 0;
    let outstanding = 0;

    todaysOrders.forEach((o) => {
      revenue += o.grandTotal;
      const collected = o.amountPaid || (o.paymentStatus === 'PAID' ? o.grandTotal : 0);
      if (o.paymentMethod === 'CASH') cash += collected;
      else if (o.paymentMethod === 'UPI') upi += collected;

      const bal = o.balanceDue !== undefined && o.balanceDue !== null 
        ? o.balanceDue 
        : Math.max(0, o.grandTotal - collected);
      if (o.status !== 'CANCELLED' && o.status !== 'VOIDED') {
        outstanding += bal;
      }
    });

    const count = todaysOrders.length;
    const aov = count > 0 ? revenue / count : 0;

    return {
      revenue,
      count,
      aov,
      cash,
      upi,
      outstanding,
    };
  }, [orders]);

  const recentOrders = useMemo(() => {
    return orders.slice(0, 5);
  }, [orders]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="space-y-6">
      {/* Top Section */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            {getGreeting()}
          </p>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">
            {profile?.name || 'Food Counter POS'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* 1-Tap All Orders Shortcut */}
          <button
            onClick={() => navigate('/orders')}
            className="min-h-[46px] px-3.5 py-2 rounded-2xl bg-[#EAF5EF] hover:bg-[#CFE5D8] text-[#145C43] border border-[#CFE5D8] flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer"
            title="One-tap access to all customer orders"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">All Orders</span>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center transition-all active:scale-90 shadow-2xs"
            title="Settings & Profile"
          >
            <span className="font-bold text-base">
              {profile?.ownerName?.charAt(0) || 'O'}
            </span>
          </button>
        </div>
      </div>

      {/* Prominent Action - NEW BILL (Highest Priority - Touch friendly >= 64px) */}
      <button
        onClick={() => navigate('/billing')}
        className="w-full min-h-[76px] group relative overflow-hidden bg-[#145C43] hover:bg-[#0F4935] text-white rounded-2xl p-5 shadow-md transition-all active:scale-[0.98] flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-white/15 flex items-center justify-center text-white">
            <PlusCircle className="w-8 h-8 text-white group-hover:rotate-90 transition-transform duration-300" />
          </div>
          <div className="text-left">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Create New Bill</h2>
            <p className="text-xs sm:text-sm text-white/80 mt-0.5">
              Instant menu selection & WhatsApp sharing
            </p>
          </div>
        </div>

        <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
          <ArrowRight className="w-5 h-5 text-white" />
        </div>
      </button>

      {/* Revenue Overview Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#68736D] uppercase tracking-wider">
            Today's Financial Overview
          </h2>
          <span className="text-xs text-[#929B95] font-medium">
            {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Today's Revenue (White card with dark green metric) */}
          <div className="col-span-2 sm:col-span-1 bg-white border border-[#E5EAE6] text-[#202923] p-4.5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between text-[#68736D] mb-1">
              <span className="text-xs font-semibold">Today's Revenue</span>
              <span className="p-1 rounded-lg bg-[#EAF5EF] text-[#145C43]">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#145C43] tracking-tight">
              {formatCurrency(todayStats.revenue)}
            </div>
            <p className="text-xs text-[#68736D] mt-1">
              {todayStats.count} {todayStats.count === 1 ? 'bill created' : 'bills created'}
            </p>
          </div>

          {/* Average Order Value */}
          <div className="bg-white border border-[#E5EAE6] p-4.5 rounded-2xl shadow-2xs">
            <div className="text-xs font-semibold text-[#68736D] mb-1">Avg Order Value</div>
            <div className="text-xl sm:text-2xl font-bold text-[#202923]">
              {formatCurrency(todayStats.aov)}
            </div>
            <p className="text-xs text-[#929B95] mt-1">Per transaction</p>
          </div>

          {/* Cash Collected */}
          <div className="bg-white border border-[#E5EAE6] p-4.5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between text-[#68736D] mb-1">
              <span className="text-xs font-semibold">Cash Collected</span>
              <Wallet className="w-4 h-4 text-[#929B95]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#202923]">
              {formatCurrency(todayStats.cash)}
            </div>
            <p className="text-xs text-[#19865D] mt-1 font-semibold">Physical cash in drawer</p>
          </div>

          {/* UPI Collected */}
          <div className="bg-white border border-[#E5EAE6] p-4.5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between text-[#68736D] mb-1">
              <span className="text-xs font-semibold">UPI / QR Collected</span>
              <QrCode className="w-4 h-4 text-[#929B95]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#202923]">
              {formatCurrency(todayStats.upi)}
            </div>
            <p className="text-xs text-indigo-600 mt-1 font-semibold">Direct digital receipts</p>
          </div>
        </div>
      </section>

      {/* Quick Navigation Cards */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
          Quick Management
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="min-h-[72px] p-4 bg-white border border-[#E5EAE6] hover:border-[#CFE5D8] rounded-2xl hover:bg-[#EAF5EF]/40 transition-all active:scale-95 flex flex-col items-center text-center shadow-2xs group cursor-pointer"
          >
            <ShoppingBag className="w-6 h-6 text-[#145C43] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs sm:text-sm font-bold text-[#202923]">All Orders</span>
            <span className="text-[11px] text-[#68736D] mt-0.5">1-Tap History</span>
          </button>

          <button
            onClick={() => navigate('/menu')}
            className="min-h-[72px] p-4 bg-white border border-zinc-200/90 rounded-2xl hover:bg-zinc-50 transition-all active:scale-95 flex flex-col items-center text-center shadow-xs"
          >
            <UtensilsCrossed className="w-6 h-6 text-zinc-800 mb-1.5" />
            <span className="text-xs sm:text-sm font-bold text-zinc-900">Menu</span>
            <span className="text-[11px] text-zinc-400 mt-0.5">Items & Rates</span>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="min-h-[72px] p-4 bg-white border border-zinc-200/90 rounded-2xl hover:bg-zinc-50 transition-all active:scale-95 flex flex-col items-center text-center shadow-xs"
          >
            <BarChart3 className="w-6 h-6 text-zinc-800 mb-1.5" />
            <span className="text-xs sm:text-sm font-bold text-zinc-900">Reports</span>
            <span className="text-[11px] text-zinc-400 mt-0.5">Sales & Tax</span>
          </button>
        </div>
      </section>

      {/* Recent 5 Orders */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Recent Orders
          </h2>
          <button
            onClick={() => navigate('/orders')}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-950 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl">
            <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 font-medium">No bills created yet</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Tap "Create New Bill" to create your first order
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
            {recentOrders.map((order) => {
              const isVoided = order.status === 'VOIDED';
              return (
                <div
                  key={order.id}
                  onClick={() => navigate('/orders')}
                  className="p-3.5 hover:bg-zinc-50/80 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isVoided
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 font-mono">
                          {order.billNumber}
                        </span>
                        {isVoided && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-semibold">
                            VOID
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatDateTime(order.createdAt)}</span>
                        <span>•</span>
                        <span>{order.paymentMethod}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-zinc-900">
                      {formatCurrency(order.grandTotal)}
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${
                        order.paymentStatus === 'PAID'
                          ? 'text-emerald-600'
                          : order.paymentStatus === 'PARTIAL'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {order.paymentStatus}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
