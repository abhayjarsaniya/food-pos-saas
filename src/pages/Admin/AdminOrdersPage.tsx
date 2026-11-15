import React, { useEffect, useState, useMemo } from 'react';
import { getOrders } from '../../services/orders/orderService';
import { getAllShops } from '../../services/admin/superAdminService';
import { Order, ShopSummary } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { ShoppingBag, Search, Filter, Clock, Receipt, CheckCircle2 } from 'lucide-react';

export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShopFilter, setSelectedShopFilter] = useState('ALL');

  useEffect(() => {
    loadPlatformOrders();
  }, []);

  const loadPlatformOrders = async () => {
    try {
      const shopList = await getAllShops();
      setShops(shopList);

      const allOrders: Order[] = [];
      for (const s of shopList) {
        const ords = await getOrders(s.id);
        allOrders.push(...ords);
      }
      setOrders(allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedShopFilter !== 'ALL' && o.businessId !== selectedShopFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.billNumber.toLowerCase().includes(q) ||
          o.customer?.name?.toLowerCase().includes(q) ||
          o.customer?.phone?.includes(q)
        );
      }
      return true;
    });
  }, [orders, selectedShopFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Platform Orders Stream</h1>
        <p className="text-xs text-zinc-500">
          Real-time transaction stream across all registered shops and food counters
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Bill No or customer mobile..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 focus:bg-white text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#145C43]"
          />
        </div>

        <select
          value={selectedShopFilter}
          onChange={(e) => setSelectedShopFilter(e.target.value)}
          className="p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 self-start sm:self-center"
        >
          <option value="ALL">All Shops ({shops.length})</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400 text-xs">
          Loading platform order transactions...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-6">
          <ShoppingBag className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-700">No transactions recorded</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs text-xs">
          {filteredOrders.slice(0, 50).map((o) => (
            <div key={o.id} className="p-3.5 hover:bg-zinc-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-950">{o.billNumber}</span>
                    {o.isDemo && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                        DEMO
                      </span>
                    )}
                    <span className="text-zinc-500 font-medium">{o.customer?.name || 'Walk-in'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{formatDateTime(o.createdAt)}</span>
                    <span>•</span>
                    <span className="font-semibold text-zinc-700">{o.paymentMethod}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono font-bold text-sm text-zinc-950 block">
                  {formatCurrency(o.grandTotal)}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">
                  {o.paymentStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
