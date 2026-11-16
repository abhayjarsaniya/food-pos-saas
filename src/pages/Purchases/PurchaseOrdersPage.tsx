import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  createPurchaseOrder, 
  getPurchaseOrders, 
  recordGoodsReceipt, 
  recordSupplierPayment,
  cancelPurchaseOrder,
  updatePurchaseOrder,
  deleteDraftPurchaseOrder,
  duplicatePurchaseOrder
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
  Truck,
  Copy,
  Edit,
  Eye,
  Check,
  Building2,
  Calendar,
  PlusCircle,
  FileText
} from 'lucide-react';

export const PurchaseOrdersPage: React.FC = () => {
  const { profile } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPOId, setEditingPOId] = useState<string | null>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiptInputs, setReceiptInputs] = useState<Record<string, number>>({});

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingPO, setPayingPO] = useState<PurchaseOrder | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const [selectedPOForView, setSelectedPOForView] = useState<PurchaseOrder | null>(null);

  // Create/Edit PO Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPoItems] = useState<Array<{ inventoryItemId: string; quantity: number; unitCost: number }>>([]);
  const [poDiscount, setPoDiscount] = useState('0');
  const [poTax, setPoTax] = useState('0');
  const [poNotes, setPoNotes] = useState('');
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [updateDefaultPrices, setUpdateDefaultPrices] = useState(false);
  const [isSubmittingPO, setIsSubmittingPO] = useState(false);

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
          po.supplierName.toLowerCase().includes(q) ||
          po.items.some((i) => i.itemName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  // Open Create Modal (or Edit Draft Modal)
  const openCreateModal = (poToEdit?: PurchaseOrder) => {
    if (poToEdit) {
      setEditingPOId(poToEdit.id);
      setSelectedSupplierId(poToEdit.supplierId);
      setPoItems(
        poToEdit.items.map((it) => ({
          inventoryItemId: it.inventoryItemId,
          quantity: it.quantityOrdered,
          unitCost: it.unitCost,
        }))
      );
      setPoDiscount(poToEdit.discount?.toString() || '0');
      setPoTax(poToEdit.taxAmount?.toString() || '0');
      setPoNotes(poToEdit.notes || '');
      setPoExpectedDate(poToEdit.expectedDeliveryDate || '');
      setUpdateDefaultPrices(false);
    } else {
      setEditingPOId(null);
      setSelectedSupplierId(suppliers[0]?.id || '');
      setPoItems([]);
      setPoDiscount('0');
      setPoTax('0');
      setPoNotes('');
      setPoExpectedDate('');
      setUpdateDefaultPrices(false);
    }
    setIsCreateModalOpen(true);
  };

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
          ? { ...i, quantity: Math.max(0.01, qty), unitCost: Math.max(0, cost) }
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

  const handleSavePO = async (status: PurchaseOrderStatus = 'ORDERED') => {
    if (!profile || !selectedSupplierId || poItems.length === 0) {
      alert('Please select a supplier and add at least one material.');
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

    setIsSubmittingPO(true);
    try {
      if (editingPOId) {
        // Updating existing draft
        await updatePurchaseOrder(profile.id, editingPOId, {
          supplierId: sup.id,
          supplierName: sup.companyName,
          items: formattedItems,
          subtotal: poCalculations.subtotal,
          discount: parseFloat(poDiscount) || 0,
          taxAmount: parseFloat(poTax) || 0,
          totalAmount: poCalculations.total,
          balanceDue: poCalculations.total,
          status,
          expectedDeliveryDate: poExpectedDate,
          notes: poNotes.trim(),
        });
      } else {
        await createPurchaseOrder(profile.id, {
          supplierId: sup.id,
          supplierName: sup.companyName,
          items: formattedItems,
          subtotal: poCalculations.subtotal,
          discount: parseFloat(poDiscount) || 0,
          taxAmount: parseFloat(poTax) || 0,
          totalAmount: poCalculations.total,
          status,
          expectedDeliveryDate: poExpectedDate,
          notes: poNotes.trim(),
          updateDefaultPrices,
        });
      }

      await loadData();
      setIsCreateModalOpen(false);
      setEditingPOId(null);
      setPoItems([]);
    } catch (err: any) {
      alert(err.message || 'Failed to save purchase order');
    } finally {
      setIsSubmittingPO(false);
    }
  };

  const handleDuplicatePO = async (po: PurchaseOrder) => {
    if (!profile) return;
    try {
      const newPO = await duplicatePurchaseOrder(profile.id, po.id);
      alert(`Created draft copy #${newPO.poNumber}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate purchase order');
    }
  };

  const handleDeleteDraftPO = async (po: PurchaseOrder) => {
    if (!profile) return;
    if (!confirm(`Are you sure you want to permanently delete draft order #${po.poNumber}?`)) return;
    try {
      await deleteDraftPurchaseOrder(profile.id, po.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete draft purchase order');
    }
  };

  const handleMarkAsOrdered = async (po: PurchaseOrder) => {
    if (!profile) return;
    try {
      await updatePurchaseOrder(profile.id, po.id, { status: 'ORDERED' });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update purchase order');
    }
  };

  const handleCancelPO = async (po: PurchaseOrder) => {
    if (!profile) return;
    const reason = prompt(`Enter reason for cancelling #${po.poNumber}:`, 'Order cancelled by owner');
    if (reason === null) return;

    try {
      await cancelPurchaseOrder(profile.id, po.id, reason);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel purchase order');
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
    setPayNotes('');
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !payingPO) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount greater than zero.');
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
        notes: payNotes.trim(),
      });
      await loadData();
      setIsPaymentModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  return (
    <div className="space-y-6 w-full min-w-0 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#E5EAE6] rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#145C43]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#202923] tracking-tight">
              Purchase Orders
            </h1>
          </div>
          <p className="hidden md:block text-xs text-[#68736D] mt-0.5">
            Procure raw materials, record physical deliveries, and manage vendor payables
          </p>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="min-h-[46px] px-4 py-2 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-2xs w-fit cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Create Purchase Order</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E5EAE6] rounded-2xl p-4 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO # (e.g. PO-1001), vendor name, items..."
            className="w-full pl-9 pr-4 min-h-[44px] bg-[#F7F9F7] focus:bg-white text-xs sm:text-sm rounded-xl border border-[#E5EAE6] focus:outline-none focus:ring-2 focus:ring-[#145C43]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-semibold">
          {(['ALL', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'DRAFT', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[#145C43] text-white shadow-2xs font-bold'
                  : 'bg-[#F7F9F7] text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43] border border-[#E5EAE6]'
              }`}
            >
              {tab === 'ALL'
                ? 'All Orders'
                : tab === 'PARTIALLY_RECEIVED'
                ? 'Partially Received'
                : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Purchase Orders List - Multi-column responsive cards with ample width */}
      {loading ? (
        <div className="text-center py-12 text-[#68736D] text-xs">
          Loading purchase orders...
        </div>
      ) : filteredPOs.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-[#E5EAE6] rounded-2xl p-6">
          <ClipboardList className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-[#202923]">No purchase orders found</p>
          <p className="text-xs text-[#68736D] mt-1">
            Tap "+ Create Purchase Order" to start ordering ingredients from vendors.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredPOs.map((po) => {
            const isReceived = po.status === 'RECEIVED';
            const isPartial = po.status === 'PARTIALLY_RECEIVED';
            const isDraft = po.status === 'DRAFT';
            const isCancelled = po.status === 'CANCELLED';

            return (
              <div
                key={po.id}
                className="p-5 bg-white border border-[#E5EAE6] hover:border-[#CFE5D8] rounded-2xl shadow-2xs flex flex-col justify-between transition-all space-y-4"
              >
                <div>
                  {/* Top Bar: PO #, Statuses & Date */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[#202923] bg-[#F7F9F7] px-2.5 py-0.5 rounded-lg border border-[#E5EAE6]">
                          {po.poNumber}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            isReceived
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPartial
                              ? 'bg-blue-100 text-blue-800'
                              : po.status === 'ORDERED'
                              ? 'bg-amber-100 text-amber-900'
                              : isDraft
                              ? 'bg-zinc-100 text-zinc-700'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {po.status.replace('_', ' ')}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            po.paymentStatus === 'PAID'
                              ? 'bg-[#EAF5EF] text-[#145C43] border border-[#CFE5D8]'
                              : po.paymentStatus === 'PARTIAL'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-rose-50 text-rose-800'
                          }`}
                        >
                          {po.paymentStatus === 'PAID' ? 'Fully Paid' : po.paymentStatus === 'PARTIAL' ? 'Partially Paid' : 'Unpaid'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#68736D] mt-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#145C43]" />
                        <span className="font-bold text-[#202923] text-sm">{po.supplierName}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-extrabold font-mono text-[#202923] block">
                        {formatCurrency(po.totalAmount)}
                      </span>
                      {po.balanceDue > 0 ? (
                        <span className="text-xs text-rose-600 font-bold block">
                          Due: {formatCurrency(po.balanceDue)}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 font-bold block">
                          Cleared
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Order Timing Details */}
                  <div className="flex items-center gap-3 text-[11px] text-[#68736D] mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#929B95]" />
                      <span>Ordered: {formatDateTime(po.orderDate || po.createdAt)}</span>
                    </span>
                    {po.expectedDeliveryDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#929B95]" />
                        <span>Expected: {po.expectedDeliveryDate}</span>
                      </span>
                    )}
                  </div>

                  {/* Items Snapshot Table */}
                  <div className="mt-3 p-3 bg-[#F7F9F7] rounded-xl border border-[#E5EAE6] text-xs space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-[#68736D] uppercase tracking-wider pb-1 border-b border-[#E5EAE6]">
                      <span>Material / Item</span>
                      <span>Delivered / Ordered</span>
                    </div>
                    {po.items.map((it) => (
                      <div key={it.inventoryItemId} className="flex justify-between items-center text-[#202923]">
                        <span className="truncate pr-2 font-medium">
                          {it.itemName} <span className="text-[#68736D] font-normal">(@ {formatCurrency(it.unitCost)}/{it.unit})</span>
                        </span>
                        <span className="font-mono font-bold shrink-0">
                          <span className={it.quantityReceived >= it.quantityOrdered ? 'text-emerald-700' : 'text-amber-700'}>
                            {it.quantityReceived}
                          </span>
                          <span className="text-[#929B95]">/{it.quantityOrdered} {it.unit}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  {po.notes && (
                    <p className="text-[11px] text-[#68736D] mt-2 italic">
                      Notes: {po.notes}
                    </p>
                  )}
                </div>

                {/* Action Buttons Toolbar */}
                <div className="pt-3 border-t border-[#E5EAE6] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Receive Goods Action */}
                    {!isReceived && !isDraft && !isCancelled && (
                      <button
                        type="button"
                        onClick={() => openReceiptModal(po)}
                        className="min-h-[44px] px-3.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Receive Goods</span>
                      </button>
                    )}

                    {/* Pay Supplier Action */}
                    {po.balanceDue > 0 && !isDraft && !isCancelled && (
                      <button
                        type="button"
                        onClick={() => openPaymentModal(po)}
                        className="min-h-[44px] px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
                      >
                        <Wallet className="w-4 h-4" />
                        <span>Pay Supplier</span>
                      </button>
                    )}

                    {/* Draft Actions */}
                    {isDraft && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleMarkAsOrdered(po)}
                          className="min-h-[44px] px-3.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Place Order</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openCreateModal(po)}
                          className="min-h-[44px] px-3 bg-[#F7F9F7] hover:bg-[#EAF5EF] text-[#202923] text-xs font-semibold rounded-xl border border-[#E5EAE6] flex items-center gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteDraftPO(po)}
                          className="min-h-[44px] px-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Delete Draft"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Duplicate PO */}
                    <button
                      type="button"
                      onClick={() => handleDuplicatePO(po)}
                      className="min-h-[40px] px-2.5 bg-[#F7F9F7] hover:bg-[#EAF5EF] text-[#68736D] hover:text-[#145C43] text-xs font-semibold rounded-xl border border-[#E5EAE6] flex items-center gap-1 transition-colors"
                      title="Duplicate this purchase order"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Duplicate</span>
                    </button>

                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => setSelectedPOForView(po)}
                      className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43] rounded-xl transition-colors cursor-pointer border border-[#E5EAE6]"
                      title="View Full PO Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Cancel PO */}
                    {!isReceived && !isCancelled && !isDraft && (
                      <button
                        type="button"
                        onClick={() => handleCancelPO(po)}
                        className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-rose-200"
                        title="Cancel Order"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PURCHASE ORDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl my-8 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE6]">
              <div>
                <h3 className="text-lg font-bold text-[#202923]">
                  {editingPOId ? 'Edit Purchase Order Draft' : 'Create Purchase Order'}
                </h3>
                <p className="text-xs text-[#68736D]">Procure raw materials & ingredients from vendor</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#68736D] hover:bg-[#F7F9F7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-4">
              {/* Select Supplier */}
              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                  Supplier / Vendor *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs sm:text-sm bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                >
                  <option value="">Select a vendor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName} ({s.name} - {s.mobile})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Inventory Items */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#202923] uppercase tracking-wider">
                    Add Items / Materials *
                  </label>
                  <span className="text-[11px] text-[#68736D]">
                    {poItems.length} items added
                  </span>
                </div>

                <div className="flex gap-2 mb-3">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddItemToPO(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs sm:text-sm bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  >
                    <option value="">+ Choose raw material from inventory...</option>
                    {inventoryItems.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} (Unit: {inv.unit} | Suggested Cost: {formatCurrency(inv.purchasePrice || 0)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Items Table */}
                {poItems.length === 0 ? (
                  <div className="p-6 text-center bg-[#F7F9F7] border border-dashed border-[#E5EAE6] rounded-xl text-xs text-[#68736D]">
                    No items selected yet. Choose ingredients from the dropdown above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {poItems.map((pi) => {
                      const inv = inventoryItems.find((i) => i.id === pi.inventoryItemId);
                      if (!inv) return null;
                      const lineTot = round2(pi.quantity * pi.unitCost);
                      return (
                        <div
                          key={pi.inventoryItemId}
                          className="p-3 bg-white border border-[#E5EAE6] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-[#202923] truncate">
                              {inv.name}
                            </h4>
                            <p className="text-[11px] text-[#68736D]">
                              Unit: <span className="font-semibold">{inv.unit}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Quantity (supports decimal e.g. 2.5 kg) */}
                            <div>
                              <label className="text-[10px] text-[#68736D] uppercase block font-semibold">Qty</label>
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={pi.quantity}
                                onChange={(e) => handleUpdatePOItem(pi.inventoryItemId, parseFloat(e.target.value) || 0, pi.unitCost)}
                                className="w-20 px-2 py-1 text-xs border border-[#E5EAE6] rounded-lg font-mono font-bold bg-[#F7F9F7]"
                              />
                            </div>

                            {/* Unit Cost Editable */}
                            <div>
                              <label className="text-[10px] text-[#68736D] uppercase block font-semibold">Price (₹)</label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={pi.unitCost}
                                onChange={(e) => handleUpdatePOItem(pi.inventoryItemId, pi.quantity, parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 text-xs border border-[#E5EAE6] rounded-lg font-mono font-bold bg-[#F7F9F7]"
                              />
                            </div>

                            {/* Line Total */}
                            <div className="min-w-[70px] text-right">
                              <label className="text-[10px] text-[#68736D] uppercase block font-semibold">Total</label>
                              <span className="text-xs font-bold font-mono text-[#202923]">
                                {formatCurrency(lineTot)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemovePOItem(pi.inventoryItemId)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg ml-1"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Price update option */}
              {poItems.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-[#202923] cursor-pointer pt-1 select-none">
                  <input
                    type="checkbox"
                    checked={updateDefaultPrices}
                    onChange={(e) => setUpdateDefaultPrices(e.target.checked)}
                    className="w-4 h-4 rounded text-[#145C43] focus:ring-[#145C43]"
                  />
                  <span className="font-medium">
                    Update default purchase price in inventory for entered item costs
                  </span>
                </label>
              )}

              {/* Step 3: Discounts, Tax & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#202923] uppercase mb-1">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={poDiscount}
                    onChange={(e) => setPoDiscount(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#202923] uppercase mb-1">
                    Applicable Tax (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={poTax}
                    onChange={(e) => setPoTax(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#202923] uppercase mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poExpectedDate}
                    onChange={(e) => setPoExpectedDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-[#202923] uppercase mb-1">
                  Order Notes / Instructions
                </label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="e.g. Deliver before 7:00 AM, fresh batch only"
                  className="w-full px-3 py-1.5 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl"
                />
              </div>

              {/* Totals Summary */}
              <div className="p-3 bg-[#EAF5EF] border border-[#CFE5D8] rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#68736D] block">Subtotal: {formatCurrency(poCalculations.subtotal)}</span>
                  <span className="text-[#145C43] font-bold text-sm">
                    Grand Total: {formatCurrency(poCalculations.total)}
                  </span>
                </div>
                <div className="text-right text-[11px] text-[#68736D]">
                  Payment Status: <span className="font-bold text-rose-700">UNPAID</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-[#E5EAE6] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="min-h-[44px] px-4 text-xs font-semibold text-[#68736D] hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmittingPO}
                onClick={() => handleSavePO('DRAFT')}
                className="min-h-[44px] px-4 bg-zinc-100 hover:bg-zinc-200 text-[#202923] text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isSubmittingPO}
                onClick={() => handleSavePO('ORDERED')}
                className="min-h-[44px] px-5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                {isSubmittingPO ? 'Saving...' : 'Confirm & Mark Ordered'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE GOODS MODAL */}
      {isReceiptModalOpen && receivingPO && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAE6]">
              <div>
                <h3 className="text-base font-bold text-[#202923]">Receive Goods Intake</h3>
                <p className="text-xs text-[#68736D]">
                  PO: {receivingPO.poNumber} • {receivingPO.supplierName}
                </p>
              </div>
              <button onClick={() => setIsReceiptModalOpen(false)} className="p-1 text-[#68736D] hover:text-[#202923]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#68736D]">
              Enter the exact physical quantity delivered today. Stock will only increase by these confirmed received quantities.
            </p>

            <form onSubmit={handleReceiptSubmit} className="space-y-3">
              <div className="divide-y divide-[#E5EAE6] text-xs">
                {receivingPO.items.map((item) => {
                  const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
                  return (
                    <div key={item.inventoryItemId} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-[#202923]">{item.itemName}</span>
                        <span className="text-[11px] text-[#68736D] block">
                          Ordered: {item.quantityOrdered} {item.unit} | Prev Received: {item.quantityReceived} {item.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[#68736D] text-xs">Receiving:</span>
                        <input
                          type="number"
                          step="any"
                          max={remaining}
                          min="0"
                          value={receiptInputs[item.inventoryItemId] ?? remaining}
                          onChange={(e) =>
                            setReceiptInputs((prev) => ({
                              ...prev,
                              [item.inventoryItemId]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-20 px-2 py-1 text-center bg-[#F7F9F7] border border-[#E5EAE6] rounded font-mono font-bold"
                        />
                        <span className="text-[#68736D]">{item.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="min-h-[44px] flex-1 border border-[#E5EAE6] text-[#68736D] text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] flex-1 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAE6]">
              <div>
                <h3 className="text-sm font-bold text-[#202923]">Record Vendor Payment</h3>
                <p className="text-xs text-[#68736D]">{payingPO.supplierName}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-1 text-[#68736D] hover:text-[#202923]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3.5">
              <div className="p-3 bg-[#F7F9F7] rounded-xl text-xs space-y-1 border border-[#E5EAE6]">
                <div className="flex justify-between text-[#68736D]">
                  <span>PO Amount:</span>
                  <span className="font-mono">{formatCurrency(payingPO.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-[#68736D]">
                  <span>Already Paid:</span>
                  <span className="font-mono">{formatCurrency(payingPO.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-600 pt-1 border-t border-[#E5EAE6]">
                  <span>Outstanding Balance:</span>
                  <span className="font-mono">{formatCurrency(payingPO.balanceDue)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  autoFocus
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl font-mono font-bold focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                >
                  <option value="UPI">UPI / Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card / Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase mb-1">
                  Reference / UTR No
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UPI Ref / Cheque No"
                  className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="min-h-[44px] flex-1 border border-[#E5EAE6] text-[#68736D] text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] flex-1 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW FULL PO DETAILS MODAL */}
      {selectedPOForView && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-2xl p-6 shadow-2xl my-8 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE6]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#202923] bg-[#F7F9F7] px-2 py-0.5 rounded border">
                    {selectedPOForView.poNumber}
                  </span>
                  <span className="text-xs font-bold uppercase text-[#145C43] bg-[#EAF5EF] px-2 py-0.5 rounded-full">
                    {selectedPOForView.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#202923] mt-1">{selectedPOForView.supplierName}</h3>
              </div>
              <button
                onClick={() => setSelectedPOForView(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#68736D] hover:bg-[#F7F9F7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-[#F7F9F7] rounded-xl border border-[#E5EAE6]">
                <div>
                  <span className="text-[10px] text-[#68736D] uppercase block font-semibold">Order Date</span>
                  <span className="font-bold text-[#202923]">{formatDateTime(selectedPOForView.orderDate)}</span>
                </div>
                {selectedPOForView.expectedDeliveryDate && (
                  <div>
                    <span className="text-[10px] text-[#68736D] uppercase block font-semibold">Expected Date</span>
                    <span className="font-bold text-[#202923]">{selectedPOForView.expectedDeliveryDate}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-[#68736D] uppercase block font-semibold">Total Amount</span>
                  <span className="font-bold font-mono text-[#202923]">{formatCurrency(selectedPOForView.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#68736D] uppercase block font-semibold">Balance Due</span>
                  <span className={`font-bold font-mono ${selectedPOForView.balanceDue > 0 ? 'text-rose-600' : 'text-[#145C43]'}`}>
                    {formatCurrency(selectedPOForView.balanceDue)}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#202923] uppercase tracking-wider mb-2">Ordered Materials</h4>
                <div className="border border-[#E5EAE6] rounded-xl overflow-hidden divide-y divide-[#E5EAE6]">
                  <div className="bg-[#F7F9F7] p-2.5 font-bold text-[#68736D] grid grid-cols-12 text-[11px]">
                    <span className="col-span-5">Material</span>
                    <span className="col-span-2 text-center">Ordered</span>
                    <span className="col-span-2 text-center">Received</span>
                    <span className="col-span-3 text-right">Line Total</span>
                  </div>
                  {selectedPOForView.items.map((it) => (
                    <div key={it.inventoryItemId} className="p-2.5 grid grid-cols-12 items-center text-xs">
                      <span className="col-span-5 font-bold text-[#202923] truncate">
                        {it.itemName} <span className="font-normal text-[#68736D]">({it.unit})</span>
                      </span>
                      <span className="col-span-2 text-center font-mono">
                        {it.quantityOrdered}
                      </span>
                      <span className={`col-span-2 text-center font-mono font-bold ${it.quantityReceived >= it.quantityOrdered ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {it.quantityReceived}
                      </span>
                      <span className="col-span-3 text-right font-mono font-bold text-[#202923]">
                        {formatCurrency(it.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPOForView.notes && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-amber-950">
                  <span className="font-bold block text-[10px] uppercase">Notes:</span>
                  <span>{selectedPOForView.notes}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E5EAE6] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedPOForView(null)}
                className="min-h-[44px] px-5 bg-zinc-100 hover:bg-zinc-200 text-[#202923] text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
