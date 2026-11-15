import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Users, 
  Receipt, 
  ArrowRight, 
  Check, 
  X, 
  ChevronRight, 
  UtensilsCrossed, 
  RefreshCw,
  Sliders,
  DollarSign,
  Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBilling } from '../../contexts/BillingContext';
import { Order, RestaurantTable, TableStatus, TableWithStatus } from '../../types';
import { 
  getTables, 
  subscribeToTables,
  createTable, 
  updateTable, 
  deleteTable, 
  calculateTableStatuses 
} from '../../services/tables/tableService';
import { getOrders, subscribeToOrders } from '../../services/orders/orderService';
import { formatCurrency } from '../../utils/calculations';

export const TableManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { setTable, setOrderType, loadDraftOrder } = useBilling();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MANAGE'>('OVERVIEW');
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('table_mgmt_theme') as any) || 'light';
  });

  const handleSetTheme = (t: 'light' | 'dark' | 'system') => {
    setThemePreference(t);
    try {
      localStorage.setItem('table_mgmt_theme', t);
    } catch {}
  };

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [selectedTableForDetails, setSelectedTableForDetails] = useState<TableWithStatus | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCapacity, setFormCapacity] = useState<string>('4');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const businessId = profile?.id || 'demo-business-owner-101';

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedTables, fetchedOrders] = await Promise.all([
        getTables(businessId),
        getOrders(businessId),
      ]);
      setTables(fetchedTables);
      setOrders(fetchedOrders);
    } catch (err) {
      console.error('Failed to load table management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);

    const unsubTables = subscribeToTables(
      businessId,
      (tbls) => {
        setTables(tbls);
        setLoading(false);
      },
      (err) => {
        console.warn('Real-time tables subscription error:', err);
        setLoading(false);
      }
    );

    const unsubOrders = subscribeToOrders(
      businessId,
      (ords) => {
        setOrders(ords);
      },
      (err) => {
        console.warn('Real-time orders subscription error for tables:', err);
      }
    );

    return () => {
      unsubTables();
      unsubOrders();
    };
  }, [businessId]);

  // Calculate live statuses
  const tablesWithStatus = useMemo(() => {
    return calculateTableStatuses(tables, orders);
  }, [tables, orders]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tablesWithStatus.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (filterStatus === 'ALL') return true;
      if (filterStatus === 'AVAILABLE') return t.status === 'AVAILABLE';
      if (filterStatus === 'OCCUPIED') return t.status === 'OCCUPIED';
      if (filterStatus === 'PAYMENT_PENDING') return t.status === 'PAYMENT_PENDING';
      if (filterStatus === 'INACTIVE') return !t.isActive;
      return true;
    });
  }, [tablesWithStatus, searchQuery, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = tablesWithStatus.length;
    const available = tablesWithStatus.filter(t => t.isActive && t.status === 'AVAILABLE').length;
    const occupied = tablesWithStatus.filter(t => t.isActive && t.status === 'OCCUPIED').length;
    const paymentPending = tablesWithStatus.filter(t => t.isActive && t.status === 'PAYMENT_PENDING').length;
    const totalOutstanding = tablesWithStatus.reduce((sum, t) => sum + t.totalOutstanding, 0);

    return { total, available, occupied, paymentPending, totalOutstanding };
  }, [tablesWithStatus]);

  // Form Handlers
  const openCreateModal = () => {
    setEditingTable(null);
    setFormName('');
    setFormDescription('');
    setFormCapacity('4');
    setFormIsActive(true);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (table: RestaurantTable, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTable(table);
    setFormName(table.name);
    setFormDescription(table.description || '');
    setFormCapacity(table.seatingCapacity ? String(table.seatingCapacity) : '');
    setFormIsActive(table.isActive);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Table name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const capacityNum = formCapacity ? parseInt(formCapacity, 10) : undefined;

      if (editingTable) {
        await updateTable(businessId, editingTable.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          seatingCapacity: capacityNum && capacityNum > 0 ? capacityNum : undefined,
          isActive: formIsActive,
        });
      } else {
        await createTable(businessId, {
          name: formName.trim(),
          description: formDescription.trim(),
          seatingCapacity: capacityNum && capacityNum > 0 ? capacityNum : undefined,
          isActive: formIsActive,
        });
      }

      await loadData();
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save table.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async (table: RestaurantTable, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete table "${table.name}"?`)) {
      return;
    }

    try {
      await deleteTable(businessId, table.id, orders);
      await loadData();
      if (selectedTableForDetails?.id === table.id) {
        setSelectedTableForDetails(null);
      }
    } catch (err: any) {
      alert(err.message || 'Cannot delete table.');
    }
  };

  const handleToggleActive = async (table: RestaurantTable, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await updateTable(businessId, table.id, { isActive: !table.isActive });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update table status.');
    }
  };

  const handleStartBillForTable = (table: RestaurantTable) => {
    setTable({ id: table.id, name: table.name });
    setOrderType('DINE_IN');
    navigate('/billing');
  };

  const handleOpenDraftOrder = (order: Order) => {
    loadDraftOrder(order);
    navigate('/billing');
  };

  return (
    <div className={`min-h-screen pb-24 ${themePreference === 'dark' ? 'dark bg-slate-950 text-white' : 'bg-zinc-50 text-zinc-950'}`}>
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-800 sticky top-0 z-30 px-4 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-zinc-100 dark:bg-slate-800 text-zinc-900 dark:text-zinc-100 font-bold">
                <UtensilsCrossed className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white tracking-tight">
                  Table Management
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-slate-400">
                  Real-time restaurant table status, seating capacity & active bill tracking
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Theme Preference Selector (Default Light) */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-slate-800 p-1 rounded-2xl border border-zinc-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleSetTheme('light')}
                className={`min-h-[40px] px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                  themePreference === 'light'
                    ? 'bg-white text-zinc-950 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => handleSetTheme('dark')}
                className={`min-h-[40px] px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                  themePreference === 'dark'
                    ? 'bg-[#145C43] text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950'
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => handleSetTheme('system')}
                className={`min-h-[40px] px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                  themePreference === 'system'
                    ? 'bg-zinc-300 dark:bg-slate-600 text-zinc-950 dark:text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950'
                }`}
              >
                System
              </button>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl border border-zinc-200 dark:border-slate-700 hover:bg-zinc-100 dark:hover:bg-slate-800 text-zinc-700 dark:text-slate-300 transition-all flex items-center justify-center active:scale-90"
              title="Refresh status"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreateModal}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 min-h-[48px] rounded-2xl bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-sm shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Add Table</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs (Min 48px touch friendly) */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 mt-4">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex-1 sm:flex-initial px-5 min-h-[48px] text-xs sm:text-sm font-bold rounded-2xl transition-all active:scale-95 cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-[#145C43] text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-slate-800 text-[#68736D] dark:text-slate-400 hover:bg-[#EAF5EF] hover:text-[#145C43]'
            }`}
          >
            Live Tables Overview
          </button>
          <button
            onClick={() => setActiveTab('MANAGE')}
            className={`flex-1 sm:flex-initial px-5 min-h-[48px] text-xs sm:text-sm font-bold rounded-2xl transition-all active:scale-95 cursor-pointer ${
              activeTab === 'MANAGE'
                ? 'bg-[#145C43] text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-slate-800 text-[#68736D] dark:text-slate-400 hover:bg-[#EAF5EF] hover:text-[#145C43]'
            }`}
          >
            Manage & Settings
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Real-time Status Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div 
            onClick={() => setFilterStatus(filterStatus === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              filterStatus === 'AVAILABLE'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 shadow-xs'
                : 'bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-800 hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Available</span>
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-zinc-950 dark:text-white">
              {stats.available}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-slate-400 mt-0.5">
              Ready for guests
            </div>
          </div>

          <div 
            onClick={() => setFilterStatus(filterStatus === 'OCCUPIED' ? 'ALL' : 'OCCUPIED')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              filterStatus === 'OCCUPIED'
                ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 shadow-xs'
                : 'bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-800 hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Occupied</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-zinc-950 dark:text-white">
              {stats.occupied}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-slate-400 mt-0.5">
              Dining in progress
            </div>
          </div>

          <div 
            onClick={() => setFilterStatus(filterStatus === 'PAYMENT_PENDING' ? 'ALL' : 'PAYMENT_PENDING')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              filterStatus === 'PAYMENT_PENDING'
                ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-500 shadow-xs'
                : 'bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-800 hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Payment Due</span>
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-zinc-950 dark:text-white">
              {stats.paymentPending}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-slate-400 mt-0.5">
              Bill served / Unpaid
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Outstanding</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-zinc-950 dark:text-white">
              {formatCurrency(stats.totalOutstanding)}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-slate-400 mt-0.5">
              Across {stats.occupied + stats.paymentPending} active tables
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table by name or area..."
              className="w-full pl-9 pr-3 min-h-[44px] rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#145C43] text-zinc-950 dark:text-white font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'AVAILABLE', 'OCCUPIED', 'PAYMENT_PENDING'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors active:scale-95 cursor-pointer ${
                  filterStatus === st
                    ? 'bg-[#145C43] text-white shadow-2xs'
                    : 'bg-zinc-100 dark:bg-slate-800 text-[#68736D] dark:text-slate-400 hover:bg-[#EAF5EF] hover:text-[#145C43]'
                }`}
              >
                {st === 'ALL' ? 'All Tables' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: LIVE TABLES OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div>
            {filteredTables.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-800 p-8 text-center">
                <UtensilsCrossed className="w-12 h-12 text-zinc-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">No Tables Match Criteria</h3>
                <p className="text-xs text-zinc-500 dark:text-slate-400 mt-1">
                  Try adjusting your search or add a new table.
                </p>
                <button
                  onClick={openCreateModal}
                  className="mt-4 px-4 min-h-[44px] rounded-xl bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold cursor-pointer"
                >
                  Create Table Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredTables.map((tbl) => {
                  const isAvailable = tbl.status === 'AVAILABLE';
                  const isOccupied = tbl.status === 'OCCUPIED';
                  const isPending = tbl.status === 'PAYMENT_PENDING';

                  return (
                    <div
                      key={tbl.id}
                      onClick={() => setSelectedTableForDetails(tbl)}
                      className={`relative rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between min-h-[160px] ${
                        !tbl.isActive
                          ? 'bg-zinc-100/70 dark:bg-slate-900/40 border-dashed border-zinc-300 dark:border-slate-800 opacity-60'
                          : isAvailable
                          ? 'bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-800 hover:border-emerald-500'
                          : isOccupied
                          ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                          : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-base sm:text-lg text-zinc-950 dark:text-white truncate">
                            {tbl.name}
                          </h3>
                          {tbl.description && (
                            <p className="text-[11px] text-zinc-500 dark:text-slate-400 truncate">
                              {tbl.description}
                            </p>
                          )}
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border ${
                            isAvailable
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : isOccupied
                              ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400'
                              : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}
                        >
                          {isAvailable ? 'Available' : isOccupied ? 'Occupied' : 'Pending'}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="my-2">
                        {isAvailable ? (
                          <div className="flex items-center gap-1.5 text-zinc-400 dark:text-slate-500 text-xs">
                            <Users className="w-3.5 h-3.5" />
                            <span>{tbl.seatingCapacity ? `${tbl.seatingCapacity} Seats` : 'Seating table'}</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-slate-200">
                              <span>{tbl.activeOrders.length} Bill{tbl.activeOrders.length > 1 ? 's' : ''}</span>
                              <span className="text-zinc-950 dark:text-zinc-100 font-mono font-bold">
                                {formatCurrency(tbl.totalOutstanding)}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-slate-400 truncate">
                              {tbl.activeOrders[0]?.customer?.name || tbl.activeOrders[0]?.billNumber || 'Guest'}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-zinc-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-bold">
                        {isAvailable ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartBillForTable(tbl);
                            }}
                            className="w-full min-h-[44px] py-2 rounded-xl bg-[#145C43] hover:bg-[#0F4935] text-white font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Start Bill</span>
                          </button>
                        ) : (
                          <div className="w-full min-h-[44px] flex items-center justify-between text-zinc-700 dark:text-slate-300 px-1">
                            <span className="text-xs font-bold">View details</span>
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANAGE & CONFIGURE TABLES */}
        {activeTab === 'MANAGE' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Table Directory ({tables.length} Total)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add, rename, deactivate or delete tables
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Table</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTables.map((tbl) => (
                <div
                  key={tbl.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                        tbl.isActive
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                          : 'bg-red-50 text-red-500 dark:bg-red-950/40 opacity-70'
                      }`}
                    >
                      {tbl.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {tbl.name}
                        </h4>
                        {!tbl.isActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {tbl.seatingCapacity && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {tbl.seatingCapacity} seats
                          </span>
                        )}
                        {tbl.description && <span className="truncate max-w-[200px]">{tbl.description}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleToggleActive(tbl, e)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        tbl.isActive
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700'
                      }`}
                    >
                      {tbl.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={(e) => openEditModal(tbl, e)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                      title="Edit Table"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteTable(tbl, e)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-red-500"
                      title="Delete Table"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT TABLE */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">
                {editingTable ? 'Edit Table' : 'Add New Custom Table'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Table Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Table 07, VIP Lounge, Garden Table 02"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Unique name to identify the table at billing counter
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    placeholder="e.g. 4"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      formIsActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40'
                        : 'bg-slate-100 text-slate-500 border-slate-300'
                    }`}
                  >
                    {formIsActive ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    <span>{formIsActive ? 'Active' : 'Inactive'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description / Location (Optional)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. AC Family Section, Window View, Rooftop"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingTable ? 'Save Changes' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER / DETAILS MODAL FOR SELECTED TABLE */}
      {selectedTableForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    selectedTableForDetails.status === 'AVAILABLE'
                      ? 'bg-emerald-500'
                      : selectedTableForDetails.status === 'OCCUPIED'
                      ? 'bg-blue-500'
                      : 'bg-amber-500 animate-ping'
                  }`}
                />
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  {selectedTableForDetails.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTableForDetails(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Table Info Bar */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">
                    Status
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    {selectedTableForDetails.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">
                    Capacity
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {selectedTableForDetails.seatingCapacity ? `${selectedTableForDetails.seatingCapacity} Seats` : 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">
                    Outstanding
                  </span>
                  <span className="font-black text-sm text-primary-600 dark:text-primary-400">
                    {formatCurrency(selectedTableForDetails.totalOutstanding)}
                  </span>
                </div>
              </div>

              {/* Active Orders List */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  Active Bills On This Table ({selectedTableForDetails.activeOrders.length})
                </h4>

                {selectedTableForDetails.activeOrders.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    No active bills on this table. Ready to seat guests!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedTableForDetails.activeOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900 dark:text-white">
                              {ord.billNumber}
                            </span>
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                ord.paymentStatus === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.paymentStatus === 'PARTIAL'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {ord.paymentStatus}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {ord.customer?.name || 'Walk-in Guest'} • {ord.items.length} items
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-black text-sm text-slate-900 dark:text-white">
                            {formatCurrency(ord.grandTotal)}
                          </div>
                          {ord.balanceDue > 0 && (
                            <div className="text-[11px] font-bold text-red-600 dark:text-red-400">
                              Due: {formatCurrency(ord.balanceDue)}
                            </div>
                          )}
                          <button
                            onClick={() => handleOpenDraftOrder(ord)}
                            className="mt-1 text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline"
                          >
                            Open Bill →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    handleStartBillForTable(selectedTableForDetails);
                  }}
                  className="w-full min-h-[52px] rounded-2xl bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  <span>Start New Bill for {selectedTableForDetails.name}</span>
                </button>

                {selectedTableForDetails.totalOutstanding > 0 && (
                  <button
                    onClick={() => {
                      navigate('/pending-payments');
                    }}
                    className="w-full min-h-[48px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Collect Payments in Pending Payments Drawer</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
