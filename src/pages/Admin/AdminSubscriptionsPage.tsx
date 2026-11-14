import React, { useEffect, useState } from 'react';
import { getAllShops, updateShopPlan } from '../../services/admin/superAdminService';
import { AccessPlan, ShopSummary } from '../../types';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { CreditCard, CheckCircle2, Calendar, ShieldCheck } from 'lucide-react';

export const AdminSubscriptionsPage: React.FC = () => {
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    try {
      const data = await getAllShops();
      setShops(data);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlan = async (shopId: string, plan: AccessPlan, days: number) => {
    const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    try {
      await updateShopPlan(shopId, plan, expiresAt);
      await loadShops();
    } catch {
      alert('Plan update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Subscriptions & Access Control</h1>
        <p className="text-xs text-zinc-500">
          Manage access tiers, validity renewals, and trial expirations for all tenant businesses
        </p>
      </div>

      {/* Plan Tiers Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        {[
          { name: '14-Day Trial', key: 'trial', desc: 'New registrations evaluation tier' },
          { name: 'Starter Counter', key: 'starter', desc: 'Single counter, up to 1000 bills/mo' },
          { name: 'Pro Counter', key: 'pro', desc: 'Unlimited billing, inventory & suppliers' },
          { name: 'Enterprise', key: 'enterprise', desc: 'Multi-outlet chain management' },
        ].map((tier) => {
          const count = shops.filter((s) => s.plan === tier.key).length;
          return (
            <div key={tier.key} className="p-4 bg-white border border-zinc-200/90 rounded-2xl shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                {tier.name}
              </span>
              <span className="text-2xl font-bold font-mono text-zinc-950 block my-1">
                {count} shops
              </span>
              <span className="text-[11px] text-zinc-500">{tier.desc}</span>
            </div>
          );
        })}
      </div>

      {/* Shops Subscription Table */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-zinc-900">Tenant Business Access Status</h2>

        {loading ? (
          <div className="text-center py-8 text-zinc-400 text-xs">Loading subscriptions...</div>
        ) : (
          <div className="divide-y divide-zinc-100 text-xs">
            {shops.map((s) => (
              <div key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900">{s.name}</span>
                    <span className="text-[10px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full uppercase font-mono font-bold">
                      {s.plan}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Owner: {s.ownerName} • {s.phone}</p>
                  <p className="text-[11px] text-zinc-400">
                    Expires on: {s.planExpiresAt ? formatDateTime(s.planExpiresAt) : '30 Days'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdatePlan(s.id, 'starter', 30)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-700"
                  >
                    +30d Starter
                  </button>
                  <button
                    onClick={() => handleUpdatePlan(s.id, 'pro', 90)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-950 hover:bg-zinc-800 rounded-lg text-white"
                  >
                    +90d Pro
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
