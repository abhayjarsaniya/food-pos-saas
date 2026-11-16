import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  addSupplier, 
  deleteSupplier,
  getSuppliers, 
  toggleArchiveSupplier, 
  updateSupplier 
} from '../../services/suppliers/supplierService';
import { 
  getPurchaseOrders, 
  getSupplierPayments, 
  createPurchaseOrder,
  recordSupplierPayment
} from '../../services/purchases/purchaseOrderService';
import { getInventoryItems } from '../../services/inventory/inventoryService';
import { 
  Supplier, 
  PurchaseOrder, 
  SupplierPayment, 
  InventoryItem, 
  PurchaseOrderItem, 
  PurchaseOrderStatus,
  PaymentMethod 
} from '../../types';
import { formatCurrency, round2 } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { formatWhatsAppPhone } from '../../services/whatsapp/whatsappService';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  MessageSquare, 
  Mail, 
  MapPin, 
  Edit, 
  Archive, 
  Check, 
  X, 
  FileText, 
  AlertCircle,
  ExternalLink,
  Trash2,
  ClipboardList,
  Clock,
  Wallet,
  CheckCircle2,
  Calendar,
  Building2,
  Receipt,
  PlusCircle,
  ArrowRight
} from 'lucide-react';

export const SuppliersPage: React.FC = () => {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierForDetails, setSelectedSupplierForDetails] = useState<Supplier | null>(null);

  // Quick Create Purchase Order Modal
  const [isCreatePOModalOpen, setIsCreatePOModalOpen] = useState(false);
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState<string>('');
  const [poItems, setPoItems] = useState<Array<{ inventoryItemId: string; quantity: number; unitCost: number }>>([]);
  const [poDiscount, setPoDiscount] = useState('0');
  const [poTax, setPoTax] = useState('0');
  const [poNotes, setPoNotes] = useState('');
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [updateDefaultPrices, setUpdateDefaultPrices] = useState(false);
  const [isSubmittingPO, setIsSubmittingPO] = useState(false);

  // Quick Supplier Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Form State for Add/Edit Supplier
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [suppliedProducts, setSuppliedProducts] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Weekly');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  const loadData = async () => {
    if (!profile?.id) return;
    try {
      const [supList, poList, payList, invList] = await Promise.all([
        getSuppliers(profile.id),
        getPurchaseOrders(profile.id),
        getSupplierPayments(profile.id),
        getInventoryItems(profile.id),
      ]);
      setSuppliers(supList);
      setPurchaseOrders(poList);
      setPayments(payList);
      setInventoryItems(invList);
    } catch (err) {
      console.warn('Error loading suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (!showArchived && s.isArchived) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.companyName.toLowerCase().includes(q) ||
          s.mobile.includes(q) ||
          (s.suppliedProducts && s.suppliedProducts.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [suppliers, searchQuery, showArchived]);

  // Financial tallies per supplier
  const supplierFinancials = useMemo(() => {
    const map = new Map<string, { totalPurchases: number; amountPaid: number; balanceDue: number; poCount: number; lastDate?: string }>();
    suppliers.forEach((s) => map.set(s.id, { totalPurchases: 0, amountPaid: 0, balanceDue: 0, poCount: 0 }));

    purchaseOrders.forEach((po) => {
      if (po.status !== 'CANCELLED') {
        const cur = map.get(po.supplierId) || { totalPurchases: 0, amountPaid: 0, balanceDue: 0, poCount: 0 };
        cur.totalPurchases += po.totalAmount;
        cur.amountPaid += po.amountPaid;
        cur.balanceDue += po.balanceDue;
        cur.poCount += 1;
        if (!cur.lastDate || new Date(po.createdAt) > new Date(cur.lastDate)) {
          cur.lastDate = po.createdAt;
        }
        map.set(po.supplierId, cur);
      }
    });

    return map;
  }, [suppliers, purchaseOrders]);

  const openModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setName(supplier.name);
      setCompanyName(supplier.companyName);
      setMobile(supplier.mobile);
      setWhatsapp(supplier.whatsapp || supplier.mobile);
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setGstin(supplier.gstin || '');
      setSuppliedProducts(supplier.suppliedProducts || '');
      setPaymentTerms(supplier.paymentTerms || 'Weekly');
      setNotes(supplier.notes || '');
    } else {
      setEditingSupplier(null);
      setName('');
      setCompanyName('');
      setMobile('');
      setWhatsapp('');
      setEmail('');
      setAddress('');
      setGstin('');
      setSuppliedProducts('');
      setPaymentTerms('Weekly');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !name.trim() || !mobile.trim()) return;

    try {
      if (editingSupplier) {
        await updateSupplier(profile.id, editingSupplier.id, {
          name: name.trim(),
          companyName: companyName.trim() || name.trim(),
          mobile: mobile.trim(),
          whatsapp: whatsapp.trim() || mobile.trim(),
          email: email.trim(),
          address: address.trim(),
          gstin: gstin.trim().toUpperCase(),
          suppliedProducts: suppliedProducts.trim(),
          paymentTerms: paymentTerms.trim(),
          notes: notes.trim(),
        });
      } else {
        await addSupplier(profile.id, {
          name: name.trim(),
          companyName: companyName.trim() || name.trim(),
          mobile: mobile.trim(),
          whatsapp: whatsapp.trim() || mobile.trim(),
          email: email.trim(),
          address: address.trim(),
          gstin: gstin.trim().toUpperCase(),
          suppliedProducts: suppliedProducts.trim(),
          paymentTerms: paymentTerms.trim(),
          notes: notes.trim(),
        });
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save supplier');
    }
  };

  const handleToggleArchive = async (sup: Supplier) => {
    if (!profile) return;
    try {
      await toggleArchiveSupplier(profile.id, sup.id);
      await loadData();
    } catch {
      alert('Failed to update archive status');
    }
  };

  const handleDeleteSupplier = async (sup: Supplier) => {
    if (!profile) return;
    const hasPOs = purchaseOrders.some((po) => po.supplierId === sup.id);
    const prompt = hasPOs
      ? `"${sup.companyName}" has historical purchase orders. Archiving this supplier preserves past transaction and tax audit records. Proceed?`
      : `Are you sure you want to permanently delete supplier "${sup.companyName}"?`;
    if (!confirm(prompt)) return;

    try {
      const res = await deleteSupplier(profile.id, sup.id, hasPOs);
      alert(res.message);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete supplier');
    }
  };

  const openWhatsAppChat = (phone: string, supName: string) => {
    const cleanPhone = formatWhatsAppPhone(phone);
    const msg = encodeURIComponent(`Hello ${supName}, contacting regarding order from ${profile?.name || 'our food shop'}.`);
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  // Trigger Create PO for specific supplier
  const handleOpenCreatePO = (supplierId?: string) => {
    setSelectedSupplierForPO(supplierId || suppliers[0]?.id || '');
    setPoItems([]);
    setPoDiscount('0');
    setPoTax('0');
    setPoNotes('');
    setPoExpectedDate('');
    setUpdateDefaultPrices(false);
    setIsCreatePOModalOpen(true);
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
          ? { ...i, quantity: Math.max(0.1, qty), unitCost: Math.max(0, cost) }
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

  const handleSavePurchaseOrder = async (status: PurchaseOrderStatus = 'ORDERED') => {
    if (!profile || !selectedSupplierForPO || poItems.length === 0) {
      alert('Please select a supplier and add at least one material/product.');
      return;
    }

    const sup = suppliers.find((s) => s.id === selectedSupplierForPO);
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

      await loadData();
      setIsCreatePOModalOpen(false);
      setPoItems([]);
    } catch (err: any) {
      alert(err.message || 'Failed to save purchase order');
    } finally {
      setIsSubmittingPO(false);
    }
  };

  // Supplier Payment Handlers
  const handleOpenRecordPayment = (sup: Supplier, defaultAmount?: number) => {
    setPayingSupplier(sup);
    setPayAmount(defaultAmount ? defaultAmount.toString() : '');
    setPayMethod('UPI');
    setPayRef('');
    setPayNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleSubmitSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !payingSupplier) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount greater than zero.');
      return;
    }

    setIsSubmittingPay(true);
    try {
      await recordSupplierPayment(profile.id, {
        supplierId: payingSupplier.id,
        supplierName: payingSupplier.companyName,
        amount: amt,
        paymentMethod: payMethod,
        paymentReference: payRef.trim(),
        notes: payNotes.trim(),
      });

      await loadData();
      setIsPaymentModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to record supplier payment');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  return (
    <div className="space-y-6 w-full min-w-0 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#E5EAE6] rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#145C43]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#202923] tracking-tight">
              Suppliers & Vendors
            </h1>
          </div>
          <p className="hidden md:block text-xs text-[#68736D] mt-0.5">
            Manage raw material vendors, purchase orders, outstanding balances & WhatsApp communication
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Prominent Create Purchase Order button */}
          <button
            onClick={() => handleOpenCreatePO()}
            className="min-h-[46px] px-4 py-2 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-2xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Create Purchase Order</span>
          </button>

          <button
            onClick={() => openModal()}
            className="min-h-[46px] px-3.5 py-2 bg-[#EAF5EF] hover:bg-[#CFE5D8] text-[#145C43] text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 border border-[#CFE5D8] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E5EAE6] rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by vendor name, firm, products, phone..."
            className="w-full pl-9 pr-4 min-h-[44px] bg-[#F7F9F7] focus:bg-white text-xs sm:text-sm rounded-xl border border-[#E5EAE6] focus:outline-none focus:ring-2 focus:ring-[#145C43]"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-[#68736D] cursor-pointer self-start sm:self-center select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 rounded text-[#145C43] focus:ring-[#145C43]"
          />
          <span>Show Archived Suppliers</span>
        </label>
      </div>

      {/* Suppliers Grid - Responsive 1 to 3 columns with ample card width */}
      {loading ? (
        <div className="text-center py-12 text-[#68736D] text-xs">
          Loading suppliers...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-[#E5EAE6] rounded-2xl p-6">
          <Truck className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-[#202923]">No suppliers found</p>
          <p className="text-xs text-[#68736D] mt-1">
            Tap "+ Add Supplier" or "+ Create Purchase Order" to record your first vendor contact.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSuppliers.map((supplier) => {
            const fin = supplierFinancials.get(supplier.id) || { totalPurchases: 0, amountPaid: 0, balanceDue: 0, poCount: 0 };
            return (
              <div
                key={supplier.id}
                className={`p-5 bg-white border rounded-2xl shadow-2xs flex flex-col justify-between transition-all min-w-0 ${
                  supplier.isArchived ? 'opacity-60 bg-zinc-50 border-dashed border-zinc-300' : 'border-[#E5EAE6] hover:border-[#CFE5D8]'
                }`}
              >
                <div>
                  {/* Top Bar: Company Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#145C43] shrink-0" />
                        <h3 className="text-base font-bold text-[#202923] truncate">
                          {supplier.companyName}
                        </h3>
                      </div>
                      <p className="text-xs text-[#68736D] font-medium mt-0.5">
                        Contact Person: <span className="font-semibold text-[#202923]">{supplier.name}</span>
                      </p>
                    </div>

                    <div className="shrink-0">
                      {supplier.isArchived ? (
                        <span className="text-[10px] bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full font-bold">
                          Archived
                        </span>
                      ) : (
                        <span className="text-[10px] bg-[#EAF5EF] text-[#145C43] border border-[#CFE5D8] px-2 py-0.5 rounded-full font-bold">
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Phone & WhatsApp */}
                  <div className="mt-3.5 flex items-center justify-between gap-2 text-xs">
                    <a
                      href={`tel:${supplier.mobile}`}
                      className="flex items-center gap-1.5 text-[#202923] font-medium hover:text-[#145C43] transition-colors"
                      title="Call phone"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#145C43]" />
                      <span>{supplier.mobile}</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => openWhatsAppChat(supplier.whatsapp || supplier.mobile, supplier.name)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-emerald-200"
                      title="Chat on WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                      <span>WhatsApp</span>
                    </button>
                  </div>

                  {/* Supplied Products tags */}
                  {supplier.suppliedProducts && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase font-bold text-[#929B95] tracking-wider mb-1">
                        Supplied Products
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {supplier.suppliedProducts.split(',').map((p, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] bg-[#F7F9F7] text-[#202923] border border-[#E5EAE6] px-2 py-0.5 rounded-md font-medium"
                          >
                            {p.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Snapshot */}
                  <div className="mt-4 pt-3 border-t border-[#E5EAE6] grid grid-cols-2 gap-2 text-xs bg-[#F7F9F7] p-2.5 rounded-xl border">
                    <div>
                      <span className="text-[10px] text-[#68736D] block uppercase font-bold tracking-wider">
                        Total Purchases ({fin.poCount})
                      </span>
                      <span className="font-bold text-[#202923] font-mono text-sm">
                        {formatCurrency(fin.totalPurchases)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#68736D] block uppercase font-bold tracking-wider">
                        Outstanding Balance
                      </span>
                      <span className={`font-bold font-mono text-sm ${fin.balanceDue > 0 ? 'text-rose-600' : 'text-[#145C43]'}`}>
                        {formatCurrency(fin.balanceDue)}
                      </span>
                    </div>
                  </div>

                  {fin.lastDate && (
                    <p className="text-[11px] text-[#68736D] mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#929B95]" />
                      <span>Last order: {formatDateTime(fin.lastDate)}</span>
                    </p>
                  )}
                </div>

                {/* Primary Actions & Utilities Bar */}
                <div className="mt-4 pt-3.5 border-t border-[#E5EAE6] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Direct Create PO Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenCreatePO(supplier.id)}
                      className="min-h-[44px] px-3 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Create PO</span>
                    </button>

                    {/* View Details & PO History Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierForDetails(supplier)}
                      className="min-h-[44px] px-3 bg-[#F7F9F7] hover:bg-[#EAF5EF] text-[#202923] hover:text-[#145C43] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-[#E5EAE6] cursor-pointer"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-[#145C43]" />
                      <span>View History</span>
                    </button>
                  </div>

                  {/* Secondary Action Icons */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenRecordPayment(supplier, fin.balanceDue > 0 ? fin.balanceDue : undefined)}
                      className="text-xs font-semibold text-[#145C43] hover:underline flex items-center gap-1"
                      title="Record payment to this supplier"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Record Payment</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openModal(supplier)}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43] rounded-xl transition-colors cursor-pointer"
                        title="Edit Supplier Info"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleArchive(supplier)}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43] rounded-xl transition-colors cursor-pointer"
                        title={supplier.isArchived ? 'Unarchive' : 'Archive'}
                      >
                        <Archive className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSupplier(supplier)}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete Supplier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {isCreatePOModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl my-8 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE6]">
              <div>
                <h3 className="text-lg font-bold text-[#202923]">Create Purchase Order</h3>
                <p className="text-xs text-[#68736D]">Procure raw materials & ingredients from vendor</p>
              </div>
              <button
                onClick={() => setIsCreatePOModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#68736D] hover:bg-[#F7F9F7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-4">
              {/* Step 1: Select Supplier */}
              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                  Supplier / Vendor *
                </label>
                <select
                  value={selectedSupplierForPO}
                  onChange={(e) => setSelectedSupplierForPO(e.target.value)}
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

              {/* Step 2: Add Inventory Items */}
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
                onClick={() => setIsCreatePOModalOpen(false)}
                className="min-h-[44px] px-4 text-xs font-semibold text-[#68736D] hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmittingPO}
                onClick={() => handleSavePurchaseOrder('DRAFT')}
                className="min-h-[44px] px-4 bg-zinc-100 hover:bg-zinc-200 text-[#202923] text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isSubmittingPO}
                onClick={() => handleSavePurchaseOrder('ORDERED')}
                className="min-h-[44px] px-5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                {isSubmittingPO ? 'Saving...' : 'Confirm & Mark Ordered'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD SUPPLIER PAYMENT MODAL */}
      {isPaymentModalOpen && payingSupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAE6]">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#145C43]" />
                <h3 className="text-base font-bold text-[#202923]">Record Supplier Payment</h3>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-1 text-[#68736D] hover:text-[#202923]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplierPayment} className="space-y-3.5">
              <div className="p-3 bg-[#F7F9F7] rounded-xl border border-[#E5EAE6] text-xs">
                <p className="font-bold text-[#202923]">{payingSupplier.companyName}</p>
                <p className="text-[#68736D]">Contact: {payingSupplier.name} ({payingSupplier.mobile})</p>
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
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 text-sm bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl font-bold font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase mb-1">
                  Payment Method *
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['UPI', 'CASH', 'CARD', 'OTHER'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`min-h-[40px] text-xs font-bold rounded-xl transition-all ${
                        payMethod === m
                          ? 'bg-[#145C43] text-white shadow-2xs'
                          : 'bg-[#F7F9F7] text-[#68736D] hover:bg-[#EAF5EF] border border-[#E5EAE6]'
                      }`}
                    >
                      {m === 'OTHER' ? 'Bank Transfer' : m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase mb-1">
                  Transaction Reference / UTR
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UPI Ref, Cheque #, NEFT"
                  className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase mb-1">
                  Payment Notes
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Cleared bill for dairy delivery"
                  className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="min-h-[44px] px-4 text-xs font-semibold text-[#68736D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="min-h-[44px] px-5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl active:scale-95 shadow-xs cursor-pointer"
                >
                  {isSubmittingPay ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER DETAILS & PURCHASE HISTORY MODAL */}
      {selectedSupplierForDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl p-6 shadow-2xl my-8 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE6]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#145C43]" />
                <div>
                  <h3 className="text-lg font-bold text-[#202923]">{selectedSupplierForDetails.companyName}</h3>
                  <p className="text-xs text-[#68736D]">Vendor Profile & Purchasing Ledger</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplierForDetails(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#68736D] hover:bg-[#F7F9F7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {/* Profile Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-[#F7F9F7] rounded-xl border border-[#E5EAE6] text-xs">
                <div>
                  <span className="text-[10px] text-[#68736D] uppercase block font-semibold">Contact Person</span>
                  <span className="font-bold text-[#202923]">{selectedSupplierForDetails.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#68736D] uppercase block font-semibold">Phone</span>
                  <span className="font-bold text-[#202923]">{selectedSupplierForDetails.mobile}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#68736D] uppercase block font-semibold">Payment Terms</span>
                  <span className="font-bold text-[#202923]">{selectedSupplierForDetails.paymentTerms || 'Standard'}</span>
                </div>
                {selectedSupplierForDetails.gstin && (
                  <div>
                    <span className="text-[10px] text-[#68736D] uppercase block font-semibold">GSTIN</span>
                    <span className="font-mono font-bold text-[#202923]">{selectedSupplierForDetails.gstin}</span>
                  </div>
                )}
                {selectedSupplierForDetails.email && (
                  <div>
                    <span className="text-[10px] text-[#68736D] uppercase block font-semibold">Email</span>
                    <span className="font-bold text-[#202923]">{selectedSupplierForDetails.email}</span>
                  </div>
                )}
                {selectedSupplierForDetails.address && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className="text-[10px] text-[#68736D] uppercase block font-semibold">Address</span>
                    <span className="text-[#202923]">{selectedSupplierForDetails.address}</span>
                  </div>
                )}
              </div>

              {/* Purchase Orders List for this supplier */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#202923] uppercase tracking-wider">
                    Purchase Order History
                  </h4>
                  <button
                    onClick={() => {
                      const id = selectedSupplierForDetails.id;
                      setSelectedSupplierForDetails(null);
                      handleOpenCreatePO(id);
                    }}
                    className="text-xs font-bold text-[#145C43] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ New PO</span>
                  </button>
                </div>

                {purchaseOrders.filter((po) => po.supplierId === selectedSupplierForDetails.id).length === 0 ? (
                  <div className="p-4 text-center bg-[#F7F9F7] rounded-xl text-xs text-[#68736D]">
                    No purchase orders recorded yet for this supplier.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {purchaseOrders
                      .filter((po) => po.supplierId === selectedSupplierForDetails.id)
                      .map((po) => (
                        <div
                          key={po.id}
                          className="p-3 bg-white border border-[#E5EAE6] rounded-xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#202923]">{po.poNumber}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  po.status === 'RECEIVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : po.status === 'PARTIALLY_RECEIVED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : po.status === 'ORDERED'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-zinc-100 text-zinc-700'
                                }`}
                              >
                                {po.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#68736D] mt-0.5">
                              {formatDateTime(po.createdAt)} • {po.items.length} items
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-[#202923] block">
                              {formatCurrency(po.totalAmount)}
                            </span>
                            {po.balanceDue > 0 ? (
                              <span className="text-[11px] text-rose-600 font-bold block">
                                Due: {formatCurrency(po.balanceDue)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-emerald-600 font-bold block">
                                Paid
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Payments History for this supplier */}
              <div>
                <h4 className="text-xs font-bold text-[#202923] uppercase tracking-wider mb-2">
                  Payment History
                </h4>
                {payments.filter((p) => p.supplierId === selectedSupplierForDetails.id).length === 0 ? (
                  <div className="p-4 text-center bg-[#F7F9F7] rounded-xl text-xs text-[#68736D]">
                    No payments recorded yet for this vendor.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments
                      .filter((p) => p.supplierId === selectedSupplierForDetails.id)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-white border border-[#E5EAE6] rounded-xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#202923]">{p.paymentMethod}</span>
                            {p.paymentReference && (
                              <span className="text-[11px] text-[#68736D] ml-2 font-mono">
                                Ref: {p.paymentReference}
                              </span>
                            )}
                            <p className="text-[11px] text-[#68736D] mt-0.5">
                              {formatDateTime(p.paymentDate)}
                            </p>
                          </div>

                          <span className="font-mono font-bold text-emerald-700 text-sm">
                            +{formatCurrency(p.amount)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5EAE6] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const s = selectedSupplierForDetails;
                  setSelectedSupplierForDetails(null);
                  handleOpenRecordPayment(s);
                }}
                className="min-h-[44px] px-4 bg-[#EAF5EF] hover:bg-[#CFE5D8] text-[#145C43] text-xs font-bold rounded-xl border border-[#CFE5D8] flex items-center gap-1.5 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>Record Payment</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSupplierForDetails(null)}
                className="min-h-[44px] px-5 bg-zinc-100 hover:bg-zinc-200 text-[#202923] text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT SUPPLIER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAE6]">
              <h3 className="text-base font-bold text-[#202923]">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-[#68736D] hover:text-[#202923]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                    Company / Firm Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Amul Dairy Agency"
                    className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. 9825012345"
                    className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Leave blank to use mobile"
                    className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendor@example.com"
                    className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                    GSTIN (Tax ID)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AABCA1234F1Z1"
                    className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                  Supplied Products (comma-separated)
                </label>
                <input
                  type="text"
                  value={suppliedProducts}
                  onChange={(e) => setSuppliedProducts(e.target.value)}
                  placeholder="e.g. Milk, Butter, Paneer, Cheese"
                  className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                  >
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="Weekly Payment">Weekly Payment</option>
                    <option value="15 Days Credit">15 Days Credit</option>
                    <option value="Monthly Settlement">Monthly Settlement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop #, Market location"
                    className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Delivers early morning at 6:30 AM"
                  className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] px-4 text-xs font-semibold text-[#68736D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl active:scale-95 shadow-xs cursor-pointer"
                >
                  {editingSupplier ? 'Save Changes' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
