import React, { useEffect, useState } from 'react';
import { 
  seedDemoData, 
  resetDemoData, 
  DEMO_MENU_ITEMS, 
  DEMO_CUSTOMERS 
} from '../../services/admin/demoDataService';
import { getOrders } from '../../services/orders/orderService';
import { Order } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { 
  Database, 
  Sparkles, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  ShoppingBag, 
  AlertCircle 
} from 'lucide-react';

export const AdminDemoDataPage: React.FC = () => {
  const [demoOrders, setDemoOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const demoBusinessId = 'demo-business-owner-101';

  useEffect(() => {
    loadDemoOrders();
  }, []);

  const loadDemoOrders = async () => {
    try {
      const orders = await getOrders(demoBusinessId);
      const filtered = orders.filter((o) => o.isDemo);
      setDemoOrders(filtered);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setProcessing(true);
    setStatusMsg('Generating 60+ realistic orders across yesterday & today...');
    try {
      const res = await seedDemoData(demoBusinessId);
      setStatusMsg(`Successfully seeded ${res.ordersCreated} orders (${res.yesterdayCount} yesterday, ${res.todayCount} today)!`);
      await loadDemoOrders();
    } catch (err: any) {
      alert(err.message || 'Seeding failed');
      setStatusMsg(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset and clear all demo orders?')) return;
    setProcessing(true);
    try {
      const count = await resetDemoData(demoBusinessId);
      setStatusMsg(`Cleared ${count} demo orders.`);
      await loadDemoOrders();
    } catch {
      alert('Reset failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleRegenerate = async () => {
    setProcessing(true);
    setStatusMsg('Regenerating realistic demo order streams...');
    try {
      await resetDemoData(demoBusinessId);
      const res = await seedDemoData(demoBusinessId);
      setStatusMsg(`Regenerated ${res.ordersCreated} fresh orders (${res.yesterdayCount} yesterday, ${res.todayCount} today).`);
      await loadDemoOrders();
    } catch (err: any) {
      alert(err.message || 'Regeneration failed');
    } finally {
      setProcessing(false);
    }
  };

  const yesterdayCount = demoOrders.filter((o) => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return o.createdAt.startsWith(y.toISOString().split('T')[0]);
  }).length;

  const todayCount = demoOrders.filter((o) => {
    const t = new Date().toISOString().split('T')[0];
    return o.createdAt.startsWith(t);
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Demo Data Manager</h1>
          <p className="text-xs text-zinc-500">
            Generate and manage realistic historical billing data for the designated Demo Counter
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={processing}
            className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
            <span>Regenerate Data</span>
          </button>

          <button
            onClick={handleSeed}
            disabled={processing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>Seed 60+ Orders</span>
          </button>

          {demoOrders.length > 0 && (
            <button
              onClick={handleReset}
              disabled={processing}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
              title="Clear Demo Data"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Demo Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Total Demo Orders
          </span>
          <span className="text-2xl font-bold text-zinc-900 font-mono">{demoOrders.length}</span>
          <span className="text-[11px] text-zinc-400 block mt-1">Marked with isDemo: true</span>
        </div>

        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Yesterday's Target (32)
          </span>
          <span className="text-2xl font-bold text-emerald-600 font-mono">{yesterdayCount}</span>
          <span className="text-[11px] text-zinc-400 block mt-1">Historical orders generated</span>
        </div>

        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Today's Target (28)
          </span>
          <span className="text-2xl font-bold text-indigo-600 font-mono">{todayCount}</span>
          <span className="text-[11px] text-zinc-400 block mt-1">Active current day bills</span>
        </div>
      </div>

      {/* Data Specifications Box */}
      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2 text-xs text-zinc-600">
        <div className="flex items-center gap-2 font-bold text-zinc-900">
          <AlertCircle className="w-4 h-4 text-indigo-600" />
          <span>Safety & Financial Report Isolation Rules</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-zinc-500 text-[11px]">
          <li>Demo data is strictly pinned to designated Demo Business (`demo-business-owner-101`).</li>
          <li>Every document carries `isDemo: true` and is excluded from real platform billing.</li>
          <li>Realistic distribution covers 16 authentic Indian menu items, 25 diverse customer names, and accurate Cash/UPI/Card splits.</li>
          <li>Timestamps are dynamically calculated relative to the local business date.</li>
        </ul>
      </div>

      {/* Orders Preview List */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
          <h2 className="text-sm font-bold text-zinc-900">Seeded Demo Orders ({demoOrders.length})</h2>
          <span className="text-xs text-zinc-400">Latest 25 orders shown</span>
        </div>

        {demoOrders.length === 0 ? (
          <div className="text-center py-10 text-zinc-400 text-xs">
            No demo orders active. Click "Seed 60+ Orders" above.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 text-xs">
            {demoOrders.slice(0, 25).map((o) => (
              <div key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-950">{o.billNumber}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                      DEMO
                    </span>
                    <span className="text-zinc-500 font-medium">{o.customer?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    <span>{formatDateTime(o.createdAt)}</span>
                    <span>•</span>
                    <span>{o.paymentMethod} ({o.paymentStatus})</span>
                    <span>•</span>
                    <span>{o.items.length} items</span>
                  </div>
                </div>

                <div className="font-mono font-bold text-sm text-zinc-900">
                  {formatCurrency(o.grandTotal)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
