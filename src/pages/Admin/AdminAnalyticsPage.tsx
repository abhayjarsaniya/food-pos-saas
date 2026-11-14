import React, { useEffect, useState, useMemo } from 'react';
import { getOrders } from '../../services/orders/orderService';
import { getAllShops } from '../../services/admin/superAdminService';
import { Order, ShopSummary } from '../../types';
import { formatCurrency, round2 } from '../../utils/calculations';
import { 
  BarChart3, 
  TrendingUp, 
  Wallet, 
  QrCode, 
  CreditCard, 
  Building2, 
  ShoppingBag,
  Award
} from 'lucide-react';

export const AdminAnalyticsPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const shopList = await getAllShops();
      setShops(shopList);

      const allOrders: Order[] = [];
      for (const s of shopList) {
        const ords = await getOrders(s.id);
        allOrders.push(...ords);
      }
      setOrders(allOrders);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().split('T')[0];

    return orders.filter((o) => {
      if (o.status === 'VOIDED') return false;
      if (dateFilter === 'today' && !o.createdAt.startsWith(todayStr)) return false;
      if (dateFilter === 'yesterday' && !o.createdAt.startsWith(yStr)) return false;
      if (dateFilter === 'week') {
        const diff = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 3600 * 24);
        if (diff > 7) return false;
      }
      return true;
    });
  }, [orders, dateFilter]);

  const summary = useMemo(() => {
    let sales = 0;
    let upi = 0;
    let cash = 0;
    let card = 0;

    filteredOrders.forEach((o) => {
      sales += o.grandTotal;
      if (o.paymentMethod === 'UPI') upi += o.grandTotal;
      else if (o.paymentMethod === 'CASH') cash += o.grandTotal;
      else card += o.grandTotal;
    });

    const count = filteredOrders.length;
    const aov = count > 0 ? round2(sales / count) : 0;

    return {
      sales: round2(sales),
      count,
      aov,
      upi: round2(upi),
      cash: round2(cash),
      card: round2(card),
    };
  }, [filteredOrders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Platform Sales Analytics</h1>
          <p className="text-xs text-zinc-500">
            Network transaction metrics, payment methods distribution and ticket performance
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-white border border-zinc-200 p-1.5 rounded-xl shadow-2xs">
          {(['all', 'today', 'yesterday', 'week'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDateFilter(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                dateFilter === tab ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="col-span-2 sm:col-span-1 bg-zinc-950 text-white p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Gross GMV</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold font-mono">{formatCurrency(summary.sales)}</span>
          <span className="text-[11px] text-zinc-400 block mt-1">{summary.count} completed bills</span>
        </div>

        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Network AOV
          </span>
          <span className="text-xl font-bold text-zinc-900 font-mono">
            {formatCurrency(summary.aov)}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-1">Average per customer ticket</span>
        </div>

        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">UPI Volume</span>
            <QrCode className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-xl font-bold text-zinc-900 font-mono">
            {formatCurrency(summary.upi)}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-1">Digital QR payments</span>
        </div>

        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Cash Volume</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-xl font-bold text-zinc-900 font-mono">
            {formatCurrency(summary.cash)}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-1">Counter cash drawer</span>
        </div>
      </div>

      {/* Payment Method Distribution */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-zinc-900">Payment Breakdown</h2>
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-zinc-100">
          {summary.sales > 0 && (
            <>
              <div
                style={{ width: `${(summary.upi / summary.sales) * 100}%` }}
                className="bg-indigo-600"
                title={`UPI: ${formatCurrency(summary.upi)}`}
              />
              <div
                style={{ width: `${(summary.cash / summary.sales) * 100}%` }}
                className="bg-emerald-600"
                title={`Cash: ${formatCurrency(summary.cash)}`}
              />
              <div
                style={{ width: `${(summary.card / summary.sales) * 100}%` }}
                className="bg-blue-600"
                title={`Card: ${formatCurrency(summary.card)}`}
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-6 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-600" />
            <span>UPI: {summary.sales > 0 ? Math.round((summary.upi / summary.sales) * 100) : 0}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600" />
            <span>Cash: {summary.sales > 0 ? Math.round((summary.cash / summary.sales) * 100) : 0}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600" />
            <span>Card / Other: {summary.sales > 0 ? Math.round((summary.card / summary.sales) * 100) : 0}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
