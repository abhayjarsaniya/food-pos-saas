import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getAllShops, 
  sendShopPasswordReset, 
  updateShopPlan, 
  updateShopStatus 
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
import { AccessPlan, AccountStatus, BusinessFeatures, BusinessMember, FeatureFlagKey, ShopSummary } from '../../types';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
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
  RotateCcw,
  Clock,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  AlertCircle
} from 'lucide-react';

export const AdminShopsPage: React.FC = () => {
  const navigate = useNavigate();

  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');

  // Plan Edit Modal
  const [editingShop, setEditingShop] = useState<ShopSummary | null>(null);
  const [newPlan, setNewPlan] = useState<AccessPlan>('starter');
  const [newExpiryDays, setNewExpiryDays] = useState('30');

  // Feature Control Modal
  const [featureShop, setFeatureShop] = useState<ShopSummary | null>(null);
  const [shopFeatures, setShopFeatures] = useState<BusinessFeatures | null>(null);
  const [featureHistory, setFeatureHistory] = useState<FeatureAuditLog[]>([]);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);

  // Member Management Modal
  const [memberShop, setMemberShop] = useState<ShopSummary | null>(null);
  const [shopMembers, setShopMembers] = useState<BusinessMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [maxMembersCount, setMaxMembersCount] = useState<number>(10);

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    try {
      const data = await getAllShops();
      setShops(data);
    } finally {
      setLoading(false);
    }
  };

  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      if (statusFilter !== 'ALL' && shop.status !== statusFilter) return false;
      if (planFilter !== 'ALL' && shop.plan !== planFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          shop.name.toLowerCase().includes(q) ||
          shop.ownerName.toLowerCase().includes(q) ||
          shop.phone.includes(q) ||
          (shop.ownerEmail && shop.ownerEmail.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [shops, statusFilter, planFilter, searchQuery]);

  const handleToggleStatus = async (shop: ShopSummary) => {
    const nextStatus: AccountStatus = shop.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateShopStatus(shop.id, nextStatus);
      setActionFeedback(`Shop "${shop.name}" status updated to ${nextStatus}.`);
      await loadShops();
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      alert('Failed to update shop status');
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

  const openPlanModal = (shop: ShopSummary) => {
    setEditingShop(shop);
    setNewPlan(shop.plan);
    setNewExpiryDays('30');
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;

    const days = parseInt(newExpiryDays) || 30;
    const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

    try {
      await updateShopPlan(editingShop.id, newPlan, expiresAt);
      setActionFeedback(`Plan updated for "${editingShop.name}". Valid for ${days} days.`);
      await loadShops();
      setEditingShop(null);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      alert('Failed to update plan');
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

  const handleResetFeatures = async () => {
    if (!featureShop) return;
    if (!window.confirm(`Reset all features for "${featureShop.name}" to platform defaults?`)) return;

    try {
      setIsSavingFeatures(true);
      const res = await resetBusinessFeaturesToDefault(featureShop.id, 'Super Admin');
      setShopFeatures(res);
      const history = await getFeatureChangeHistory(featureShop.id);
      setFeatureHistory(history);
      setActionFeedback(`Features reset to platform defaults for ${featureShop.name}.`);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      alert('Failed to reset features');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">All Business Shops</h1>
          <p className="text-xs text-zinc-500">
            Centralized feature management, shop subscription validity, and staff member oversight
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/create-shop')}
          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-semibold rounded-xl shadow-2xs w-fit"
        >
          + Create New Shop
        </button>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by shop name, owner, phone, email..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 focus:bg-white text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800"
          >
            <option value="ALL">All Plans</option>
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Shops Grid */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400 text-xs">Loading registered businesses...</div>
      ) : filteredShops.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-6">
          <Store className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-700">No shops match the criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredShops.map((shop) => {
            const isSuspended = shop.status === 'SUSPENDED';
            return (
              <div
                key={shop.id}
                className={`p-5 bg-white border rounded-2xl shadow-2xs flex flex-col justify-between transition-all ${
                  isSuspended ? 'border-rose-300 bg-rose-50/15' : 'border-zinc-200/90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-zinc-950">{shop.name}</h3>
                        {shop.isDemo && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                            DEMO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 capitalize">
                        {shop.category?.replace('_', ' ')} • Owner: <span className="font-semibold text-zinc-800">{shop.ownerName}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isSuspended
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {shop.status}
                      </span>
                      <span className="text-[10px] font-mono uppercase bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full font-bold">
                        {shop.plan}
                      </span>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{shop.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="truncate">{shop.ownerEmail || 'No Email'}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 mt-2">
                    Registered: {formatDateTime(shop.createdAt)}
                  </p>
                </div>

                {/* Centralized Controls: Features & Staff */}
                <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Feature Management Button */}
                    <button
                      onClick={() => openFeatureModal(shop)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                      title="Manage feature flags for this shop"
                    >
                      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Features</span>
                    </button>

                    {/* Member Controls Button */}
                    <button
                      onClick={() => openMemberModal(shop)}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                      title="Inspect staff members and login IDs"
                    >
                      <Users className="w-3.5 h-3.5 text-zinc-600" />
                      <span>Members</span>
                    </button>

                    <button
                      onClick={() => openPlanModal(shop)}
                      className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                      title="Manage Plan"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Plan</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStatus(shop)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        isSuspended
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isSuspended ? 'Reactivate' : 'Suspend'}
                    </button>

                    {shop.ownerEmail && (
                      <button
                        onClick={() => handlePasswordReset(shop)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                        title="Send Password Reset Email"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. CENTRALIZED FEATURE MANAGEMENT MODAL */}
      {featureShop && shopFeatures && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-zinc-200">
            {/* Header */}
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Feature Controls: {featureShop.name}</h3>
                  <p className="text-xs text-zinc-500">Enable or disable module access. Changes apply immediately to counter navigation.</p>
                </div>
              </div>
              <button
                onClick={() => setFeatureShop(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feature Flags Grid */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Module Availability (16 Flags)
                </span>
                <button
                  type="button"
                  onClick={handleResetFeatures}
                  disabled={isSavingFeatures}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Platform Defaults</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(FEATURE_METADATA) as FeatureFlagKey[]).map((key) => {
                  const meta = FEATURE_METADATA[key];
                  const isEnabled = shopFeatures[key] !== false;

                  return (
                    <div
                      key={key}
                      onClick={() => handleToggleFeature(key)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isEnabled
                          ? 'bg-white border-zinc-300 hover:border-zinc-400 shadow-2xs'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:bg-zinc-100/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold truncate ${isEnabled ? 'text-zinc-900' : 'text-zinc-500 line-through'}`}>
                            {meta.name}
                          </span>
                          <span className="text-[9px] bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded font-mono">
                            {meta.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{meta.description}</p>
                      </div>

                      <div className="shrink-0">
                        {isEnabled ? (
                          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                            <ToggleRight className="w-7 h-7 text-emerald-600" />
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                            <ToggleLeft className="w-7 h-7 text-zinc-300" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feature Change History */}
              {featureHistory.length > 0 && (
                <div className="pt-4 border-t border-zinc-100">
                  <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Recent Feature Change History</span>
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
                    {featureHistory.map((h, i) => (
                      <div key={i} className="p-2 bg-zinc-50 border border-zinc-100 rounded-lg flex items-center justify-between">
                        <span>
                          <strong>{FEATURE_METADATA[h.featureKey as FeatureFlagKey]?.name || h.featureKey}</strong>: {h.previousValue ? 'ON' : 'OFF'} → <strong className={h.newValue ? 'text-emerald-700' : 'text-rose-700'}>{h.newValue ? 'ON' : 'OFF'}</strong>
                        </span>
                        <span className="text-zinc-400 text-[10px]">{formatDateTime(h.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setFeatureShop(null)}
                className="px-5 py-2 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-bold rounded-xl shadow-2xs"
              >
                Close & Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SUPER ADMIN MEMBER CONTROLS MODAL */}
      {memberShop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-zinc-200">
            {/* Header */}
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-950 text-white flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Staff & Member Controls: {memberShop.name}</h3>
                  <p className="text-xs text-zinc-500">Inspect staff login IDs, disable/re-enable member access, and limit member seats.</p>
                </div>
              </div>
              <button
                onClick={() => setMemberShop(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Member List */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Total Staff ({shopMembers.length} Members)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">Max Member Limit:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={maxMembersCount}
                    onChange={(e) => setMaxMembersCount(Number(e.target.value))}
                    className="w-14 px-2 py-0.5 border border-zinc-300 rounded font-mono text-center text-xs"
                  />
                </div>
              </div>

              {isLoadingMembers ? (
                <div className="py-8 text-center text-xs text-zinc-400">Loading shop members...</div>
              ) : shopMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">No staff accounts registered for this shop.</div>
              ) : (
                <div className="space-y-2">
                  {shopMembers.map((m) => {
                    const isOwner = m.role === 'OWNER';
                    const isActive = m.status === 'ACTIVE';

                    return (
                      <div
                        key={m.id}
                        className="p-3 bg-white border border-zinc-200 rounded-xl shadow-2xs flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-zinc-900">{m.name}</span>
                            {m.loginId && (
                              <span className="font-mono text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                @{m.loginId}
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.2 rounded uppercase">
                              {m.role}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.2 rounded uppercase ${
                                isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{m.email}</p>
                        </div>

                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => handleToggleMemberStatus(m)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isActive
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isActive ? 'Disable Access' : 'Re-enable Access'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setMemberShop(null)}
                className="px-5 py-2 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-bold rounded-xl shadow-2xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MANAGE PLAN MODAL */}
      {editingShop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">Manage Shop Subscription</h3>
              <button onClick={() => setEditingShop(null)} className="p-1 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Access Tier
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as AccessPlan)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl"
                >
                  <option value="trial">14-Day Free Trial</option>
                  <option value="starter">Starter Counter Plan</option>
                  <option value="pro">Pro Multi-Counter Plan</option>
                  <option value="enterprise">Enterprise Unlimited</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Validity Extension (Days from today)
                </label>
                <input
                  type="number"
                  min="1"
                  value={newExpiryDays}
                  onChange={(e) => setNewExpiryDays(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingShop(null)}
                  className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-zinc-950 text-white text-xs font-bold rounded-xl shadow-2xs"
                >
                  Update Validity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
