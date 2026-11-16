import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase/config';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getOrdersFromIndexedDB } from '../../services/offline/indexedDb';
import { updateOrderKitchenStatus } from '../../services/orders/orderService';
import { Order, KitchenOrderStatus } from '../../types';
import { 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  Flame, 
  Bell, 
  UtensilsCrossed, 
  ShoppingBag, 
  Layers, 
  RefreshCw,
  Check,
  AlertTriangle
} from 'lucide-react';

export const KitchenOrdersPage: React.FC = () => {
  const { profile, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ACTIVE' | 'NEW' | 'PREPARING' | 'READY' | 'SERVED'>('ACTIVE');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;

    setLoading(true);

    // Initial load from IndexedDB
    getOrdersFromIndexedDB().then((local) => {
      if (local && local.length > 0) {
        setOrders(local);
        setLoading(false);
      }
    });

    // Real-time Firestore live listener
    try {
      const ordersCol = collection(db, 'businesses', profile.id, 'orders');
      const q = query(ordersCol, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const liveOrders: Order[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setOrders(liveOrders);
          setLoading(false);
        },
        (err) => {
          console.warn('Real-time kitchen orders listener fallback to local:', err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch {
      setLoading(false);
    }
  }, [profile?.id]);

  // Filter orders for the kitchen screen
  const filteredOrders = useMemo(() => {
    // Exclude voided and cancelled orders
    const validOrders = orders.filter((o) => o.status !== 'VOIDED' && o.status !== 'CANCELLED');

    return validOrders.filter((o) => {
      const kStatus = o.kitchenStatus || 'NEW';
      if (activeFilter === 'ACTIVE') {
        return kStatus === 'NEW' || kStatus === 'ACCEPTED' || kStatus === 'PREPARING';
      }
      if (activeFilter === 'NEW') return kStatus === 'NEW';
      if (activeFilter === 'PREPARING') return kStatus === 'ACCEPTED' || kStatus === 'PREPARING';
      if (activeFilter === 'READY') return kStatus === 'READY';
      if (activeFilter === 'SERVED') return kStatus === 'SERVED';
      return true;
    });
  }, [orders, activeFilter]);

  // Counts for tabs
  const statusCounts = useMemo(() => {
    const valid = orders.filter((o) => o.status !== 'VOIDED' && o.status !== 'CANCELLED');
    let active = 0, newCount = 0, preparing = 0, ready = 0, served = 0;

    valid.forEach((o) => {
      const s = o.kitchenStatus || 'NEW';
      if (s === 'NEW') { newCount++; active++; }
      else if (s === 'ACCEPTED' || s === 'PREPARING') { preparing++; active++; }
      else if (s === 'READY') { ready++; }
      else if (s === 'SERVED') { served++; }
    });

    return { active, newCount, preparing, ready, served };
  }, [orders]);

  const handleUpdateStatus = async (order: Order, nextStatus: KitchenOrderStatus) => {
    if (!profile?.id) return;
    setUpdatingOrderId(order.id);
    try {
      await updateOrderKitchenStatus(profile.id, order.id, nextStatus, {
        performedBy: user?.displayName || 'Cook',
      });
    } catch (err: any) {
      alert(`Could not update kitchen status: ${err.message || 'Error'}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleToggleItemStatus = async (order: Order, itemIdx: number) => {
    if (!profile?.id) return;
    const currentItem = order.items[itemIdx];
    const isReady = currentItem?.kitchenStatus === 'READY';
    const nextItemStatus: KitchenOrderStatus = isReady ? 'PREPARING' : 'READY';

    try {
      await updateOrderKitchenStatus(profile.id, order.id, order.kitchenStatus || 'PREPARING', {
        itemIndex: itemIdx,
        itemStatus: nextItemStatus,
        performedBy: user?.displayName || 'Cook',
      });
    } catch (err: any) {
      console.warn('Could not toggle item ready status:', err);
    }
  };

  // Helper for elapsed time
  const getElapsedString = (createdAt: string) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m ago`;
  };

  return (
    <div className="space-y-4 w-full min-w-0 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#E5EAE6] rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#EAF5EF] border border-[#CFE5D8] text-[#145C43] flex items-center justify-center font-bold shadow-xs">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#202923] tracking-tight">Kitchen Orders</h1>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Live Sync
              </span>
            </div>
            <p className="hidden md:block text-xs text-[#68736D] mt-0.5">
              Live preparation tickets, food variants and order readiness tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-600" />
            <span>{statusCounts.active} To Prepare</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs (Mobile-friendly min 48px) */}
      <div className="bg-white border border-[#E5EAE6] rounded-2xl p-2.5 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveFilter('ACTIVE')}
            className={`min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
              activeFilter === 'ACTIVE'
                ? 'bg-[#145C43] text-white shadow-xs'
                : 'bg-zinc-100 text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43]'
            }`}
          >
            <span>Active Orders</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeFilter === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
              {statusCounts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('NEW')}
            className={`min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
              activeFilter === 'NEW'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-zinc-100 text-[#68736D] hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            <span>New Tickets</span>
            {statusCounts.newCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/20 text-white font-black">
                {statusCounts.newCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('PREPARING')}
            className={`min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
              activeFilter === 'PREPARING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-zinc-100 text-[#68736D] hover:bg-amber-50 hover:text-amber-700'
            }`}
          >
            <span>Preparing</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeFilter === 'PREPARING' ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
              {statusCounts.preparing}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('READY')}
            className={`min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
              activeFilter === 'READY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-zinc-100 text-[#68736D] hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            <span>Ready for Pickup</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeFilter === 'READY' ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
              {statusCounts.ready}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('SERVED')}
            className={`min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex items-center gap-2 ${
              activeFilter === 'SERVED'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'bg-zinc-100 text-[#68736D] hover:bg-zinc-200 hover:text-[#202923]'
            }`}
          >
            <span>Completed / Served</span>
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#68736D] space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#145C43]" />
          <p>Syncing kitchen tickets...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-16 text-center bg-white border border-[#E5EAE6] rounded-2xl text-zinc-400 text-xs space-y-2">
          <ChefHat className="w-10 h-10 mx-auto text-zinc-300 mb-1" />
          <p className="font-bold text-sm text-[#202923]">No kitchen orders found</p>
          <p className="text-[#68736D]">
            {activeFilter === 'ACTIVE' 
              ? 'All incoming orders have been prepared and served!' 
              : `No orders matching filter "${activeFilter}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredOrders.map((ord) => {
            const kStatus: KitchenOrderStatus = ord.kitchenStatus || 'NEW';
            const isNew = kStatus === 'NEW';
            const isAccepted = kStatus === 'ACCEPTED';
            const isPreparing = kStatus === 'PREPARING';
            const isReady = kStatus === 'READY';
            const isServed = kStatus === 'SERVED';
            const isBusy = updatingOrderId === ord.id;

            // Delayed warning if older than 15 mins and not ready
            const minsAgo = Math.floor((Date.now() - new Date(ord.createdAt).getTime()) / 60000);
            const isDelayed = minsAgo >= 15 && !isReady && !isServed;

            return (
              <div
                key={ord.id}
                className={`bg-white border rounded-2xl shadow-2xs flex flex-col justify-between overflow-hidden transition-all ${
                  isNew
                    ? 'border-rose-400 ring-2 ring-rose-200/50'
                    : isPreparing
                    ? 'border-amber-300'
                    : isReady
                    ? 'border-emerald-400 bg-emerald-50/10'
                    : isServed
                    ? 'border-zinc-200 opacity-70'
                    : 'border-[#E5EAE6]'
                }`}
              >
                {/* Order Top Bar */}
                <div className={`p-4 border-b ${
                  isNew ? 'bg-rose-50/70 border-rose-200' :
                  isPreparing ? 'bg-amber-50/70 border-amber-200' :
                  isReady ? 'bg-emerald-50/70 border-emerald-200' :
                  'bg-zinc-50 border-[#E5EAE6]'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-[#202923] bg-white border border-zinc-200 px-2.5 py-1 rounded-lg shadow-2xs">
                        {ord.billNumber}
                      </span>
                      {ord.tableNumber && (
                        <span className="font-bold text-xs text-indigo-950 bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg">
                          {ord.tableNumber}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-[#68736D] bg-white border border-[#E5EAE6] px-2 py-0.5 rounded-md uppercase">
                        {ord.orderType || 'Dine In'}
                      </span>
                    </div>

                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isNew ? 'bg-rose-600 text-white' :
                      isAccepted ? 'bg-indigo-600 text-white' :
                      isPreparing ? 'bg-amber-600 text-white' :
                      isReady ? 'bg-emerald-600 text-white' :
                      'bg-zinc-600 text-white'
                    }`}>
                      {kStatus}
                    </span>
                  </div>

                  {/* Timing & Delay info */}
                  <div className="flex items-center justify-between text-xs text-[#68736D] pt-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{getElapsedString(ord.createdAt)}</span>
                    </div>

                    {isDelayed && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>{minsAgo}m waiting</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Items Preparation Checklist */}
                <div className="p-4 space-y-2.5 flex-1">
                  <div className="space-y-2">
                    {ord.items.map((item, idx) => {
                      const itemReady = item.kitchenStatus === 'READY';

                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleItemStatus(ord, idx)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] ${
                            itemReady
                              ? 'bg-emerald-50/60 border-emerald-200 line-through opacity-75'
                              : 'bg-white border-[#E5EAE6] hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Quantity Badge */}
                            <span className="w-8 h-8 rounded-lg bg-[#EAF5EF] border border-[#CFE5D8] text-[#145C43] font-black text-xs flex items-center justify-center shrink-0">
                              {item.quantity}×
                            </span>

                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-[#202923] truncate">
                                {item.name}
                              </p>
                              {item.variantName && (
                                <span className="inline-block text-[11px] font-bold text-[#145C43] bg-[#EAF5EF] px-1.5 py-0.5 rounded mt-0.5">
                                  {item.variantName}
                                </span>
                              )}
                              {item.notes && (
                                <p className="text-[11px] text-amber-700 italic mt-0.5">
                                  Note: {item.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                              itemReady
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-zinc-300 text-transparent hover:text-zinc-300'
                            }`}
                            title="Toggle Item Ready"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {ord.kitchenNotes && (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900">
                      <strong>Kitchen Note:</strong> {ord.kitchenNotes}
                    </div>
                  )}
                </div>

                {/* Bottom Action Button (Touch friendly min 50px) */}
                <div className="p-3.5 bg-zinc-50 border-t border-[#E5EAE6]">
                  {isNew && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(ord, 'ACCEPTED')}
                      className="w-full min-h-[50px] bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isBusy ? 'Updating...' : 'Accept Order'}</span>
                    </button>
                  )}

                  {isAccepted && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(ord, 'PREPARING')}
                      className="w-full min-h-[50px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <Flame className="w-4 h-4" />
                      <span>{isBusy ? 'Updating...' : 'Start Preparing'}</span>
                    </button>
                  )}

                  {isPreparing && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(ord, 'READY')}
                      className="w-full min-h-[50px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isBusy ? 'Updating...' : 'Mark Order as Ready'}</span>
                    </button>
                  )}

                  {isReady && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUpdateStatus(ord, 'SERVED')}
                      className="w-full min-h-[50px] bg-zinc-800 hover:bg-zinc-900 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <UtensilsCrossed className="w-4 h-4" />
                      <span>{isBusy ? 'Updating...' : 'Mark as Served / Delivered'}</span>
                    </button>
                  )}

                  {isServed && (
                    <div className="flex items-center justify-between text-xs text-[#68736D]">
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Completed & Served
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(ord, 'PREPARING')}
                        className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 underline cursor-pointer"
                      >
                        Re-open
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
