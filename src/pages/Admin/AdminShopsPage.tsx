import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getAllShops, 
  sendShopPasswordReset, 
  updateShopPlan, 
  updateShopStatus,
  updateShopDetails,
  changeShopOwnerLoginId,
  changeShopOwnerEmail,
  generateShopOwnerTemporaryPassword,
  softDeleteOrArchiveShop,
  reactivateShop
} from '../../services/admin/superAdminService';
import { 
  getBusinessFeatures, 
  updateBusinessFeatures, 
  resetBusinessFeaturesToDefault, 
  getFeatureChangeHistory,
  FEATURE_METADATA,
  FeatureAuditLog 
} from '../../services/features/featureService';
import { 
  getBusinessMembers, 
  updateMember 
} from '../../services/members/memberService';
import { 
  assignShopSubscription, 
  getShopSubscription 
} from '../../services/subscription/subscriptionService';
import { 
  AccessPlan, 
  AccountStatus, 
  BusinessCategory, 
  BusinessFeatures, 
  BusinessMember, 
  FeatureFlagKey, 
  ShopSummary, 
  BillingCycle,
  SubscriptionRecord 
} from '../../types';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { formatCurrency } from '../../utils/calculations';
import { 
  Store, 
  Search, 
  KeyRound, 
  Check, 
  X, 
  Calendar, 
  Mail, 
  Phone,
  Sliders,
  Users,
  Clock,
  ShieldCheck,
  AlertCircle,
  Archive,
  Eye,
  Edit2,
  Lock,
  Copy,
  RefreshCw,
  CreditCard,
  Building,
  CheckCircle2,
  Trash2
} from 'lucide-react';

