import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  createPurchaseOrder, 
  getPurchaseOrders, 
  recordGoodsReceipt, 
  recordSupplierPayment 
} from '../../services/purchases/purchaseOrderService';
import { getSuppliers } from '../../services/suppliers/supplierService';
import { getInventoryItems } from '../../services/inventory/inventoryService';
import { 
  PurchaseOrder, 
  PurchaseOrderItem, 
  PurchaseOrderStatus, 
  Supplier, 
  InventoryItem, 
  PaymentMethod 
} from '../../types';
import { formatCurrency, round2 } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  PackageCheck, 
  Wallet, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Trash2, 
  ArrowRight,
  Truck
} from 'lucide-react';

export const PurchaseOrdersPage: React.FC = () => {
  const { profile } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiptInputs, setReceiptInputs] = useState<Record<string, number>>({});

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingPO, setPayingPO] = useState<PurchaseOrder | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('UPI');
  const [payRef, setPayRef] = useState('');

  // Create PO Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPoItems] = useState<Array<{ inventoryItemId: string; quantity: number; unitCost: number }>>([]);
  const [poDiscount, setPoDiscount] = useState('0');
  const [poTax, setPoTax] = useState('0');
  const [poNotes, setPoNotes] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  const loadData = async () => {
    if (!profile?.id) return;
    try {
      const [pos, sups, invs] = await Promise.all([
        getPurchaseOrders(profile.id),
        getSuppliers(profile.id),
        getInventoryItems(profile.id),
      ]);
      setPurchaseOrders(pos);
      setSuppliers(sups.filter((s) => !s.isArchived));
      setInventoryItems(invs);
    } catch (err) {
      console.warn('Error loading purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (statusFilter !== 'ALL' && po.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          po.poNumber.toLowerCase().includes(q) ||
          po.supplierName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  // Create PO helpers
  const handleAddItemToPO = (itemId: string) => {
    const inv = inventoryItems.find((i) => i.id === itemId);
    if (!inv) return;
    if (poItems.some((i) => i.inventoryItemId === itemId)) return;

    setPoItems((prev) => [
      ...prev,
      {
        inventoryItemId: itemId,
        quantity: 1,
        unitCost: inv.purchasePrice || 0,
      },
    ]);
  };

  const handleUpdatePOItem = (itemId: string, qty: number, cost: number) => {
    setPoItems((prev) =>
      prev.map((i) =>
        i.inventoryItemId === itemId
          ? { ...i, quantity: Math.max(1, qty), unitCost: Math.max(0, cost) }
          : i
      )
    );
  };

  const handleRemovePOItem = (itemId: string) => {
    setPoItems((prev) => prev.filter((i) => i.inventoryItemId !== itemId));
  };

  const poCalculations = useMemo(() => {
    const subtotal = poItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const disc = parseFloat(poDiscount) || 0;
    const tax = parseFloat(poTax) || 0;
    const total = Math.max(0, subtotal - disc + tax);
    return { subtotal: round2(subtotal), total: round2(total) };
  }, [poItems, poDiscount, poTax]);

  const handleCreatePOSubmit = async (status: PurchaseOrderStatus = 'ORDERED') => {
    if (!profile || !selectedSupplierId || poItems.length === 0) {
      alert('Please select a supplier and add at least one item');
      return;
    }

    const sup = suppliers.find((s) => s.id === selectedSupplierId);
    if (!sup) return;

    const formattedItems: PurchaseOrderItem[] = poItems.map((pi) => {
      const inv = inventoryItems.find((i) => i.id === pi.inventoryItemId)!;
      return {
        inventoryItemId: inv.id,
        itemName: inv.name,
        unit: inv.unit,
        quantityOrdered: pi.quantity,
        quantityReceived: 0,
        unitCost: pi.unitCost,
        lineTotal: round2(pi.quantity * pi.unitCost),
      };
    });

    try {
      await createPurchaseOrder(profile.id, {
        supplierId: sup.id,
        supplierName: sup.companyName,
        items: formattedItems,
        subtotal: poCalculations.subtotal,
        discount: parseFloat(poDiscount) || 0,
        taxAmount: parseFloat(poTax) || 0,
        totalAmount: poCalculations.total,
        status,
        notes: poNotes.trim(),
      });
      await loadData();
      setIsCreateModalOpen(false);
      setPoItems([]);
      setSelectedSupplierId('');
    } catch (err: any) {
      alert(err.message || 'Failed to create PO');
    }
  };

  // Goods Receipt Handlers
  const openReceiptModal = (po: PurchaseOrder) => {
    setReceivingPO(po);
    const defaults: Record<string, number> = {};
    po.items.forEach((item) => {
      const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
      defaults[item.inventoryItemId] = remaining;
    });
    setReceiptInputs(defaults);
    setIsReceiptModalOpen(true);
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !receivingPO) return;

    const payload = Object.entries(receiptInputs).map(([inventoryItemId, receivedNow]) => ({
      inventoryItemId,
      receivedNow: Number(receivedNow) || 0,
    }));

    try {
      await recordGoodsReceipt(profile.id, receivingPO.id, payload);
      await loadData();
      setIsReceiptModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to record receipt');
    }
  };

  // Supplier Payment Handlers
  const openPaymentModal = (po: PurchaseOrder) => {
    setPayingPO(po);
    setPayAmount(po.balanceDue.toString());
    setPayMethod('UPI');
    setPayRef('');
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !payingPO) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    try {
      await recordSupplierPayment(profile.id, {
        supplierId: payingPO.supplierId,
        supplierName: payingPO.supplierName,
        purchaseOrderId: payingPO.id,
        amount,
        paymentMethod: payMethod,
        paymentReference: payRef.trim(),
      });
      await loadData();
      setIsPaymentModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Purchase Orders</h1>
          <p className="text-xs text-zinc-500">
            Order inventory from suppliers, record partial/full deliveries and track vendor payments
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedSupplierId(suppliers[0]?.id || '');
            setPoItems([]);
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Purchase Order</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO number (e.g. PO-1001), supplier name..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 focus:bg-white text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#145C43]"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center overflow-x-auto no-scrollbar">
          {(['ALL', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'DRAFT'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab
                  ? 'bg-[#145C43] text-white shadow-2xs'
                  : 'bg-[#F7F9F7] text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43] border border-[#E5EAE6]'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Purchase Orders List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400 text-xs">
          Loading purchase orders...
        </div>
      ) : filteredPOs.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-6">
          <ClipboardList className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-700">No purchase orders found</p>
          <p className="text-xs text-zinc-400 mt-1">
            Tap "+ Create Purchase Order" to procure ingredients.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPOs.map((po) => {
            const isReceived = po.status === 'RECEIVED';
            const isPartial = po.status === 'PARTIALLY_RECEIVED';
            return (
              <div
                key={po.id}
                className="p-4 bg-white border border-zinc-200/90 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-zinc-950">{po.poNumber}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isReceived
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPartial
                          ? 'bg-blue-100 text-blue-800'
                          : po.status === 'ORDERED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {po.status.replace('_', ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        po.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700'
                          : po.paymentStatus === 'PARTIAL'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      Payment: {po.paymentStatus}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-zinc-800 mt-1">{po.supplierName}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>Ordered: {formatDateTime(po.orderDate)}</span>
                    <span>•</span>
                    <span>{po.items.length} items</span>
                  </div>

                  {/* Items summary */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {po.items.map((it) => (
                      <span
                        key={it.inventoryItemId}
                        className="text-[11px] bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md text-zinc-700"
                      >
                        {it.itemName}: {it.quantityReceived}/{it.quantityOrdered} {it.unit}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100 gap-2">
                  <div className="text-left md:text-right">
                    <span className="text-base font-bold font-mono text-zinc-950 block">
                      {formatCurrency(po.totalAmount)}
                    </span>
                    {po.balanceDue > 0 && (
                      <span className="text-xs text-rose-600 font-semibold block">
                        Due: {formatCurrency(po.balanceDue)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isReceived && po.status !== 'CANCELLED' && (
                      <button
                        onClick={() => openReceiptModal(po)}
                        className="px-3 py-1.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors shadow-2xs"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Receive Goods</span>
                      </button>
                    )}

                    {po.balanceDue > 0 && (
                      <button
                        onClick={() => openPaymentModal(po)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors shadow-2xs"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Pay Supplier</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-base font-bold text-zinc-900">New Purchase Order</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Select Supplier */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Select Supplier *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName} ({s.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Material to PO */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Add Raw Material from Inventory
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddItemToPO(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                >
                  <option value="">+ Select Material to Add</option>
                  {inventoryItems.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.unit}) - Default: ₹{inv.purchasePrice}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Items Table */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100 text-xs">
                <div className="bg-zinc-100 p-2.5 font-semibold text-zinc-700 grid grid-cols-12">
                  <span className="col-span-5">Material</span>
                  <span className="col-span-3 text-center">Quantity</span>
                  <span className="col-span-2 text-right">Cost (₹)</span>
                  <span className="col-span-2 text-right">Total</span>
                </div>

                {poItems.length === 0 ? (
                  <div className="p-6 text-center text-zinc-400">
                    No items added yet. Select a material above.
                  </div>
                ) : (
                  poItems.map((pi) => {
                    const inv = inventoryItems.find((i) => i.id === pi.inventoryItemId)!;
                    return (
                      <div key={pi.inventoryItemId} className="p-2.5 grid grid-cols-12 items-center">
                        <span className="col-span-5 font-semibold text-zinc-900 truncate">
                          {inv.name} <span className="text-zinc-400">({inv.unit})</span>
                        </span>
                        <div className="col-span-3 flex justify-center">
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={pi.quantity}
                            onChange={(e) =>
                              handleUpdatePOItem(pi.inventoryItemId, parseFloat(e.target.value) || 1, pi.unitCost)
                            }
                            className="w-16 px-1.5 py-1 text-center bg-zinc-50 border border-zinc-300 rounded font-mono"
                          />
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <input
                            type="number"
                            step="0.01"
                            value={pi.unitCost}
                            onChange={(e) =>
                              handleUpdatePOItem(pi.inventoryItemId, pi.quantity, parseFloat(e.target.value) || 0)
                            }
                            className="w-16 px-1.5 py-1 text-right bg-zinc-50 border border-zinc-300 rounded font-mono"
                          />
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1 font-mono font-bold text-zinc-900">
                          <span>{formatCurrency(pi.quantity * pi.unitCost)}</span>
                          <button
                            onClick={() => handleRemovePOItem(pi.inventoryItemId)}
                            className="text-zinc-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Discounts & Taxes */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-zinc-500 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    value={poDiscount}
                    onChange={(e) => setPoDiscount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Taxes / Delivery (₹)</label>
                  <input
                    type="number"
                    value={poTax}
                    onChange={(e) => setPoTax(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Total Calculation */}
              <div className="p-3 bg-zinc-50 rounded-xl flex justify-between items-center text-sm font-bold">
                <span className="text-zinc-600">Total Purchase Value:</span>
                <span className="text-base text-zinc-950 font-mono">
                  {formatCurrency(poCalculations.total)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleCreatePOSubmit('DRAFT')}
                  className="py-2.5 px-4 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl hover:bg-zinc-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleCreatePOSubmit('ORDERED')}
                  className="flex-1 py-2.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors"
                >
                  Confirm & Place Purchase Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE GOODS MODAL */}
      {isReceiptModalOpen && receivingPO && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Receive Goods Intake</h3>
                <p className="text-xs text-zinc-500">
                  PO: {receivingPO.poNumber} • {receivingPO.supplierName}
                </p>
              </div>
              <button onClick={() => setIsReceiptModalOpen(false)} className="p-1 text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-600">
              Enter the exact physical quantity delivered today. Stock will only increase by these confirmed received quantities.
            </p>

            <form onSubmit={handleReceiptSubmit} className="space-y-3">
              <div className="divide-y divide-zinc-100 text-xs">
                {receivingPO.items.map((item) => {
                  const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
                  return (
                    <div key={item.inventoryItemId} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-zinc-900">{item.itemName}</span>
                        <span className="text-[11px] text-zinc-400 block">
                          Ordered: {item.quantityOrdered} {item.unit} | Prev Received: {item.quantityReceived} {item.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 text-xs">Receiving Now:</span>
                        <input
                          type="number"
                          step="0.01"
                          max={remaining}
                          min="0"
                          value={receiptInputs[item.inventoryItemId] ?? remaining}
                          onChange={(e) =>
                            setReceiptInputs((prev) => ({
                              ...prev,
                              [item.inventoryItemId]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-20 px-2 py-1 text-center bg-zinc-50 border border-zinc-300 rounded font-mono font-bold"
                        />
                        <span className="text-zinc-500">{item.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors"
                >
                  Confirm & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER PAYMENT MODAL */}
      {isPaymentModalOpen && payingPO && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Record Vendor Payment</h3>
                <p className="text-xs text-zinc-500">{payingPO.supplierName}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-1 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3.5">
              <div className="p-3 bg-zinc-50 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-zinc-500">
                  <span>PO Amount:</span>
                  <span className="font-mono">{formatCurrency(payingPO.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Already Paid:</span>
                  <span className="font-mono">{formatCurrency(payingPO.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-600 pt-1 border-t border-zinc-200">
                  <span>Outstanding Balance:</span>
                  <span className="font-mono">{formatCurrency(payingPO.balanceDue)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl font-mono focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                >
                  <option value="UPI">UPI / Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card / Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Reference / UTR No
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UPI Ref / Cheque No"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#19865D] hover:bg-[#145C43] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
