import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  addSupplier, 
  getSuppliers, 
  toggleArchiveSupplier, 
  updateSupplier 
} from '../../services/suppliers/supplierService';
import { getPurchaseOrders, getSupplierPayments } from '../../services/purchases/purchaseOrderService';
import { Supplier, PurchaseOrder, SupplierPayment } from '../../types';
import { formatCurrency } from '../../utils/calculations';
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
  ExternalLink
} from 'lucide-react';

export const SuppliersPage: React.FC = () => {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierForDetails, setSelectedSupplierForDetails] = useState<Supplier | null>(null);

  // Form State
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
      const [supList, poList, payList] = await Promise.all([
        getSuppliers(profile.id),
        getPurchaseOrders(profile.id),
        getSupplierPayments(profile.id),
      ]);
      setSuppliers(supList);
      setPurchaseOrders(poList);
      setPayments(payList);
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
    const map = new Map<string, { totalPurchases: number; amountPaid: number; balanceDue: number }>();
    suppliers.forEach((s) => map.set(s.id, { totalPurchases: 0, amountPaid: 0, balanceDue: 0 }));

    purchaseOrders.forEach((po) => {
      if (po.status !== 'CANCELLED') {
        const cur = map.get(po.supplierId) || { totalPurchases: 0, amountPaid: 0, balanceDue: 0 };
        cur.totalPurchases += po.totalAmount;
        cur.amountPaid += po.amountPaid;
        cur.balanceDue += po.balanceDue;
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

  const openWhatsAppChat = (phone: string, supName: string) => {
    const cleanPhone = formatWhatsAppPhone(phone);
    const msg = encodeURIComponent(`Hello ${supName}, contacting regarding order from ${profile?.name || 'our food shop'}.`);
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Supplier Management</h1>
          <p className="text-xs text-zinc-500">
            Manage raw material vendors, track purchases, balances & direct WhatsApp communications
          </p>
        </div>

        <button
          onClick={() => openModal()}
          className="px-4 py-2.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Supplier</span>
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
            placeholder="Search by vendor name, company, products, phone..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 focus:bg-white text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#145C43]"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer self-start sm:self-center">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded text-zinc-900"
          />
          <span>Show Archived Suppliers</span>
        </label>
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400 text-xs">
          Loading suppliers...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-6">
          <Truck className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-700">No suppliers found</p>
          <p className="text-xs text-zinc-400 mt-1">
            Tap "+ Add Supplier" to record your first vendor contact.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => {
            const fin = supplierFinancials.get(supplier.id) || { totalPurchases: 0, amountPaid: 0, balanceDue: 0 };
            return (
              <div
                key={supplier.id}
                className={`p-4 bg-white border rounded-2xl shadow-2xs flex flex-col justify-between transition-all ${
                  supplier.isArchived ? 'opacity-60 bg-zinc-50 border-dashed' : 'border-zinc-200/90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-950">{supplier.companyName}</h3>
                      <p className="text-xs text-zinc-500 font-medium">Contact: {supplier.name}</p>
                    </div>
                    {supplier.isArchived && (
                      <span className="text-[10px] bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full font-bold">
                        Archived
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-zinc-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{supplier.mobile}</span>
                    </div>
                    {supplier.suppliedProducts && (
                      <p className="text-[11px] text-zinc-500 bg-zinc-50 p-1.5 rounded-lg border border-zinc-100">
                        Supplies: {supplier.suppliedProducts}
                      </p>
                    )}
                  </div>

                  {/* Financial Snapshot */}
                  <div className="mt-3 pt-3 border-t border-zinc-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase">Purchases</span>
                      <span className="font-bold text-zinc-900 font-mono">
                        {formatCurrency(fin.totalPurchases)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase">Balance Due</span>
                      <span className={`font-bold font-mono ${fin.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(fin.balanceDue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openWhatsAppChat(supplier.whatsapp || supplier.mobile, supplier.name)}
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Chat on WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openModal(supplier)}
                      className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                      title="Edit Supplier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleArchive(supplier)}
                      className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"
                      title={supplier.isArchived ? 'Unarchive' : 'Archive'}
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT SUPPLIER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-base font-bold text-zinc-900">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Company / Firm Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Amul Dairy Agency"
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="9825012345"
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Same as mobile"
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="supplier@domain.com"
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="24AAAAA0000A1Z5"
                    className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Supplied Products
                </label>
                <input
                  type="text"
                  value={suppliedProducts}
                  onChange={(e) => setSuppliedProducts(e.target.value)}
                  placeholder="e.g. Milk, Cheese, Paneer, Butter"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Address & Notes
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Market Stall No / Warehouse Location"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
