import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  addCustomer, 
  deleteCustomer, 
  getCustomers, 
  toggleArchiveCustomer, 
  updateCustomer 
} from '../../services/customers/customerService';
import { getOrders } from '../../services/orders/orderService';
import { Customer, Order } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { formatWhatsAppPhone } from '../../services/whatsapp/whatsappService';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  MessageSquare, 
  Mail, 
  MapPin, 
  Edit, 
  Archive, 
  Trash2, 
  X, 
  ShoppingBag, 
  Clock, 
  Eye, 
  EyeOff, 
  UserCheck 
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  const loadData = async () => {
    if (!profile?.id) return;
    try {
      const [custList, orderList] = await Promise.all([
        getCustomers(profile.id),
        getOrders(profile.id),
      ]);
      setCustomers(custList);
      setOrders(orderList);
    } catch (err) {
      console.warn('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!showArchived && c.isArchived) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [customers, searchQuery, showArchived]);

  // Compute live spend & order count per customer from order history
  const customerStats = useMemo(() => {
    const map = new Map<string, { count: number; spend: number; lastDate: string | null }>();
    customers.forEach((c) => {
      map.set(c.id, { count: c.totalOrders || 0, spend: c.totalSpent || 0, lastDate: c.lastVisit || null });
    });

    orders.forEach((o) => {
      if (o.status === 'CANCELLED' || o.status === 'VOIDED') return;
      const custPhone = o.customer?.phone || (o as any).customerPhone;
      if (!custPhone) return;

      const matchedCust = customers.find((c) => c.phone === custPhone);
      if (matchedCust) {
        const cur = map.get(matchedCust.id) || { count: 0, spend: 0, lastDate: null };
        cur.count = Math.max(cur.count, (cur.count || 0) + 1);
        cur.spend += o.grandTotal || (o as any).totalAmount || 0;
        if (!cur.lastDate || new Date(o.createdAt) > new Date(cur.lastDate)) {
          cur.lastDate = o.createdAt;
        }
        map.set(matchedCust.id, cur);
      }
    });

    return map;
  }, [customers, orders]);

  const openCustomerModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setPhone(customer.phone);
      setEmail(customer.email || '');
      setAddress(customer.address || '');
      setNotes(customer.notes || '');
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !name.trim() || !phone.trim()) return;

    try {
      if (editingCustomer) {
        await updateCustomer(profile.id, editingCustomer.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await addCustomer(profile.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    }
  };

  const handleToggleArchive = async (cust: Customer) => {
    if (!profile) return;
    try {
      await toggleArchiveCustomer(profile.id, cust.id);
      await loadData();
    } catch {
      alert('Failed to update customer status');
    }
  };

  const handleDeleteCustomer = async (cust: Customer) => {
    if (!profile) return;
    const hasOrders = orders.some((o) => o.customer?.phone === cust.phone || (o as any).customerPhone === cust.phone);
    const prompt = hasOrders
      ? `"${cust.name}" has recorded order history. Deleting will safely archive this customer to preserve past sales reporting and bills. Proceed?`
      : `Are you sure you want to permanently delete customer "${cust.name}"?`;
    if (!confirm(prompt)) return;

    try {
      const res = await deleteCustomer(profile.id, cust.id, hasOrders);
      alert(res.message);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  const openWhatsApp = (customerPhone: string, customerName: string) => {
    const cleanPhone = formatWhatsAppPhone(customerPhone);
    const msg = encodeURIComponent(`Hello ${customerName}, thank you for choosing ${profile?.name || 'our restaurant'}!`);
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  const customerOrdersList = useMemo(() => {
    if (!selectedCustomerForHistory) return [];
    return orders.filter(
      (o) => o.customer?.phone === selectedCustomerForHistory.phone || (o as any).customerPhone === selectedCustomerForHistory.phone
    );
  }, [selectedCustomerForHistory, orders]);

  return (
    <div className="space-y-5 w-full min-w-0 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#E5EAE6] rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#145C43]" />
            <h1 className="text-lg sm:text-xl font-bold text-[#202923]">Customer Directory</h1>
          </div>
          <p className="hidden md:block text-xs text-[#68736D] mt-0.5">
            View customer contact records, visit history, total spends & direct WhatsApp messaging
          </p>
        </div>

        <button
          onClick={() => openCustomerModal()}
          className="min-h-[44px] px-4 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-2xs active:scale-95 cursor-pointer w-fit self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E5EAE6] p-4 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold text-[#68736D] uppercase tracking-wider block mb-1">
            Total Customers
          </span>
          <span className="text-xl sm:text-2xl font-bold text-[#202923] font-mono">{customers.length}</span>
          <span className="text-[11px] text-[#929B95] block mt-1">Saved contact records</span>
        </div>

        <div className="bg-[#EAF5EF] border border-[#CFE5D8] p-4 rounded-2xl shadow-2xs">
          <span className="text-[10px] font-bold text-[#145C43] uppercase tracking-wider block mb-1">
            Active Directory
          </span>
          <span className="text-xl sm:text-2xl font-bold text-[#145C43] font-mono">
            {customers.filter((c) => !c.isArchived).length}
          </span>
          <span className="text-[11px] text-[#145C43]/80 block mt-1">Regular restaurant patrons</span>
        </div>

        <div className="bg-white border border-[#E5EAE6] p-4 rounded-2xl shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-[#68736D] uppercase tracking-wider block mb-1">
            Total Orders Linked
          </span>
          <span className="text-xl sm:text-2xl font-bold text-[#202923] font-mono">{orders.length}</span>
          <span className="text-[11px] text-[#929B95] block mt-1">Lifetime customer bills</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-[#E5EAE6] rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-[#929B95] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, address..."
            className="w-full pl-9 pr-4 min-h-[44px] bg-[#F7F9F7] focus:bg-white text-xs sm:text-sm rounded-xl border border-[#E5EAE6] focus:outline-none focus:ring-1 focus:ring-[#145C43]"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-[#202923] cursor-pointer self-start sm:self-center">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 rounded text-[#145C43] focus:ring-[#145C43]"
          />
          <span>Show Archived Customers</span>
        </label>
      </div>

      {/* Customer List / Cards Grid */}
      {loading ? (
        <div className="text-center py-12 text-[#929B95] text-xs">
          Loading customer directory...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-[#E5EAE6] rounded-2xl p-6">
          <Users className="w-8 h-8 text-[#929B95] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#202923]">No customers found</p>
          <p className="text-xs text-[#68736D] mt-1">
            Tap "+ Add Customer" or save contact numbers during checkout billing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCustomers.map((cust) => {
            const stats = customerStats.get(cust.id) || { count: 0, spend: 0, lastDate: null };

            return (
              <div
                key={cust.id}
                className={`p-4 sm:p-5 bg-white border rounded-2xl shadow-2xs hover:shadow-sm flex flex-col justify-between transition-all min-w-0 max-w-full box-border ${
                  cust.isArchived ? 'opacity-70 bg-[#F7F9F7] border-dashed border-[#E5EAE6]' : 'border-[#E5EAE6]'
                }`}
              >
                <div>
                  {/* Card Header: Avatar, Name, Phone & Status */}
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#EAF5EF] text-[#145C43] font-bold text-base flex items-center justify-center shrink-0 shadow-2xs">
                        {cust.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-[#202923] truncate leading-tight" title={cust.name}>
                          {cust.name}
                        </h3>
                        <p className="text-xs text-[#68736D] font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#929B95] shrink-0" />
                          <span>{cust.phone}</span>
                        </p>
                      </div>
                    </div>

                    {cust.isArchived ? (
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-2.5 py-0.5 rounded-full font-semibold shrink-0">
                        Archived
                      </span>
                    ) : (
                      <span className="text-[10px] bg-[#EAF5EF] text-[#145C43] border border-[#CFE5D8] px-2.5 py-0.5 rounded-full font-bold shrink-0">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Location and Notes */}
                  <div className="mt-3 space-y-1 text-xs text-[#68736D] min-w-0">
                    {cust.address ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-[#929B95]" />
                        <span className="truncate">{cust.address}</span>
                      </div>
                    ) : null}
                    {cust.notes ? (
                      <p className="text-[11px] text-[#929B95] italic line-clamp-1">
                        "{cust.notes}"
                      </p>
                    ) : null}
                  </div>

                  {/* Orders & Total Spend Meter */}
                  <div className="mt-3.5 p-3 bg-[#F7F9F7] rounded-xl border border-[#E5EAE6] grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-[#68736D] block uppercase tracking-wider">Total Bills</span>
                      <span className="font-bold font-mono text-[#202923] text-sm block mt-0.5">{stats.count} orders</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#68736D] block uppercase tracking-wider">Total Spend</span>
                      <span className="font-bold font-mono text-[#145C43] text-sm block mt-0.5">
                        {formatCurrency(stats.spend)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions: Action Hierarchy with Strict Card Containment */}
                <div className="mt-4 pt-3.5 border-t border-[#E5EAE6] flex flex-wrap items-center justify-between gap-2 min-w-0 max-w-full">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {/* Primary: WhatsApp */}
                    <button
                      onClick={() => openWhatsApp(cust.phone, cust.name)}
                      className="min-h-[44px] px-3.5 bg-[#145C43] hover:bg-[#0F4935] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
                      title="Send WhatsApp Message"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-300 shrink-0" />
                      <span>WhatsApp</span>
                    </button>

                    {/* Secondary: History */}
                    <button
                      onClick={() => setSelectedCustomerForHistory(cust)}
                      className="min-h-[44px] px-3 bg-white hover:bg-[#F7F9F7] text-[#202923] border border-[#E5EAE6] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                      title="View Order History"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#68736D] shrink-0" />
                      <span>History</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Secondary: Edit */}
                    <button
                      onClick={() => openCustomerModal(cust)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#202923] hover:bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl transition-colors cursor-pointer"
                      title="Edit Customer"
                    >
                      <Edit className="w-4 h-4 text-[#68736D]" />
                    </button>

                    {/* Secondary: Archive */}
                    <button
                      onClick={() => handleToggleArchive(cust)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#68736D] hover:bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl transition-colors cursor-pointer"
                      title={cust.isArchived ? 'Unarchive customer' : 'Archive customer'}
                    >
                      <Archive className="w-4 h-4" />
                    </button>

                    {/* Destructive: Delete with Confirmation */}
                    <button
                      onClick={() => handleDeleteCustomer(cust)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto border border-[#E5EAE6]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE6]">
              <h3 className="text-base font-bold text-[#202923]">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-[#929B95] hover:text-[#202923] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#202923] uppercase tracking-wider mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3.5 min-h-[44px] text-sm bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202923] uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 min-h-[44px] text-sm bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202923] uppercase tracking-wider mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3.5 min-h-[44px] text-sm bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202923] uppercase tracking-wider mb-1">
                  Delivery Address / Area
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, flat #, landmark..."
                  className="w-full px-3.5 min-h-[44px] text-sm bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202923] uppercase tracking-wider mb-1">
                  Customer Preferences / Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Less spicy, extra butter"
                  className="w-full px-3.5 min-h-[44px] text-sm bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 min-h-[44px] border border-[#E5EAE6] text-[#202923] text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#F7F9F7] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER ORDER HISTORY MODAL */}
      {selectedCustomerForHistory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 border border-[#E5EAE6]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE6]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#145C43]" />
                <div>
                  <h3 className="text-base font-bold text-[#202923]">{selectedCustomerForHistory.name}</h3>
                  <p className="text-xs text-[#68736D] font-mono">{selectedCustomerForHistory.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerForHistory(null)}
                className="p-1 text-[#929B95] hover:text-[#202923] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {customerOrdersList.length === 0 ? (
              <div className="text-center py-8 text-[#929B95] text-xs">
                No orders recorded under phone number {selectedCustomerForHistory.phone} yet.
              </div>
            ) : (
              <div className="divide-y divide-[#E5EAE6] space-y-2">
                {customerOrdersList.map((order) => (
                  <div key={order.id} className="pt-2.5 pb-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#202923] font-mono">#{order.billNumber}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          order.paymentStatus === 'PAID'
                            ? 'bg-[#EAF5EF] text-[#145C43] border border-[#CFE5D8]'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#68736D] mt-0.5">
                        {order.items.length} items • {order.tableName || 'Takeaway'}
                      </p>
                      <span className="text-[10px] text-[#929B95]">{formatDateTime(order.createdAt)}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-[#202923] block">
                        {formatCurrency(order.grandTotal || (order as any).totalAmount || 0)}
                      </span>
                      <span className="text-[10px] text-[#68736D] uppercase">
                        {order.paymentMethod}
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
