import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getOrders } from '../../services/orders/orderService';
import { Order } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
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
  const { profile, settings } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadOrders();
    }
  }, [profile?.id]);

  const loadOrders = async () => {
    if (!profile?.id) return;
    try {
      const data = await getOrders(profile.id);
      setOrders(data);
    } catch (err) {
      console.warn('Failed to fetch orders for home:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute Today's Stats from actual orders
  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysOrders = orders.filter((o) => {
      if (o.status === 'VOIDED') return false;
      return o.createdAt.startsWith(todayStr);
    });

    let revenue = 0;
    let cash = 0;
    let upi = 0;

    todaysOrders.forEach((o) => {
      revenue += o.grandTotal;
      const collected = o.amountPaid || (o.paymentStatus === 'PAID' ? o.grandTotal : 0);
      if (o.paymentMethod === 'CASH') cash += collected;
      else if (o.paymentMethod === 'UPI') upi += collected;
    });

    const count = todaysOrders.length;
    const aov = count > 0 ? revenue / count : 0;

    return {
      revenue,
      count,
      aov,
      cash,
      upi,
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

        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-colors"
          title="Settings"
        >
          <span className="font-semibold text-sm">
            {profile?.ownerName?.charAt(0) || 'O'}
          </span>
        </button>
      </div>

      {/* Prominent Action - NEW BILL (Highest Priority) */}
      <button
        onClick={() => navigate('/billing')}
        className="w-full group relative overflow-hidden bg-zinc-950 hover:bg-zinc-900 text-white rounded-2xl p-5 shadow-sm transition-all flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white">
            <PlusCircle className="w-7 h-7 text-emerald-400 group-hover:rotate-90 transition-transform duration-300" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-bold">Create New Bill</h2>
            <p className="text-xs text-zinc-400">
              Instant menu selection & WhatsApp sharing
            </p>
          </div>
        </div>

        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
          <ArrowRight className="w-5 h-5 text-white" />
        </div>
      </button>

      {/* Revenue Overview Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Today's Financial Overview
          </h2>
          <span className="text-xs text-zinc-400">
            {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Today's Revenue */}
          <div className="col-span-2 sm:col-span-1 bg-zinc-900 text-white p-4 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium">Today's Revenue</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrency(todayStats.revenue)}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              {todayStats.count} {todayStats.count === 1 ? 'bill created' : 'bills created'}
            </p>
          </div>

          {/* Average Order Value */}
          <div className="bg-white border border-zinc-200/80 p-4 rounded-2xl shadow-2xs">
            <div className="text-xs font-medium text-zinc-500 mb-1">Avg Order Value</div>
            <div className="text-xl font-bold text-zinc-900">
              {formatCurrency(todayStats.aov)}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Per transaction</p>
          </div>

          {/* Cash Collected */}
          <div className="bg-white border border-zinc-200/80 p-4 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-medium">Cash Collected</span>
              <Wallet className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="text-xl font-bold text-zinc-900">
              {formatCurrency(todayStats.cash)}
            </div>
            <p className="text-[11px] text-emerald-600 mt-1 font-medium">Physical cash in drawer</p>
          </div>

          {/* UPI Collected */}
          <div className="bg-white border border-zinc-200/80 p-4 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-medium">UPI / QR Collected</span>
              <QrCode className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="text-xl font-bold text-zinc-900">
              {formatCurrency(todayStats.upi)}
            </div>
            <p className="text-[11px] text-indigo-600 mt-1 font-medium">Direct digital receipts</p>
          </div>
        </div>
      </section>

      {/* Quick Navigation Cards */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Quick Management
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="p-3.5 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors flex flex-col items-center text-center shadow-2xs"
          >
            <ShoppingBag className="w-5 h-5 text-zinc-700 mb-1.5" />
            <span className="text-xs font-semibold text-zinc-900">Orders</span>
            <span className="text-[10px] text-zinc-400">History & Bills</span>
          </button>

          <button
            onClick={() => navigate('/menu')}
            className="p-3.5 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors flex flex-col items-center text-center shadow-2xs"
          >
            <UtensilsCrossed className="w-5 h-5 text-zinc-700 mb-1.5" />
            <span className="text-xs font-semibold text-zinc-900">Menu</span>
            <span className="text-[10px] text-zinc-400">Items & Rates</span>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="p-3.5 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors flex flex-col items-center text-center shadow-2xs"
          >
            <BarChart3 className="w-5 h-5 text-zinc-700 mb-1.5" />
            <span className="text-xs font-semibold text-zinc-900">Reports</span>
            <span className="text-[10px] text-zinc-400">Sales & Tax</span>
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
