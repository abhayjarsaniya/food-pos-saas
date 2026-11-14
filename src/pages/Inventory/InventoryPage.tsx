import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  addInventoryItem, 
  adjustStock, 
  getInventoryItems, 
  getStockMovements, 
  updateInventoryItem 
} from '../../services/inventory/inventoryService';
import { getSuppliers } from '../../services/suppliers/supplierService';
import { InventoryItem, InventoryUnit, StockMovement, Supplier } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { 
  Boxes, 
  Plus, 
  Search, 
  AlertTriangle, 
  AlertCircle, 
  TrendingUp, 
  ArrowUpDown, 
  Edit, 
  History, 
  X, 
  Check, 
  Filter 
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'IN_STOCK'>('ALL');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [newStockInput, setNewStockInput] = useState('');
  const [adjustReason, setAdjustReason] = useState('Physical audit count');

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Item Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Dairy');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('kg');
  const [currentStock, setCurrentStock] = useState('');
  const [minimumStock, setMinimumStock] = useState('5');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [supplierName, setSupplierName] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  const loadData = async () => {
    if (!profile?.id) return;
    try {
      const [invList, movList, supList] = await Promise.all([
        getInventoryItems(profile.id),
        getStockMovements(profile.id, 50),
        getSuppliers(profile.id),
      ]);
      setItems(invList);
      setMovements(movList);
      setSuppliers(supList);
    } catch (err) {
      console.warn('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'ALL' && item.stockStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.sku && item.sku.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, statusFilter, searchQuery]);

  // Dashboard Stats
  const stats = useMemo(() => {
    const totalItems = items.length;
    const lowStock = items.filter((i) => i.stockStatus === 'LOW_STOCK').length;
    const outOfStock = items.filter((i) => i.stockStatus === 'OUT_OF_STOCK').length;
    const totalValuation = items.reduce((sum, i) => sum + i.currentStock * i.purchasePrice, 0);

    return { totalItems, lowStock, outOfStock, totalValuation };
  }, [items]);

  const openItemModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setCategory(item.category);
      setSku(item.sku || '');
      setUnit(item.unit);
      setCurrentStock(item.currentStock.toString());
      setMinimumStock(item.minimumStock.toString());
      setPurchasePrice(item.purchasePrice.toString());
      setSupplierName(item.supplierName || '');
    } else {
      setEditingItem(null);
      setName('');
      setCategory('Dairy');
      setSku('');
      setUnit('kg');
      setCurrentStock('0');
      setMinimumStock('5');
      setPurchasePrice('');
      setSupplierName(suppliers[0]?.companyName || '');
    }
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !name.trim()) return;

    const curr = parseFloat(currentStock) || 0;
    const min = parseFloat(minimumStock) || 0;
    const price = parseFloat(purchasePrice) || 0;

    try {
      if (editingItem) {
        await updateInventoryItem(profile.id, editingItem.id, {
          name: name.trim(),
          category: category.trim(),
          sku: sku.trim(),
          unit,
          currentStock: curr,
          minimumStock: min,
          purchasePrice: price,
          supplierName: supplierName.trim(),
        });
      } else {
        await addInventoryItem(profile.id, {
          name: name.trim(),
          category: category.trim(),
          sku: sku.trim(),
          unit,
          currentStock: curr,
          minimumStock: min,
          purchasePrice: price,
          supplierName: supplierName.trim(),
        });
      }
      await loadData();
      setIsItemModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save inventory item');
    }
  };

  const openAdjustModal = (item: InventoryItem) => {
    setAdjustingItem(item);
    setNewStockInput(item.currentStock.toString());
    setAdjustReason('Physical audit discrepancy');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !adjustingItem) return;
    const qty = parseFloat(newStockInput);
    if (isNaN(qty) || qty < 0) {
      alert('Please enter a valid stock quantity');
      return;
    }

    try {
      await adjustStock(profile.id, adjustingItem.id, qty, adjustReason);
      await loadData();
      setIsAdjustModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Stock adjustment failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Inventory Management</h1>
          <p className="text-xs text-zinc-500">
            Track ingredients, raw materials, stock levels, low-stock alerts & audit history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3.5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <History className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => openItemModal()}
            className="px-4 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Material</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Total Materials
          </span>
          <span className="text-2xl font-bold text-zinc-900 font-mono">{stats.totalItems}</span>
          <span className="text-[11px] text-zinc-400 block mt-1">Tracked SKU items</span>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/20 p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Low Stock</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <span className="text-2xl font-bold text-amber-900 font-mono">{stats.lowStock}</span>
          <span className="text-[11px] text-amber-700 block mt-1">Below minimum threshold</span>
        </div>

        <div className="bg-white border border-rose-200 bg-rose-50/20 p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Out of Stock</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <span className="text-2xl font-bold text-rose-900 font-mono">{stats.outOfStock}</span>
          <span className="text-[11px] text-rose-700 block mt-1">Zero quantity on counter</span>
        </div>

        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Stock Valuation</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-xl font-bold text-zinc-900 font-mono">
            {formatCurrency(stats.totalValuation)}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-1">Total at purchase cost</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search material name, category, SKU..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 focus:bg-white text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 self-start sm:self-center overflow-x-auto no-scrollbar">
          {(['ALL', 'LOW_STOCK', 'OUT_OF_STOCK', 'IN_STOCK'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab
                  ? 'bg-zinc-900 text-white shadow-2xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table / Cards */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400 text-xs">
          Loading inventory...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-6">
          <Boxes className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-700">No inventory items found</p>
          <p className="text-xs text-zinc-400 mt-1">
            Tap "+ Add Material" to register your raw materials.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => {
            const isOut = item.stockStatus === 'OUT_OF_STOCK';
            const isLow = item.stockStatus === 'LOW_STOCK';
            return (
              <div
                key={item.id}
                className={`p-4 bg-white border rounded-2xl shadow-2xs flex flex-col justify-between transition-all ${
                  isOut
                    ? 'border-rose-300 bg-rose-50/15'
                    : isLow
                    ? 'border-amber-300 bg-amber-50/15'
                    : 'border-zinc-200/90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-950">{item.name}</h3>
                      <p className="text-xs text-zinc-400 font-mono">
                        {item.category} {item.sku ? `• ${item.sku}` : ''}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOut
                          ? 'bg-rose-100 text-rose-700'
                          : isLow
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.stockStatus.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Stock Quantity Meter */}
                  <div className="mt-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-zinc-500">Current Stock</span>
                      <span className="text-lg font-bold font-mono text-zinc-950">
                        {item.currentStock} {item.unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Min Threshold: {item.minimumStock} {item.unit}</span>
                      <span>Rate: {formatCurrency(item.purchasePrice)}/{item.unit}</span>
                    </div>
                  </div>

                  {item.supplierName && (
                    <p className="text-[11px] text-zinc-400 mt-2 truncate">
                      Primary Supplier: <span className="text-zinc-600 font-medium">{item.supplierName}</span>
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <button
                    onClick={() => openAdjustModal(item)}
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Adjust Stock</span>
                  </button>

                  <button
                    onClick={() => openItemModal(item)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
                    title="Edit Item Details"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      {isAdjustModalOpen && adjustingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Adjust Stock Count</h3>
                <p className="text-xs text-zinc-500">{adjustingItem.name}</p>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="p-1 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3.5">
              <div className="p-3 bg-zinc-50 rounded-xl text-xs flex justify-between items-center">
                <span className="text-zinc-500">Recorded Stock:</span>
                <span className="font-bold font-mono text-zinc-900">
                  {adjustingItem.currentStock} {adjustingItem.unit}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  New Verified Quantity ({adjustingItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={newStockInput}
                  onChange={(e) => setNewStockInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl font-mono focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Mandatory Audit Reason *
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                >
                  <option value="Physical audit count">Physical audit count / routine verification</option>
                  <option value="Kitchen preparation usage">Kitchen bulk preparation usage</option>
                  <option value="Spillage or transit damage">Spillage or transit damage</option>
                  <option value="Shelf life expiry / spoilage">Shelf life expiry / spoilage</option>
                  <option value="Direct supplier intake adjustment">Direct intake adjustment</option>
                  <option value="Other discrepancy">Other discrepancy (audited)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-zinc-950 text-white text-xs font-bold rounded-xl shadow-2xs"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT MATERIAL MODAL */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-base font-bold text-zinc-900">
                {editingItem ? 'Edit Raw Material' : 'Add New Raw Material'}
              </h3>
              <button onClick={() => setIsItemModalOpen(false)} className="p-1 text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Full Cream Milk, Basmati Rice"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Dairy, Veg, Spices..."
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Measurement Unit *
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as InventoryUnit)}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="l">Litres (l)</option>
                    <option value="ml">Millilitres (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="packets">Packets</option>
                    <option value="boxes">Boxes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Current Qty
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Min Alert Qty
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Primary Supplier
                </label>
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                >
                  <option value="">None / Open Market</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.companyName}>
                      {s.companyName} ({s.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-zinc-950 text-white text-xs font-bold rounded-xl shadow-2xs"
                >
                  Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT TRAIL / STOCK MOVEMENTS MODAL */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-zinc-900" />
                <h3 className="text-base font-bold text-zinc-900">Stock Movements & Audit Trail</h3>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-1 text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {movements.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs">
                No stock movements logged yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 text-xs">
                {movements.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900">{m.itemName}</span>
                        <span className="text-[10px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded font-mono font-medium">
                          {m.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {m.reason} {m.referenceId ? `(${m.referenceId})` : ''}
                      </p>
                      <span className="text-[10px] text-zinc-400">{formatDateTime(m.createdAt)}</span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-mono font-bold text-sm ${
                          m.quantityChange > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </span>
                      <span className="text-[10px] text-zinc-400 block font-mono">
                        {m.previousStock} → {m.newStock}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