export const AdminShopsPage: React.FC = () => {
  const navigate = useNavigate();

  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');

  // Modals & Drawers
  const [viewingShop, setViewingShop] = useState<ShopSummary | null>(null);
  const [editingShop, setEditingShop] = useState<ShopSummary | null>(null);
  const [ownerModalShop, setOwnerModalShop] = useState<ShopSummary | null>(null);
  const [subscriptionShop, setSubscriptionShop] = useState<ShopSummary | null>(null);
  const [archiveShop, setArchiveShop] = useState<ShopSummary | null>(null);
  const [archiveOrderCount, setArchiveOrderCount] = useState<number | null>(null);
  const [archiveReason, setArchiveReason] = useState('Business closed or cancelled subscription');

  // Edit Shop Form
  const [editName, setEditName] = useState('');
  const [editBrandName, setEditBrandName] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCategory, setEditCategory] = useState<BusinessCategory>('restaurant');
  const [editAddress, setEditAddress] = useState('');

  // Owner Management Form
  const [newOwnerLoginId, setNewOwnerLoginId] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Subscription Assignment Form
  const [subPlan, setSubPlan] = useState<AccessPlan>('pro');
  const [subBillingCycle, setSubBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [subDurationDays, setSubDurationDays] = useState('30');
  const [subPricePaid, setSubPricePaid] = useState('0');

  // Feature Control Modal
  const [featureShop, setFeatureShop] = useState<ShopSummary | null>(null);
  const [shopFeatures, setShopFeatures] = useState<BusinessFeatures | null>(null);
  const [featureHistory, setFeatureHistory] = useState<FeatureAuditLog[]>([]);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);

  // Member Management Modal
  const [memberShop, setMemberShop] = useState<ShopSummary | null>(null);
  const [shopMembers, setShopMembers] = useState<BusinessMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    setLoading(true);
    try {
      const data = await getAllShops();
      setShops(data);
    } finally {
      setLoading(false);
    }
  };

  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      if (statusFilter === 'ACTIVE' && (shop.status !== 'ACTIVE' || shop.isArchived)) return false;
      if (statusFilter === 'SUSPENDED' && (shop.status !== 'SUSPENDED' || shop.isArchived)) return false;
      if (statusFilter === 'ARCHIVED' && !shop.isArchived) return false;
      if (planFilter !== 'ALL' && shop.plan !== planFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          shop.name.toLowerCase().includes(q) ||
          (shop.brandName || '').toLowerCase().includes(q) ||
          shop.ownerName.toLowerCase().includes(q) ||
          shop.phone.includes(q) ||
          (shop.loginId || '').toLowerCase().includes(q) ||
          (shop.ownerEmail && shop.ownerEmail.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [shops, statusFilter, planFilter, searchQuery]);

  // Open View Details Drawer
  const openViewDrawer = (shop: ShopSummary) => {
    setViewingShop(shop);
  };

  // Open Edit Shop Modal
  const openEditModal = (shop: ShopSummary) => {
    setEditingShop(shop);
    setEditName(shop.name);
    setEditBrandName(shop.brandName || shop.name);
    setEditOwnerName(shop.ownerName);
    setEditPhone(shop.phone);
    setEditCategory(shop.category || 'restaurant');
    setEditAddress(shop.address || '');
  };

  const handleSaveShopEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;

    try {
      await updateShopDetails(editingShop.id, {
        name: editName.trim(),
        brandName: editBrandName.trim(),
        ownerName: editOwnerName.trim(),
        phone: editPhone.trim(),
        category: editCategory,
        address: editAddress.trim(),
      });
      setActionFeedback(`Shop profile for "${editName}" updated successfully.`);
      await loadShops();
      setEditingShop(null);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      alert('Failed to update shop details');
    }
  };

  // Open Owner Credentials Modal
  const openOwnerModal = (shop: ShopSummary) => {
    setOwnerModalShop(shop);
    setNewOwnerLoginId(shop.loginId || '');
    setNewOwnerEmail(shop.ownerEmail || '');
    setGeneratedTempPassword(null);
  };

  const handleChangeLoginId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerModalShop || !newOwnerLoginId.trim()) return;

    try {
      const res = await changeShopOwnerLoginId(ownerModalShop.id, newOwnerLoginId.trim());
      if (res.success) {
        setActionFeedback(res.message);
        await loadShops();
        setOwnerModalShop(prev => prev ? { ...prev, loginId: newOwnerLoginId.trim().toLowerCase() } : null);
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to change login ID');
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerModalShop || !newOwnerEmail.trim()) return;

    try {
      const res = await changeShopOwnerEmail(ownerModalShop.id, newOwnerEmail.trim());
      if (res.success) {
        setActionFeedback(res.message);
        await loadShops();
        setOwnerModalShop(prev => prev ? { ...prev, ownerEmail: newOwnerEmail.trim().toLowerCase() } : null);
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to change owner email');
    }
  };

  const handleGeneratePassword = async () => {
    if (!ownerModalShop) return;
    try {
      const res = await generateShopOwnerTemporaryPassword(ownerModalShop.id);
      setGeneratedTempPassword(res.temporaryPassword);
      setActionFeedback(res.message);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to generate temporary password');
    }
  };

  const handlePasswordReset = async (shop: ShopSummary) => {
    if (!shop.ownerEmail) {
      alert('This shop does not have an associated email address.');
      return;
    }
    try {
      await sendShopPasswordReset(shop.ownerEmail);
      setActionFeedback(`Password reset email sent to ${shop.ownerEmail}`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to send password reset');
    }
  };

  // Open Subscription Modal
  const openSubscriptionModal = (shop: ShopSummary) => {
    setSubscriptionShop(shop);
    setSubPlan(shop.plan);
    setSubBillingCycle('MONTHLY');
    setSubDurationDays('30');
    setSubPricePaid('0');
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriptionShop) return;

    const days = parseInt(subDurationDays) || 30;
    const price = parseFloat(subPricePaid) || 0;

    try {
      await assignShopSubscription(subscriptionShop.id, {
        planId: subPlan === 'enterprise' ? 'plan_enterprise' : subPlan === 'starter' ? 'plan_starter' : 'plan_pro',
        billingCycle: subBillingCycle,
        durationDays: days,
        pricePaid: price,
        autoRenew: false,
        notes: `Assigned by platform Super Admin. Duration: ${days} days.`,
      });
      setActionFeedback(`Subscription updated for "${subscriptionShop.name}". Valid for ${days} days.`);
      await loadShops();
      setSubscriptionShop(null);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      alert('Failed to update subscription');
    }
  };

  // Toggle Suspend / Reactivate
  const handleToggleStatus = async (shop: ShopSummary) => {
    const nextStatus: AccountStatus = shop.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      if (nextStatus === 'ACTIVE' && shop.isArchived) {
        await reactivateShop(shop.id);
      } else {
        await updateShopStatus(shop.id, nextStatus);
      }
      setActionFeedback(`Shop "${shop.name}" status updated to ${nextStatus}.`);
      await loadShops();
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      alert('Failed to update shop status');
    }
  };

  // Open Soft Delete / Archive Modal
  const openArchiveModal = async (shop: ShopSummary) => {
    setArchiveShop(shop);
    setArchiveOrderCount(null);
    setArchiveReason('Business closed or requested cancellation');

    try {
      const { getOrders } = await import('../../services/orders/orderService');
      const orders = await getOrders(shop.id);
      setArchiveOrderCount(orders.length);
    } catch {
      setArchiveOrderCount(0);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveShop) return;

    try {
      const res = await softDeleteOrArchiveShop(archiveShop.id, archiveReason);
      setActionFeedback(res.message);
      await loadShops();
      setArchiveShop(null);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch {
      alert('Failed to archive shop');
    }
  };

  // Open Feature Modal
  const openFeatureModal = async (shop: ShopSummary) => {
    setFeatureShop(shop);
    const feat = await getBusinessFeatures(shop.id);
    setShopFeatures(feat);
    const history = await getFeatureChangeHistory(shop.id);
    setFeatureHistory(history);
  };

  const handleToggleFeature = async (key: FeatureFlagKey) => {
    if (!featureShop || !shopFeatures) return;
    const updatedVal = !shopFeatures[key];
    const newFeatures: BusinessFeatures = {
      ...shopFeatures,
      [key]: updatedVal,
    };
    setShopFeatures(newFeatures);

    try {
      setIsSavingFeatures(true);
      await updateBusinessFeatures(featureShop.id, { [key]: updatedVal }, 'Super Admin');
      const history = await getFeatureChangeHistory(featureShop.id);
      setFeatureHistory(history);
      setActionFeedback(`Feature "${FEATURE_METADATA[key]?.name}" toggled ${updatedVal ? 'ON' : 'OFF'} for ${featureShop.name}`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      alert('Failed to update feature');
    } finally {
      setIsSavingFeatures(false);
    }
  };

  // Open Member Modal
  const openMemberModal = async (shop: ShopSummary) => {
    setMemberShop(shop);
    setIsLoadingMembers(true);
    try {
      const data = await getBusinessMembers(shop.id);
      setShopMembers(data);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleToggleMemberStatus = async (member: BusinessMember) => {
    if (!memberShop) return;
    const newStatus = member.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    try {
      await updateMember(memberShop.id, member.id, { status: newStatus });
      const refreshed = await getBusinessMembers(memberShop.id);
      setShopMembers(refreshed);
      setActionFeedback(`Member "${member.name}" status updated to ${newStatus}.`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      alert('Could not update member status');
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">Shop Directory & Subscriptions</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Full tenant lifecycle: shop profiles, owner credentials, subscription validity, and feature toggles
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/create-shop')}
          className="min-h-[48px] px-5 bg-zinc-950 hover:bg-zinc-900 text-white text-sm font-bold rounded-2xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 w-full sm:w-fit"
        >
          <span>+ Add New Shop</span>
        </button>
      </div>

      {actionFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-200">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Filter and Search Bar (Touch friendly min 50px) */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shop, brand, owner, phone, login ID..."
            className="w-full pl-11 pr-4 min-h-[50px] bg-zinc-50 focus:bg-white text-sm rounded-2xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="flex-1 sm:flex-initial min-h-[50px] px-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="flex-1 sm:flex-initial min-h-[50px] px-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer"
          >
            <option value="ALL">All Plans</option>
            <option value="trial">Trial</option>
            <option value="starter">Starter Counter</option>
            <option value="pro">Pro Counter</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Shops Grid */}
      {loading ? (
        <div className="text-center py-16 text-zinc-400 text-sm">Loading registered businesses...</div>
      ) : filteredShops.length === 0 ? (
        <div className="text-center py-16 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-6">
          <Store className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
          <p className="text-base font-bold text-zinc-700">No shops match the criteria</p>
          <p className="text-xs text-zinc-400 mt-1">Try adjusting your filters or search keywords</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredShops.map((shop) => {
            const isSuspended = shop.status === 'SUSPENDED';
            const isArchived = shop.isArchived;

            return (
              <div
                key={shop.id}
                className={`p-5 bg-white border rounded-2xl shadow-xs flex flex-col justify-between transition-all space-y-4 ${
                  isArchived 
                    ? 'border-zinc-300 bg-zinc-50/60 opacity-80' 
                    : isSuspended 
                    ? 'border-rose-300 bg-rose-50/20' 
                    : 'border-zinc-200/90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">{shop.name}</h3>
                        {shop.isDemo && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-bold">
                            DEMO
                          </span>
                        )}
                        {isArchived && (
                          <span className="text-[10px] bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-md font-bold">
                            ARCHIVED
                          </span>
                        )}
                      </div>
                      {shop.brandName && shop.brandName !== shop.name && (
                        <p className="text-xs text-zinc-500 font-medium">{shop.brandName}</p>
                      )}
                      <p className="text-xs text-zinc-500 capitalize mt-0.5">
                        {shop.category?.replace('_', ' ')} • Owner: <span className="font-bold text-zinc-800">{shop.ownerName}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          isArchived
                            ? 'bg-zinc-200 text-zinc-800'
                            : isSuspended
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isArchived ? 'Archived' : shop.status}
                      </span>
                      <span className="text-[11px] font-mono uppercase bg-zinc-100 text-zinc-800 px-2.5 py-1 rounded-full font-bold">
                        {shop.plan}
                      </span>
                    </div>
                  </div>

                  {/* Credentials / Details Pill */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Login ID</span>
                      <span className="font-mono font-bold text-zinc-900">@{shop.loginId || 'owner01'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Phone</span>
                      <span className="font-semibold text-zinc-800">{shop.phone}</span>
                    </div>
                    <div className="col-span-2 truncate">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Email</span>
                      <span className="truncate text-zinc-700">{shop.ownerEmail || 'No Email'}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 mt-2 font-mono">
                    ID: {shop.id} • Registered: {formatDateTime(shop.createdAt)}
                  </p>
                </div>

                {/* Centralized Actions Bar (Touch friendly min 44-48px) */}
                <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* View Details */}
                    <button
                      onClick={() => openViewDrawer(shop)}
                      className="min-h-[44px] px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                      title="View complete shop details"
                    >
                      <Eye className="w-4 h-4 text-zinc-600" />
                      <span>Details</span>
                    </button>

                    {/* Edit Profile */}
                    <button
                      onClick={() => openEditModal(shop)}
                      className="min-h-[44px] px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                      title="Edit business name and details"
                    >
                      <Edit2 className="w-4 h-4 text-zinc-600" />
                      <span>Edit</span>
                    </button>

                    {/* Manage Owner Credentials */}
                    <button
                      onClick={() => openOwnerModal(shop)}
                      className="min-h-[44px] px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                      title="Manage login ID, email & temporary password"
                    >
                      <Lock className="w-4 h-4 text-amber-700" />
                      <span>Owner</span>
                    </button>

                    {/* Subscription */}
                    <button
                      onClick={() => openSubscriptionModal(shop)}
                      className="min-h-[44px] px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                      title="Assign or extend subscription plan"
                    >
                      <CreditCard className="w-4 h-4 text-zinc-600" />
                      <span>Plan</span>
                    </button>

                    {/* Features */}
                    <button
                      onClick={() => openFeatureModal(shop)}
                      className="min-h-[44px] px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                      title="Manage feature flags"
                    >
                      <Sliders className="w-4 h-4 text-indigo-700" />
                      <span>Features</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Suspend / Reactivate */}
                    <button
                      onClick={() => handleToggleStatus(shop)}
                      className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        isSuspended || isArchived
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isSuspended || isArchived ? 'Reactivate' : 'Suspend'}
                    </button>

                    {/* Soft Delete / Archive */}
                    {!isArchived && (
                      <button
                        onClick={() => openArchiveModal(shop)}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] bg-zinc-100 hover:bg-rose-50 text-zinc-500 hover:text-rose-700 rounded-xl flex items-center justify-center transition-all active:scale-90"
                        title="Archive shop (preserves historical order records safely)"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. VIEW SHOP DETAILS MODAL */}
      {viewingShop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-zinc-800" />
                <h3 className="text-lg font-extrabold text-zinc-950">Shop Overview</h3>
              </div>
              <button onClick={() => setViewingShop(null)} className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Business ID:</span>
                  <span className="font-mono font-bold text-zinc-900">{viewingShop.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Shop Name:</span>
                  <span className="font-bold text-zinc-900">{viewingShop.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Brand Name:</span>
                  <span className="font-bold text-zinc-900">{viewingShop.brandName || viewingShop.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Owner Name:</span>
                  <span className="font-bold text-zinc-900">{viewingShop.ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Login ID:</span>
                  <span className="font-mono font-bold text-indigo-700">@{viewingShop.loginId || 'owner01'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Owner Email:</span>
                  <span className="font-semibold text-zinc-900">{viewingShop.ownerEmail || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Counter Phone:</span>
                  <span className="font-semibold text-zinc-900">{viewingShop.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Category:</span>
                  <span className="capitalize font-semibold text-zinc-900">{viewingShop.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Plan:</span>
                  <span className="uppercase font-bold text-zinc-900">{viewingShop.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Plan Expiration:</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {viewingShop.planExpiresAt ? formatDateTime(viewingShop.planExpiresAt) : '30 Days'}
                  </span>
                </div>
                {viewingShop.address && (
                  <div className="pt-2 border-t border-zinc-200">
                    <span className="text-zinc-500 block mb-1">Outlet Address:</span>
                    <span className="text-zinc-800">{viewingShop.address}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setViewingShop(null)}
              className="w-full min-h-[50px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-2xl active:scale-95 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 2. EDIT SHOP PROFILE MODAL */}
      {editingShop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-zinc-800" />
                <h3 className="text-lg font-extrabold text-zinc-950">Edit Shop Profile</h3>
              </div>
              <button onClick={() => setEditingShop(null)} className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShopEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 min-h-[50px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={editBrandName}
                  onChange={(e) => setEditBrandName(e.target.value)}
                  className="w-full px-4 min-h-[50px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Owner Name
                  </label>
                  <input
                    type="text"
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    className="w-full px-4 min-h-[50px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-4 min-h-[50px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as BusinessCategory)}
                  className="w-full px-4 min-h-[50px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl cursor-pointer"
                >
                  <option value="restaurant">Restaurant & Dining</option>
                  <option value="cafe">Cafe & Beverages</option>
                  <option value="food_stall">Food Stall / Fast Food</option>
                  <option value="bakery">Bakery & Desserts</option>
                  <option value="takeaway">Takeaway Counter</option>
                  <option value="sweet_shop">Sweets & Snacks</option>
                  <option value="cloud_kitchen">Cloud Kitchen</option>
                  <option value="other">General Outlet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Address
                </label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full p-3.5 text-sm bg-zinc-50 border border-zinc-300 rounded-2xl"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingShop(null)}
                  className="flex-1 min-h-[52px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-2xl active:scale-95 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[52px] bg-zinc-950 hover:bg-zinc-900 text-white font-bold rounded-2xl shadow-xs active:scale-95 transition-all text-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MANAGE OWNER CREDENTIALS MODAL */}
      {ownerModalShop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-700" />
                <h3 className="text-lg font-extrabold text-zinc-950">Owner Credentials: {ownerModalShop.name}</h3>
              </div>
              <button onClick={() => setOwnerModalShop(null)} className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Generated Temporary Password Card */}
            {generatedTempPassword && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-emerald-900 block">
                  New Temporary Password Generated:
                </span>
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-emerald-200 font-mono font-bold text-base text-zinc-950">
                  <span>{generatedTempPassword}</span>
                  <button
                    onClick={() => copyToClipboard(generatedTempPassword, 'tempPass')}
                    className="p-1 text-emerald-700 hover:text-emerald-900"
                  >
                    {copiedKey === 'tempPass' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Please securely share this temporary password with the shop owner. It is not shown again.
                </p>
              </div>
            )}

            {/* Change Login ID */}
            <form onSubmit={handleChangeLoginId} className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Counter Login ID
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  value={newOwnerLoginId}
                  onChange={(e) => setNewOwnerLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="e.g. princeowner"
                  className="flex-1 px-4 min-h-[48px] text-sm bg-white border border-zinc-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <button
                  type="submit"
                  className="min-h-[48px] px-4 bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs sm:text-sm rounded-xl active:scale-95 transition-all"
                >
                  Update ID
                </button>
              </div>
            </form>

            {/* Change Email Address */}
            <form onSubmit={handleChangeEmail} className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Owner Email Address
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  placeholder="owner@foodpos.app"
                  className="flex-1 px-4 min-h-[48px] text-sm bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <button
                  type="submit"
                  className="min-h-[48px] px-4 bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs sm:text-sm rounded-xl active:scale-95 transition-all"
                >
                  Update Email
                </button>
              </div>
            </form>

            {/* Password Operations */}
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Password Recovery & Reset
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="min-h-[48px] px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Generate Temp Password</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePasswordReset(ownerModalShop)}
                  className="min-h-[48px] px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Reset Email</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setOwnerModalShop(null)}
              className="w-full min-h-[50px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-2xl active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 4. MANAGE SUBSCRIPTION MODAL */}
      {subscriptionShop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-zinc-800" />
                <h3 className="text-lg font-extrabold text-zinc-950">Subscription: {subscriptionShop.name}</h3>
              </div>
              <button onClick={() => setSubscriptionShop(null)} className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Subscription Plan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'starter' as AccessPlan, name: 'Starter' },
                    { key: 'pro' as AccessPlan, name: 'Pro Counter' },
                    { key: 'enterprise' as AccessPlan, name: 'Enterprise' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setSubPlan(p.key)}
                      className={`min-h-[48px] text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                        subPlan === p.key
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Billing Cycle
                  </label>
                  <select
                    value={subBillingCycle}
                    onChange={(e) => setSubBillingCycle(e.target.value as BillingCycle)}
                    className="w-full px-3.5 min-h-[50px] bg-zinc-50 border border-zinc-300 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly (3 Months)</option>
                    <option value="ANNUAL">Annual (12 Months)</option>
                    <option value="CUSTOM">Custom Duration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Validity Days
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={subDurationDays}
                    onChange={(e) => setSubDurationDays(e.target.value)}
                    className="w-full px-4 min-h-[50px] bg-zinc-50 border border-zinc-300 rounded-xl text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Amount Collected (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={subPricePaid}
                  onChange={(e) => setSubPricePaid(e.target.value)}
                  className="w-full px-4 min-h-[50px] bg-zinc-50 border border-zinc-300 rounded-xl text-sm font-mono font-bold"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSubscriptionShop(null)}
                  className="flex-1 min-h-[52px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-2xl active:scale-95 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[52px] bg-zinc-950 hover:bg-zinc-900 text-white font-bold rounded-2xl shadow-xs active:scale-95 transition-all text-sm"
                >
                  Assign Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. SOFT ARCHIVE / DELETE MODAL WITH ORDER COUNT PROTECTION */}
      {archiveShop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-zinc-200">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-7 h-7 shrink-0" />
              <div>
                <h3 className="text-lg font-black text-zinc-950">Archive Shop: {archiveShop.name}</h3>
                <p className="text-xs text-zinc-500">Soft deletion and financial records preservation</p>
              </div>
            </div>

            {archiveOrderCount !== null && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-1.5 text-xs sm:text-sm text-amber-900">
                <span className="font-bold block">
                  Historical Records Protection: {archiveOrderCount} Orders on Record
                </span>
                <p className="text-amber-800 leading-relaxed">
                  This business has <strong>{archiveOrderCount} order transactions</strong> saved in Cloud Firestore. Hard deleting the shop would destroy financial records.
                </p>
                <p className="text-amber-800 leading-relaxed font-semibold">
                  Instead, soft-archiving will immediately suspend login access and hide it from the active counter while safely preserving all historical bills, payments, and audit logs.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Archival Reason
              </label>
              <input
                type="text"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                className="w-full px-4 min-h-[50px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setArchiveShop(null)}
                className="flex-1 min-h-[52px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-2xl active:scale-95 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                className="flex-1 min-h-[52px] bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-xs active:scale-95 transition-all text-sm"
              >
                Confirm Soft Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FEATURE MANAGEMENT MODAL */}
      {featureShop && shopFeatures && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950">Feature Controls: {featureShop.name}</h3>
                  <p className="text-xs text-zinc-500">Toggle POS module access. Changes take effect immediately.</p>
                </div>
              </div>
              <button onClick={() => setFeatureShop(null)} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(FEATURE_METADATA) as FeatureFlagKey[]).map((key) => {
                  const meta = FEATURE_METADATA[key];
                  const isEnabled = shopFeatures[key] !== false;
                  return (
                    <div
                      key={key}
                      onClick={() => handleToggleFeature(key)}
                      className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all active:scale-98 ${
                        isEnabled
                          ? 'border-indigo-200 bg-indigo-50/20'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-zinc-900">{meta?.name || key}</span>
                          {meta?.category && (
                            <span className="text-[9px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded font-bold uppercase">
                              {meta.category}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{meta?.description}</p>
                      </div>

                      <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors shrink-0 ml-2 ${
                        isEnabled ? 'bg-indigo-600' : 'bg-zinc-300'
                      }`}>
                        <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
              <button
                onClick={() => setFeatureShop(null)}
                className="min-h-[48px] px-6 bg-zinc-950 text-white font-bold rounded-2xl text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MEMBER MANAGEMENT MODAL */}
      {memberShop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950">Staff Members: {memberShop.name}</h3>
                  <p className="text-xs text-zinc-500">View staff accounts, login IDs, and toggle active status</p>
                </div>
              </div>
              <button onClick={() => setMemberShop(null)} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {isLoadingMembers ? (
                <div className="text-center py-8 text-zinc-400 text-sm">Loading staff members...</div>
              ) : shopMembers.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-sm">No members registered for this shop.</div>
              ) : (
                shopMembers.map((m) => (
                  <div key={m.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900">{m.name}</span>
                        {m.loginId && (
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                            @{m.loginId}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full">
                          {m.role}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{m.email}</p>
                    </div>

                    <button
                      onClick={() => handleToggleMemberStatus(m)}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        m.status === 'ACTIVE'
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
              <button
                onClick={() => setMemberShop(null)}
                className="min-h-[48px] px-6 bg-zinc-950 text-white font-bold rounded-2xl text-sm"
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
