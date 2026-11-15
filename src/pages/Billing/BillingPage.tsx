import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useBilling } from '../../contexts/BillingContext';
import { getCategories, getMenuItems } from '../../services/business/businessService';
import { getTables, subscribeToTables, calculateTableStatuses } from '../../services/tables/tableService';
import { getOrders, subscribeToOrders } from '../../services/orders/orderService';
import { Category, MenuItem, MenuItemVariant, Order, PaymentMethod, PaymentStatus, RestaurantTable, TableWithStatus } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { shareBillToWhatsApp } from '../../services/whatsapp/whatsappService';
import { downloadReceiptPdf } from '../../services/pdf/receiptGenerator';
import { printReceiptInBrowser } from '../../utils/browserPrinter';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Receipt, 
  CreditCard, 
  Wallet, 
  QrCode, 
  User, 
  Phone, 
  X, 
  Share2, 
  Download, 
  CheckCircle2, 
  ChevronUp, 
  Sparkles,
  Edit2,
  Printer,
  Layers,
  UtensilsCrossed
} from 'lucide-react';

export const BillingPage: React.FC = () => {
  const { profile, settings, userRole, canCollectPayment } = useAuth();
  const {
    items,
    extras,
    customer,
    tableId,
    tableName,
    tableNumber,
    orderType,
    discountType,
    discountValue,
    paymentMethod,
    paymentStatus,
    amountPaid,
    isSubmitting,
    selectedCategory,
    searchQuery,
    editingOrderId,
    addItem,
    addCustomItem,
    updateItemQuantity,
    updateItemPrice,
    removeItem,
    addExtra,
    updateExtraQuantity,
    removeExtra,
    setTable,
    setTableNumber,
    setOrderType,
    clearBill,
    setCustomer,
    setDiscountType,
    setDiscountValue,
    setPaymentMethod,
    setPaymentStatus,
    setAmountPaid,
    setSelectedCategory,
    setSearchQuery,
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    grandTotal,
    balanceDue,
    saveBillAsUnpaid,
    checkoutBill,
  } = useBilling();

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // UI Modals & Sheets
  const [isCheckoutDrawerOpen, setIsCheckoutDrawerOpen] = useState(false);
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = useState(false);
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [tempPriceInput, setTempPriceInput] = useState<string>('');
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Custom Item Form State
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  // Extra Form State
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [extraQty, setExtraQty] = useState('1');

  // Table Management Integration
  const [customTables, setCustomTables] = useState<RestaurantTable[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  // Variant & MRP Selection State
  const [selectedItemForVariant, setSelectedItemForVariant] = useState<MenuItem | null>(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [selectedItemForMrp, setSelectedItemForMrp] = useState<MenuItem | null>(null);
  const [isMrpModalOpen, setIsMrpModalOpen] = useState(false);
  const [mrpPriceInput, setMrpPriceInput] = useState('');

  const handleItemClick = (item: MenuItem) => {
    if (!item.isActive || item.isAvailable === false) {
      alert('This item is currently disabled and cannot be added to bills.');
      return;
    }
    if (item.isPromotional && item.confirmationStatus === 'Needs Owner Confirmation' && !item.isActive) {
      alert('This anniversary promotional combo requires owner confirmation before live billing.');
      return;
    }
    if (item.priceType === 'mrp') {
      setSelectedItemForMrp(item);
      setMrpPriceInput('');
      setIsMrpModalOpen(true);
      return;
    }
    if (item.variants && item.variants.length > 0) {
      setSelectedItemForVariant(item);
      setIsVariantModalOpen(true);
      return;
    }
    addItem(item);
  };

  const quickExtraSuggestions = [
    { name: 'Extra Butter', price: 20 },
    { name: 'Extra Cheese', price: 35 },
    { name: 'Extra Curd / Dahi', price: 25 },
    { name: 'Extra Chutney', price: 15 },
    { name: 'Extra Sauce', price: 10 },
    { name: 'Extra Topping', price: 30 },
  ];

  useEffect(() => {
    if (!profile?.id) return;
    loadData();

    // Real-time table and order listeners
    const unsubOrders = subscribeToOrders(profile.id, (ords) => {
      setAllOrders(ords);
    });

    const unsubTables = subscribeToTables(profile.id, (tbls) => {
      setCustomTables(tbls);
    });

    return () => {
      unsubOrders();
      unsubTables();
    };
  }, [profile?.id]);

  const loadData = async () => {
    if (!profile?.id) return;
    try {
      const [cats, itemsList, tbls, ords] = await Promise.all([
        getCategories(profile.id),
        getMenuItems(profile.id),
        getTables(profile.id),
        getOrders(profile.id),
      ]);
      setCategories(cats);
      setMenuItems(itemsList);
      setCustomTables(tbls);
      setAllOrders(ords);
    } catch (err) {
      console.warn('Error loading billing data:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  // Live table statuses
  const activeTables = useMemo(() => {
    return customTables.filter(t => t.isActive !== false);
  }, [customTables]);

  const tablesWithLiveStatus = useMemo(() => {
    return calculateTableStatuses(activeTables, allOrders);
  }, [activeTables, allOrders]);

  // Filter menu items by active category & search query
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.isActive) return false;
      const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
      const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Map bill items for fast quantity lookups in menu card
  const billItemQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => map.set(i.itemId, i.quantity));
    return map;
  }, [items]);

  const handleCustomItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(customPrice);
    const qty = parseInt(customQty) || 1;
    if (!customName.trim() || isNaN(price) || price < 0) return;

    addCustomItem(customName.trim(), price, qty);
    setCustomName('');
    setCustomPrice('');
    setCustomQty('1');
    setIsCustomItemModalOpen(false);
  };

  const handleExtraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(extraPrice);
    const qty = parseInt(extraQty) || 1;
    if (!extraName.trim() || isNaN(price) || price < 0) return;

    addExtra(extraName.trim(), price, qty);
    setExtraName('');
    setExtraPrice('');
    setExtraQty('1');
    setIsExtraModalOpen(false);
  };

  const handlePriceEditSubmit = (itemId: string) => {
    const p = parseFloat(tempPriceInput);
    if (!isNaN(p) && p >= 0) {
      updateItemPrice(itemId, p);
    }
    setEditingPriceItemId(null);
  };

  // 1. Standard Indian Restaurant Flow: Save Bill as Open & Unpaid (Pay Later)
  const handleSaveUnpaidBill = async () => {
    try {
      const order = await saveBillAsUnpaid();
      setIsCheckoutDrawerOpen(false);
      setCompletedOrder(order);
    } catch (err: any) {
      alert(err.message || 'Saving bill failed. Please try again.');
    }
  };

  // 2. Direct Payment Collection (for customers who pay upfront)
  const handleCollectPaymentNow = async () => {
    try {
      const order = await checkoutBill({
        collectNow: true,
        method: paymentMethod,
        amount: paymentStatus === 'PARTIAL' ? amountPaid : grandTotal,
      });
      setIsCheckoutDrawerOpen(false);
      setCompletedOrder(order);
    } catch (err: any) {
      alert(err.message || 'Payment collection failed. Please try again.');
    }
  };

  const handleWhatsAppShare = async (order: Order) => {
    if (!profile) return;
    try {
      setShareFeedback('Generating receipt & opening WhatsApp...');
      const res = await shareBillToWhatsApp(order, profile, settings);
      setShareFeedback(res.message);
    } catch (err: any) {
      setShareFeedback('Sharing was cancelled or failed.');
    }
  };

  const handlePrintInBrowser = (order: Order, format: 'compact80' | 'compact58' | 'a4' = 'compact80') => {
    if (!profile) return;
    printReceiptInBrowser(order, profile, settings, format);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative min-h-[calc(100vh-8rem)] w-full min-w-0 max-w-full overflow-x-hidden pb-32 lg:pb-0">
      {/* LEFT / MAIN COLUMN: Menu Selection & Table Bar */}
      <div className="flex-1 flex flex-col space-y-3 min-w-0 max-w-full">
        {profile?.status === 'SUSPENDED' && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl flex items-center gap-3 text-rose-800">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse shrink-0"></span>
            <div>
              <p className="text-xs font-bold">Shop Account Suspended</p>
              <p className="text-[11px] text-rose-600">
                This counter is currently suspended by Super Admin. Order checkout is disabled.
              </p>
            </div>
          </div>
        )}

        {/* Table Selection – Dropdown Only */}
        <div className="p-3 bg-white border border-zinc-200/90 rounded-2xl shadow-2xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Order Type Toggle (Dine In, Takeaway, Parcel) */}
            <div className="flex items-center gap-1.5 p-1.5 bg-zinc-100 rounded-2xl w-full sm:w-fit">
              <button
                type="button"
                onClick={() => setOrderType('DINE_IN')}
                className={`flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                  orderType === 'DINE_IN'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Dine In
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('TAKEAWAY');
                }}
                className={`flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                  orderType === 'TAKEAWAY'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Takeaway
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('PARCEL');
                }}
                className={`flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                  orderType === 'PARCEL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Parcel
              </button>
            </div>

            {/* Current Selection Indicator */}
            <div className="text-xs font-medium text-zinc-500 flex items-center gap-1.5 px-1">
              <span>Selected:</span>
              <span className="font-bold text-zinc-900 font-mono text-sm">
                {orderType === 'TAKEAWAY' ? 'Takeaway' : orderType === 'PARCEL' ? 'Parcel' : (tableName || 'No Table Selected')}
              </span>
            </div>
          </div>

          {/* Proper Table Dropdown (Only dropdown) */}
          <div className="relative">
            <label htmlFor="table-dropdown-select" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Assigned Table
            </label>
            <div className="relative">
              <UtensilsCrossed className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="table-dropdown-select"
                value={tableId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setTable({ id: null, name: '' });
                  } else {
                    const found = customTables.find((t) => t.id === val);
                    if (found) {
                      setTable({ id: found.id, name: found.name });
                    }
                  }
                }}
                className="w-full pl-12 pr-10 min-h-[52px] bg-zinc-50 hover:bg-zinc-100/70 border border-zinc-300 rounded-2xl text-sm sm:text-base font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">No Table Selected</option>
                {activeTables.map((tbl) => {
                  const live = tablesWithLiveStatus.find((t) => t.id === tbl.id);
                  const statusNote = live?.status === 'PAYMENT_PENDING'
                    ? ' • [Payment Due]'
                    : live?.status === 'OCCUPIED'
                    ? ' • [Occupied]'
                    : ' • [Available]';
                  const seats = tbl.seatingCapacity ? ` (${tbl.seatingCapacity} seats)` : '';
                  return (
                    <option key={tbl.id} value={tbl.id}>
                      {tbl.name}{seats}{statusNote}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food, beverages, snacks..."
              className="w-full pl-11 pr-4 min-h-[50px] bg-zinc-100/90 hover:bg-zinc-100 focus:bg-white text-sm sm:text-base rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Add Extra Button */}
          <button
            type="button"
            onClick={() => setIsExtraModalOpen(true)}
            className="min-h-[50px] px-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ Extras</span>
          </button>

          {/* Add Custom Item Button */}
          <button
            type="button"
            onClick={() => setIsCustomItemModalOpen(true)}
            className="min-h-[50px] px-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Custom</span>
          </button>
        </div>

        {/* Horizontal Category Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`min-h-[46px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
              selectedCategory === null
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            All Items
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`min-h-[46px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                selectedCategory === cat.id
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Food Items Grid */}
        <div className="flex-1 overflow-y-auto">
          {loadingMenu ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-zinc-100 animate-pulse rounded-2xl border border-zinc-200"></div>
              ))}
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <p className="text-sm">No items found matching criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredMenuItems.map((item) => {
                const qtyInBill = billItemQtyMap.get(item.id) || 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 bg-white border rounded-2xl flex flex-col justify-between transition-all select-none cursor-pointer relative shadow-xs hover:shadow-sm active:scale-[0.98] min-h-[110px] ${
                      qtyInBill > 0 ? 'border-zinc-900 ring-2 ring-zinc-900' : 'border-zinc-200/90 hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                        />
                        {qtyInBill > 0 && (
                          <span className="text-[11px] font-bold bg-zinc-950 text-white px-2 py-0.5 rounded-full shadow-2xs">
                            x{qtyInBill}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-zinc-900 line-clamp-2 leading-snug">
                        {item.name}
                      </h3>
                      {item.variants && item.variants.length > 0 && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block mt-1">
                          {item.variants.filter((v) => v.isAvailable).length} Variants
                        </span>
                      )}
                      {item.priceType === 'mrp' && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-block mt-1">
                          MRP
                        </span>
                      )}
                      {item.isPromotional && (
                        <span className="text-[9px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md inline-block mt-1">
                          Promo Combo
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-100">
                      <span className="text-xs sm:text-sm font-bold text-zinc-950 font-mono">
                        {item.priceType === 'mrp' ? 'MRP' : formatCurrency(item.price)}
                      </span>
                      {qtyInBill > 0 ? (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => updateItemQuantity(item.id, -1)}
                            className="w-11 h-11 stepper-btn-mobile rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-900 flex items-center justify-center transition-all active:scale-90"
                            title="Decrease quantity"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <span className="text-base font-bold text-zinc-900 min-w-[24px] text-center">
                            {qtyInBill}
                          </span>
                          <button
                            onClick={() => updateItemQuantity(item.id, 1)}
                            className="w-11 h-11 stepper-btn-mobile rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center transition-all active:scale-90 shadow-2xs"
                            title="Increase quantity"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl hover:bg-emerald-100 transition-colors">
                          + Add
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT / DESKTOP SIDEBAR: Current Bill List & Summary */}
      <div className="hidden lg:flex flex-col w-96 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 shadow-xs h-fit sticky top-6">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-zinc-900" />
            <h2 className="text-sm font-bold text-zinc-900">Current Bill</h2>
            <span className="text-xs bg-zinc-200 px-2 py-0.5 rounded-full font-semibold text-zinc-700">
              {items.length + extras.length}
            </span>
            <span className="text-[10px] bg-zinc-900 text-white px-2 py-0.5 rounded font-mono">
              {tableNumber}
            </span>
          </div>

          {(items.length > 0 || extras.length > 0) && (
            <button
              onClick={() => clearBill()}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Bill Items & Extras List */}
        <div className="my-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {items.length === 0 && extras.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-xs">
              Bill is empty. Tap menu items or add extras.
            </div>
          ) : (
            <>
              {/* Regular items */}
              {items.map((item) => (
                <div
                  key={item.itemId}
                  className="p-2 bg-white border border-zinc-200 rounded-xl flex items-center justify-between shadow-2xs"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-zinc-900 truncate">
                        {item.name}
                      </p>
                      {item.isCustom && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 font-semibold px-1 py-0.2 rounded">
                          Custom
                        </span>
                      )}
                    </div>

                    {/* Temporary price override */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {editingPriceItemId === item.itemId ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            autoFocus
                            value={tempPriceInput}
                            onChange={(e) => setTempPriceInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePriceEditSubmit(item.itemId)}
                            className="w-16 px-1.5 py-0.5 text-xs border border-zinc-400 rounded bg-zinc-50"
                          />
                          <button
                            onClick={() => handlePriceEditSubmit(item.itemId)}
                            className="text-[10px] bg-zinc-900 text-white px-1.5 py-0.5 rounded"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPriceItemId(item.itemId);
                            setTempPriceInput(item.unitPrice.toString());
                          }}
                          className="text-[11px] text-zinc-400 hover:text-zinc-800 flex items-center gap-1 font-mono"
                          title="Edit price for this bill"
                        >
                          <span>{formatCurrency(item.unitPrice)} each</span>
                          <Edit2 className="w-2.5 h-2.5 text-zinc-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-zinc-100 rounded-xl p-1">
                      <button
                        onClick={() => updateItemQuantity(item.itemId, -1)}
                        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-zinc-700 hover:bg-white rounded-lg transition-all active:scale-90"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-bold text-zinc-900 w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateItemQuantity(item.itemId, 1)}
                        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-zinc-700 hover:bg-white rounded-lg transition-all active:scale-90"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <span className="text-xs font-bold text-zinc-900 font-mono w-14 text-right">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Custom Extras Section */}
              {extras.length > 0 && (
                <div className="pt-2 border-t border-dashed border-zinc-200">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                    Custom Extras ({extras.length})
                  </span>
                  {extras.map((ext) => (
                    <div
                      key={ext.id}
                      className="p-2 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between shadow-2xs mb-1.5"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-semibold text-amber-950 truncate">
                          + {ext.name}
                        </p>
                        <p className="text-[10px] text-amber-700 font-mono">
                          {formatCurrency(ext.unitPrice)} each
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-amber-200">
                          <button
                            onClick={() => updateExtraQuantity(ext.id, -1)}
                            className="w-4 h-4 flex items-center justify-center text-zinc-700 hover:bg-amber-100 rounded"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-xs font-bold text-zinc-900 w-3 text-center">
                            {ext.quantity}
                          </span>
                          <button
                            onClick={() => updateExtraQuantity(ext.id, 1)}
                            className="w-4 h-4 flex items-center justify-center text-zinc-700 hover:bg-amber-100 rounded"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        <span className="text-xs font-bold text-amber-950 font-mono w-14 text-right">
                          {formatCurrency(ext.lineTotal)}
                        </span>

                        <button
                          onClick={() => removeExtra(ext.id)}
                          className="text-amber-800 hover:text-rose-600 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Calculations Breakdown */}
        {(items.length > 0 || extras.length > 0) && (
          <div className="pt-2 border-t border-zinc-200 space-y-1 text-xs">
            <div className="flex justify-between text-zinc-500">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount:</span>
                <span className="font-mono">-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            {settings.tax.enabled && gstAmount > 0 && (
              <div className="flex justify-between text-zinc-500">
                <span>GST:</span>
                <span className="font-mono">{formatCurrency(gstAmount)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-bold text-zinc-950 pt-1.5 border-t border-zinc-300">
              <span>Grand Total:</span>
              <span className="font-mono text-base">{formatCurrency(grandTotal)}</span>
            </div>

            {/* DUAL WORKFLOW BUTTONS */}
            <div className="pt-2 space-y-2">
              {/* PRIMARY: Save as Open & Unpaid (Standard Indian Restaurant Flow) */}
              <button
                onClick={handleSaveUnpaidBill}
                disabled={isSubmitting}
                className="w-full py-3 bg-zinc-950 hover:bg-zinc-900 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Receipt className="w-4 h-4" />
                <span>Save Bill (Open & Unpaid)</span>
                <span>•</span>
                <span className="font-mono">{formatCurrency(grandTotal)}</span>
              </button>

              {/* SECONDARY: Instant Payment Collection */}
              {userRole === 'CASHIER' && !canCollectPayment ? (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-center text-[11px] text-amber-800 font-medium">
                  Payment collection restricted for this cashier account
                </div>
              ) : (
                <button
                  onClick={() => setIsCheckoutDrawerOpen(true)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Collect Payment Now</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE FIXED BOTTOM BILLING BAR */}
      {(items.length > 0 || extras.length > 0) && (
        <div className="lg:hidden fixed bottom-16 sm:bottom-18 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-zinc-200 z-30 shadow-2xl safe-bottom">
          <div className="flex items-center justify-between gap-2.5 max-w-lg mx-auto">
            <div className="min-w-0 pr-1">
              <p className="text-[11px] text-zinc-500 font-bold uppercase font-mono truncate">
                {tableNumber || tableName || 'Counter'} • {items.length + extras.length} Items
              </p>
              <p className="text-xl font-black text-zinc-950 font-mono tracking-tight leading-tight">
                {formatCurrency(grandTotal)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => clearBill()}
                className="w-12 h-12 rounded-2xl border border-zinc-200 text-zinc-400 hover:text-rose-600 flex items-center justify-center transition-all active:scale-90"
                title="Clear Bill"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              {/* Quick Save Unpaid on Mobile (Min 52px height) */}
              <button
                onClick={handleSaveUnpaidBill}
                disabled={isSubmitting}
                className="min-h-[52px] px-4 bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-sm sm:text-base rounded-2xl shadow-sm flex items-center gap-2 active:scale-95 transition-all"
              >
                <Receipt className="w-4 h-4" />
                <span>Save Bill</span>
              </button>

              {/* Collect Payment on Mobile (Min 52px height) */}
              {!(userRole === 'CASHIER' && !canCollectPayment) && (
                <button
                  onClick={() => setIsCheckoutDrawerOpen(true)}
                  className="min-h-[52px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-2xl shadow-sm flex items-center gap-2 active:scale-95 transition-all"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Pay</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT / DIRECT PAYMENT DRAWER */}
      {isCheckoutDrawerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Collect Payment</h3>
                <p className="text-xs text-zinc-500 font-mono">
                  {tableNumber} • Grand Total: {formatCurrency(grandTotal)}
                </p>
              </div>
              <button
                onClick={() => setIsCheckoutDrawerOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Optional Customer Info */}
            <div className="space-y-2.5 p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Customer Details (Optional)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customer.name || ''}
                    onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Customer Name"
                    className="w-full pl-10 pr-3 min-h-[48px] text-sm sm:text-base bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={customer.phone || ''}
                    onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Mobile (+91...)"
                    className="w-full pl-10 pr-3 min-h-[48px] text-sm sm:text-base bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>
            </div>

            {/* Discount Section */}
            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Discount
                </span>
                <div className="flex items-center gap-1 bg-zinc-200 rounded-xl p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`min-h-[36px] px-3 py-1 rounded-lg ${
                      discountType === 'fixed' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    ₹ Flat
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`min-h-[36px] px-3 py-1 rounded-lg ${
                      discountType === 'percentage' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    % Percent
                  </button>
                </div>
              </div>

              <input
                type="number"
                min="0"
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder={discountType === 'fixed' ? 'Enter flat discount (₹)' : 'Enter discount percentage (%)'}
                className="w-full px-3.5 min-h-[48px] text-sm sm:text-base bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
              />
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Payment Method
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'CASH' as PaymentMethod, label: 'Cash', icon: Wallet },
                  { id: 'UPI' as PaymentMethod, label: 'UPI / QR', icon: QrCode },
                  { id: 'CARD' as PaymentMethod, label: 'Card', icon: CreditCard },
                  { id: 'OTHER' as PaymentMethod, label: 'Other', icon: Receipt },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`min-h-[56px] p-2.5 rounded-2xl border flex flex-col items-center justify-center transition-all active:scale-95 ${
                        isSelected
                          ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1" />
                      <span className="text-xs sm:text-sm font-bold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Status (Full Paid vs Partial) */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Payment Mode
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('PAID')}
                  className={`min-h-[50px] py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold border transition-all active:scale-95 ${
                    paymentStatus === 'PAID'
                      ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                      : 'border-zinc-200 bg-white text-zinc-700'
                  }`}
                >
                  Full ({formatCurrency(grandTotal)})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus('PARTIAL')}
                  className={`min-h-[50px] py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold border transition-all active:scale-95 ${
                    paymentStatus === 'PARTIAL'
                      ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                      : 'border-zinc-200 bg-white text-zinc-700'
                  }`}
                >
                  Partial Advance
                </button>
              </div>

              {paymentStatus === 'PARTIAL' && (
                <div className="pt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">
                      Received Now (₹)
                    </label>
                    <input
                      type="number"
                      value={amountPaid || ''}
                      onChange={(e) => setAmountPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0.00"
                      className="w-full px-3.5 min-h-[48px] text-sm bg-white border border-zinc-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">
                      Balance Due (₹)
                    </label>
                    <div className="px-3.5 min-h-[48px] flex items-center text-sm bg-zinc-100 border border-zinc-200 rounded-xl font-mono font-bold text-rose-600">
                      {formatCurrency(balanceDue)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2.5">
              <button
                onClick={handleCollectPaymentNow}
                disabled={isSubmitting}
                className="w-full min-h-[54px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirm & Record Payment</span>
              </button>

              <button
                onClick={handleSaveUnpaidBill}
                disabled={isSubmitting}
                className="w-full min-h-[48px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs sm:text-sm rounded-2xl transition-colors active:scale-98"
              >
                Save as Unpaid Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST-ORDER SUCCESS & ACTIONS MODAL */}
      {completedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
              completedOrder.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
            }`}>
              {completedOrder.paymentStatus === 'PAID' ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : (
                <Receipt className="w-8 h-8" />
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-zinc-900">
                {completedOrder.paymentStatus === 'PAID' ? 'Payment Recorded & Bill Completed!' : 'Bill Saved (Payment Pending)'}
              </h3>
              <p className="text-xs text-zinc-500 font-mono mt-1">
                Bill No: {completedOrder.billNumber} • {completedOrder.tableNumber || 'No Table'} • Total: {formatCurrency(completedOrder.grandTotal)}
              </p>
              {completedOrder.paymentStatus !== 'PAID' && (
                <div className="mt-2 inline-block px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-xs font-bold font-mono">
                  Balance Due: {formatCurrency(completedOrder.balanceDue)}
                </div>
              )}
            </div>

            {shareFeedback && (
              <div className="p-2.5 bg-zinc-100 text-zinc-800 text-xs rounded-xl border border-zinc-200">
                {shareFeedback}
              </div>
            )}

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Browser Print Button (Dialog) */}
              <button
                onClick={() => handlePrintInBrowser(completedOrder, 'compact80')}
                className="min-h-[52px] px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-sm sm:text-base font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
              >
                <Printer className="w-5 h-5" />
                <span>Print Bill</span>
              </button>

              {/* WhatsApp Share Button */}
              <button
                onClick={() => handleWhatsAppShare(completedOrder)}
                className="min-h-[52px] px-3 bg-[#25D366] hover:bg-[#20ba59] text-white text-sm sm:text-base font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
              >
                <Share2 className="w-5 h-5" />
                <span>WhatsApp</span>
              </button>
            </div>

            {/* PDF Downloads */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => profile && downloadReceiptPdf(completedOrder, profile, settings, 'compact58')}
                className="min-h-[44px] px-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>58mm</span>
              </button>
              <button
                onClick={() => profile && downloadReceiptPdf(completedOrder, profile, settings, 'compact80')}
                className="min-h-[44px] px-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>80mm</span>
              </button>
              <button
                onClick={() => profile && downloadReceiptPdf(completedOrder, profile, settings, 'a4')}
                className="min-h-[44px] px-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>A4 Invoice</span>
              </button>
            </div>

            <button
              onClick={() => {
                setCompletedOrder(null);
                setShareFeedback(null);
              }}
              className="w-full min-h-[52px] bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold text-sm sm:text-base rounded-2xl transition-colors mt-2 active:scale-98"
            >
              Start Next Bill
            </button>
          </div>
        </div>
      )}

      {/* EXTRAS BOTTOM SHEET MODAL (Requirement 6) */}
      {isExtraModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-zinc-900">Add Extra Charge</h3>
              </div>
              <button
                onClick={() => setIsExtraModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Suggestions Chips */}
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                Quick Extras
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickExtraSuggestions.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => {
                      setExtraName(s.name);
                      setExtraPrice(s.price.toString());
                    }}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-amber-100 hover:text-amber-950 text-zinc-700 text-xs rounded-lg font-medium transition-colors"
                  >
                    {s.name} (₹{s.price})
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleExtraSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Extra Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  placeholder="e.g. Extra Butter, Extra Cheese"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={extraPrice}
                    onChange={(e) => setExtraPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={extraQty}
                    onChange={(e) => setExtraQty(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors shadow-2xs mt-2"
              >
                Add Extra to Bill
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM ITEM CREATION MODAL */}
      {isCustomItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">Add Custom Item</h3>
              <button
                onClick={() => setIsCustomItemModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCustomItemSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Item Description *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Special Gravy, Packaging Charge"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition-colors shadow-2xs mt-2"
              >
                Add Custom Item to Bill
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TABLE SELECTOR MODAL (GRID VIEW) */}
      {isTableModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div>
                <h3 className="text-base font-black text-zinc-900">Select Table for Order</h3>
                <p className="text-xs text-zinc-500">Tap any active table to assign it to this bill</p>
              </div>
              <button
                onClick={() => setIsTableModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Order Types */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setOrderType('TAKEAWAY');
                  setTable({ id: null, name: 'Takeaway' });
                  setIsTableModalOpen(false);
                }}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                  orderType === 'TAKEAWAY'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                Takeaway
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('PARCEL');
                  setTable({ id: null, name: 'Parcel' });
                  setIsTableModalOpen(false);
                }}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                  orderType === 'PARCEL'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                Parcel
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('DINE_IN');
                  setTable({ id: null, name: '' });
                  setIsTableModalOpen(false);
                }}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                  orderType === 'DINE_IN' && !tableNumber
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                No Table
              </button>
            </div>

            {/* Tables Grid */}
            <div className="pt-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
                Dine-In Tables
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {tablesWithLiveStatus.map((tbl) => {
                  const isSelected = orderType === 'DINE_IN' && (tableId === tbl.id || tableNumber === tbl.name);
                  const isAvailable = tbl.status === 'AVAILABLE';
                  const isPending = tbl.status === 'PAYMENT_PENDING';

                  return (
                    <button
                      key={tbl.id}
                      type="button"
                      onClick={() => {
                        setOrderType('DINE_IN');
                        setTable({ id: tbl.id, name: tbl.name });
                        setIsTableModalOpen(false);
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between min-h-[90px] transition-all ${
                        isSelected
                          ? 'border-zinc-950 bg-zinc-950 text-white shadow-md'
                          : isPending
                          ? 'border-amber-300 bg-amber-50/70 hover:bg-amber-100/70'
                          : !isAvailable
                          ? 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/70'
                          : 'border-zinc-200 bg-white hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 w-full">
                        <span className={`font-black text-sm truncate ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                          {tbl.name}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                            isAvailable ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-blue-500'
                          }`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] w-full pt-2">
                        <span className={isSelected ? 'text-zinc-300' : 'text-zinc-500'}>
                          {tbl.seatingCapacity ? `${tbl.seatingCapacity} seats` : 'Table'}
                        </span>
                        <span className={`font-bold ${
                          isSelected ? 'text-emerald-300' : isAvailable ? 'text-emerald-700' : isPending ? 'text-amber-700' : 'text-blue-700'
                        }`}>
                          {tbl.status.replace('_', ' ')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VARIANT SELECTION MODAL */}
      {isVariantModalOpen && selectedItemForVariant && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="font-bold text-base text-zinc-900">
                  {selectedItemForVariant.name}
                </h3>
                <p className="text-xs text-zinc-500">Select Price Variant</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsVariantModalOpen(false);
                  setSelectedItemForVariant(null);
                }}
                className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 py-1">
              {selectedItemForVariant.variants?.map((variant) => {
                const isAvailable = variant.isAvailable;
                const priceInRupees = variant.price > 1000 ? variant.price / 100 : variant.price;

                return (
                  <button
                    key={variant.variantId}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      addItem(selectedItemForVariant, variant);
                      setIsVariantModalOpen(false);
                      setSelectedItemForVariant(null);
                    }}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isAvailable
                        ? 'bg-zinc-50 hover:bg-zinc-900 hover:text-white border-zinc-200 hover:border-zinc-900 cursor-pointer shadow-2xs group'
                        : 'bg-zinc-100/60 border-zinc-200/60 text-zinc-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span className="font-bold text-sm">
                      {variant.name}
                    </span>
                    <span className="font-mono font-bold text-sm">
                      {isAvailable ? formatCurrency(priceInRupees) : 'Not Listed'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MRP MANUAL PRICE ENTRY MODAL */}
      {isMrpModalOpen && selectedItemForMrp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="font-bold text-base text-zinc-900">
                  {selectedItemForMrp.name}
                </h3>
                <p className="text-xs text-zinc-500">Enter MRP Price at Billing</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMrpModalOpen(false);
                  setSelectedItemForMrp(null);
                }}
                className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const priceNum = parseFloat(mrpPriceInput);
                if (!isNaN(priceNum) && priceNum > 0) {
                  addItem(selectedItemForMrp, undefined, priceNum);
                  setIsMrpModalOpen(false);
                  setSelectedItemForMrp(null);
                }
              }}
              className="space-y-4 pt-1"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  MRP Price (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  autoFocus
                  value={mrpPriceInput}
                  onChange={(e) => setMrpPriceInput(e.target.value)}
                  placeholder="e.g. 20 or 40"
                  className="w-full px-4 py-3 text-base font-mono font-bold bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
              >
                Add to Bill
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
