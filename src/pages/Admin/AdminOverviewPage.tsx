import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllShops, getPlatformMetrics, updateShopStatus } from '../../services/admin/superAdminService';
import { seedDemoData } from '../../services/admin/demoDataService';
import { PlatformMetrics, ShopSummary } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { 
  Store, 
  ShoppingBag, 
  TrendingUp, 
  PlusCircle, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  ArrowRight,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

export const AdminOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [recentShops, setRecentShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedingStatus, setSeedingStatus] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [m, shops] = await Promise.all([
        getPlatformMetrics(),
        getAllShops(),
      ]);
      setMetrics(m);
      setRecentShops(shops.slice(0, 6));
    } catch (err) {
      console.warn('Error loading admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSeedDemo = async () => {
    setSeedingStatus('Seeding 60+ demo orders across yesterday & today...');
    try {
      const res = await seedDemoData('demo-business-owner-101');
      setSeedingStatus(`Seeded ${res.ordersCreated} orders (${res.yesterdayCount} yesterday, ${res.todayCount} today)!`);
      await loadData();
      setTimeout(() => setSeedingStatus(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Seeding failed');
      setSeedingStatus(null);
    }
  };

  const handleToggleShopStatus = async (shop: ShopSummary) => {
    const nextStatus = shop.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateShopStatus(shop.id, nextStatus);
      await loadData();
    } catch {
      alert('Failed to update shop status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Platform Command Center</h1>
          <p className="text-xs text-zinc-500">
            Multi-tenant SaaS oversight, shop management, platform sales volume & demo data
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickSeedDemo}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Seed 60+ Demo Orders</span>
          </button>

          <button
            onClick={() => navigate('/admin/create-shop')}
            className="px-3.5 py-2 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Create Shop</span>
          </button>
        </div>
      </div>

      {seedingStatus && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{seedingStatus}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Shops</span>
            <Store className="w-4 h-4 text-zinc-700" />
          </div>
          <span className="text-2xl font-bold text-zinc-900 font-mono">
            {metrics?.totalShops || 0}
          </span>
          <div className="flex items-center gap-2 text-[11px] mt-1">
            <span className="text-emerald-600 font-semibold">{metrics?.activeShops || 0} Active</span>
            <span>•</span>
            <span className="text-rose-600 font-semibold">{metrics?.suspendedShops || 0} Suspended</span>
          </div>
        </div>

        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Platform Orders</span>
            <ShoppingBag className="w-4 h-4 text-zinc-700" />
          </div>
          <span className="text-2xl font-bold text-zinc-900 font-mono">
            {metrics?.totalOrders || 0}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-1">Across all business counters</span>
        </div>

        <div className="bg-white border border-[#E5EAE6] text-[#202923] p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-[#68736D] mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Sales Volume</span>
            <span className="p-1 rounded-lg bg-[#EAF5EF] text-[#145C43]">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="text-xl font-bold font-mono text-[#145C43]">
            {formatCurrency(metrics?.totalSalesVolume || 0)}
          </span>
          <span className="text-[11px] text-[#929B95] block mt-1">Completed platform transactions</span>
        </div>

        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Registrations</span>
            <Users className="w-4 h-4 text-zinc-700" />
          </div>
          <span className="text-2xl font-bold text-zinc-900 font-mono">
            {metrics?.newRegistrationsThisMonth || 0}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium block mt-1">100% Onboarded</span>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => navigate('/admin/shops')}
          className="p-4 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-colors text-left flex items-center justify-between shadow-2xs"
        >
          <div>
            <h3 className="text-xs font-bold text-zinc-900">Manage All Shops</h3>
            <p className="text-[11px] text-zinc-400">Suspend, reactivate & set plans</p>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-400" />
        </button>

        <button
          onClick={() => navigate('/admin/demo-data')}
          className="p-4 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-colors text-left flex items-center justify-between shadow-2xs"
        >
          <div>
            <h3 className="text-xs font-bold text-zinc-900">Demo Data Manager</h3>
            <p className="text-[11px] text-zinc-400">Seed, reset & verify 60+ orders</p>
          </div>
          <Database className="w-4 h-4 text-zinc-400" />
        </button>

        <button
          onClick={() => navigate('/admin/orders')}
          className="p-4 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-colors text-left flex items-center justify-between shadow-2xs"
        >
          <div>
            <h3 className="text-xs font-bold text-zinc-900">All Platform Orders</h3>
            <p className="text-[11px] text-zinc-400">Live transaction stream</p>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Recent Registered Shops */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Registered Business Accounts</h2>
            <p className="text-xs text-zinc-500">Live overview of food counters and access plans</p>
          </div>

          <button
            onClick={() => navigate('/admin/shops')}
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-zinc-100">
          {recentShops.map((shop) => (
            <div key={shop.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center font-bold text-sm shrink-0">
                  {shop.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">{shop.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        shop.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {shop.status}
                    </span>
                    <span className="text-[10px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full font-mono uppercase font-semibold">
                      {shop.plan}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Owner: {shop.ownerName} • {shop.phone} • {shop.ownerEmail || 'No Email'}
                  </p>
                  <span className="text-[11px] text-zinc-400">
                    Registered: {formatDateTime(shop.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleToggleShopStatus(shop)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    shop.status === 'ACTIVE'
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {shop.status === 'ACTIVE' ? 'Suspend Shop' : 'Activate Shop'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
