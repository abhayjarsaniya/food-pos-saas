import React, { useEffect, useState } from 'react';
import { 
  getSubscriptionPlans, 
  saveSubscriptionPlan, 
  deleteSubscriptionPlan, 
  assignShopSubscription,
  computeSubscriptionStatus 
} from '../../services/subscription/subscriptionService';
import { getAllShops } from '../../services/admin/superAdminService';
import { 
  AccessPlan, 
  BillingCycle, 
  ShopSummary, 
  SubscriptionPlan, 
  SubscriptionStatus 
} from '../../types';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { formatCurrency } from '../../utils/calculations';
import { 
  CreditCard, 
  CheckCircle2, 
  Calendar, 
  ShieldCheck, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Clock, 
  Users, 
  UtensilsCrossed, 
  AlertCircle,
  Sparkles
} from 'lucide-react';

export const AdminSubscriptionsPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState<'tenants' | 'plans'>('tenants');

  // Plan Edit / Create Modal
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planName, setPlanName] = useState('');
  const [planTierKey, setPlanTierKey] = useState<AccessPlan>('starter');
  const [planDesc, setPlanDesc] = useState('');
  const [planMonthly, setPlanMonthly] = useState('');
  const [planQuarterly, setPlanQuarterly] = useState('');
  const [planAnnual, setPlanAnnual] = useState('');
  const [planMaxMembers, setPlanMaxMembers] = useState('3');
  const [planMaxItems, setPlanMaxItems] = useState('200');
  const [planIsPopular, setPlanIsPopular] = useState(false);

  // Assign Subscription Modal
  const [assignShop, setAssignShop] = useState<ShopSummary | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('plan_pro');
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('MONTHLY');
  const [customDays, setCustomDays] = useState('30');
  const [amountPaid, setAmountPaid] = useState('0');

  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pList, sList] = await Promise.all([
        getSubscriptionPlans(),
        getAllShops(),
      ]);
      setPlans(pList);
      setShops(sList);
    } finally {
      setLoading(false);
    }
  };

  const openCreatePlanModal = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanTierKey('starter');
    setPlanDesc('');
    setPlanMonthly('999');
    setPlanQuarterly('2699');
    setPlanAnnual('9999');
    setPlanMaxMembers('3');
    setPlanMaxItems('200');
    setPlanIsPopular(false);
    setIsPlanModalOpen(true);
  };

  const openEditPlanModal = (p: SubscriptionPlan) => {
    setEditingPlan(p);
    setPlanName(p.name);
    setPlanTierKey(p.tierKey);
    setPlanDesc(p.description);
    setPlanMonthly(String(p.monthlyPrice));
    setPlanQuarterly(String(p.quarterlyPrice));
    setPlanAnnual(String(p.annualPrice));
    setPlanMaxMembers(String(p.maxMembers));
    setPlanMaxItems(String(p.maxMenuItems));
    setPlanIsPopular(p.isPopular || false);
    setIsPlanModalOpen(true);
  };

  const handleSavePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return;

    const planId = editingPlan ? editingPlan.id : `plan_${Date.now()}`;
    const planObj: SubscriptionPlan = {
      id: planId,
      name: planName.trim(),
      tierKey: planTierKey,
      description: planDesc.trim(),
      monthlyPrice: parseFloat(planMonthly) || 0,
      quarterlyPrice: parseFloat(planQuarterly) || 0,
      annualPrice: parseFloat(planAnnual) || 0,
      currency: 'INR',
      maxMembers: parseInt(planMaxMembers) || 3,
      maxMenuItems: parseInt(planMaxItems) || -1,
      features: editingPlan?.features || {
        billing: true,
        orders: true,
        pendingPayments: true,
        menuManagement: true,
        tableManagement: planTierKey !== 'starter',
        suppliers: planTierKey !== 'starter',
        inventory: planTierKey !== 'starter',
        purchaseOrders: planTierKey !== 'starter',
        reports: true,
        gst: true,
        whatsapp: true,
        printing: true,
      },
      isPopular: planIsPopular,
      isActive: true,
      createdAt: editingPlan?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveSubscriptionPlan(planObj);
      setFeedback(`Subscription plan "${planName}" saved successfully.`);
      await loadData();
      setIsPlanModalOpen(false);
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      alert('Failed to save subscription plan');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this subscription plan?')) return;
    try {
      await deleteSubscriptionPlan(planId);
      setFeedback('Subscription plan removed.');
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      alert('Failed to delete plan');
    }
  };

  const openAssignModal = (shop: ShopSummary) => {
    setAssignShop(shop);
    setSelectedPlanId(shop.plan === 'enterprise' ? 'plan_enterprise' : shop.plan === 'starter' ? 'plan_starter' : 'plan_pro');
    setSelectedCycle('MONTHLY');
    setCustomDays('30');
    setAmountPaid('0');
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignShop) return;

    const days = parseInt(customDays) || 30;
    const price = parseFloat(amountPaid) || 0;

    try {
      await assignShopSubscription(assignShop.id, {
        planId: selectedPlanId,
        billingCycle: selectedCycle,
        durationDays: days,
        pricePaid: price,
        autoRenew: false,
        notes: `Assigned via Admin Subscriptions. Duration: ${days} days.`,
      });
      setFeedback(`Subscription renewed for "${assignShop.name}".`);
      await loadData();
      setAssignShop(null);
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      alert('Failed to assign subscription');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">Subscriptions & Pricing Plans</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Configure multi-tier SaaS pricing (Starter, Pro, Enterprise) and manage tenant renewal validity
          </p>
        </div>

        {activeTab === 'plans' && (
          <button
            onClick={openCreatePlanModal}
            className="min-h-[48px] px-5 bg-zinc-950 hover:bg-zinc-900 text-white text-sm font-bold rounded-2xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 w-full sm:w-fit"
          >
            <Plus className="w-5 h-5" />
            <span>Add Subscription Plan</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Tabs (Touch friendly min 48px) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`min-h-[48px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all active:scale-95 flex items-center gap-2 ${
            activeTab === 'tenants'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Tenant Subscriptions ({shops.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`min-h-[48px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all active:scale-95 flex items-center gap-2 ${
            activeTab === 'plans'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Platform Plans ({plans.length})</span>
        </button>
      </div>

      {/* TAB 1: TENANT SUBSCRIPTIONS */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-zinc-950">Active Tenant Access & Expirations</h2>

            {loading ? (
              <div className="py-12 text-center text-zinc-400 text-sm">Loading subscriptions...</div>
            ) : shops.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-sm">No shops registered yet.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {shops.map((s) => {
                  const now = new Date().getTime();
                  const expTime = s.planExpiresAt ? new Date(s.planExpiresAt).getTime() : now + 30 * 24 * 3600 * 1000;
                  const daysRemaining = Math.max(0, Math.ceil((expTime - now) / (1000 * 3600 * 24)));
                  const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
                  const isExpired = daysRemaining === 0;

                  return (
                    <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-zinc-950">{s.name}</span>
                          <span className="text-xs uppercase bg-zinc-100 text-zinc-800 font-mono font-bold px-2.5 py-0.5 rounded-full">
                            {s.plan}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                              s.status === 'SUSPENDED'
                                ? 'bg-rose-100 text-rose-800'
                                : isExpired
                                ? 'bg-rose-100 text-rose-800'
                                : isExpiringSoon
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {s.status === 'SUSPENDED' 
                              ? 'Suspended' 
                              : isExpired 
                              ? 'Expired' 
                              : isExpiringSoon 
                              ? 'Expiring Soon' 
                              : 'Active'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          Owner: <span className="font-semibold text-zinc-800">{s.ownerName}</span> • Phone: {s.phone}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                          Expires: {s.planExpiresAt ? formatDateTime(s.planExpiresAt) : '30 Days'} • ({daysRemaining} days left)
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openAssignModal(s)}
                          className="min-h-[46px] px-4 bg-zinc-950 hover:bg-zinc-900 text-white text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 shadow-2xs"
                        >
                          Renew / Change Plan
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PLATFORM SUBSCRIPTION PLANS (CRUD) */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`p-6 bg-white border rounded-3xl shadow-xs flex flex-col justify-between transition-all relative ${
                p.isPopular ? 'border-zinc-950 ring-2 ring-zinc-950' : 'border-zinc-200/90'
              }`}
            >
              <div>
                {p.isPopular && (
                  <span className="absolute -top-3 right-6 bg-zinc-950 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full shadow-xs">
                    Most Popular
                  </span>
                )}

                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-black text-zinc-950">{p.name}</h3>
                  <span className="text-[10px] uppercase font-mono font-bold bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full">
                    {p.tierKey}
                  </span>
                </div>

                <p className="text-xs text-zinc-500 min-h-[36px]">{p.description}</p>

                {/* Pricing Grid */}
                <div className="my-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-1.5 font-mono">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-zinc-500">Monthly:</span>
                    <span className="text-lg font-black text-zinc-950">{formatCurrency(p.monthlyPrice)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-zinc-500">Quarterly:</span>
                    <span className="text-sm font-bold text-zinc-800">{formatCurrency(p.quarterlyPrice)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-zinc-500">Annual:</span>
                    <span className="text-sm font-bold text-emerald-700">{formatCurrency(p.annualPrice)}</span>
                  </div>
                </div>

                {/* Limits */}
                <div className="space-y-1.5 text-xs text-zinc-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-400" />
                    <span>{p.maxMembers === -1 ? 'Unlimited Staff' : `Up to ${p.maxMembers} Staff Members`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-zinc-400" />
                    <span>{p.maxMenuItems === -1 ? 'Unlimited Menu Items' : `Up to ${p.maxMenuItems} Menu Items`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-zinc-400" />
                    <span>{p.tierKey === 'starter' ? 'Single Counter POS' : 'Table Management & Inventory Included'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                <button
                  onClick={() => openEditPlanModal(p)}
                  className="flex-1 min-h-[46px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Plan</span>
                </button>

                <button
                  onClick={() => handleDeletePlan(p.id)}
                  className="w-12 h-12 min-w-[46px] min-h-[46px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center transition-all active:scale-90"
                  title="Delete Plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PLAN CREATE / EDIT MODAL */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-zinc-800" />
                <h3 className="text-lg font-extrabold text-zinc-950">
                  {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create Subscription Plan'}
                </h3>
              </div>
              <button onClick={() => setIsPlanModalOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlanSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g. Starter Counter"
                  className="w-full px-4 min-h-[50px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Tier Identifier
                </label>
                <select
                  value={planTierKey}
                  onChange={(e) => setPlanTierKey(e.target.value as AccessPlan)}
                  className="w-full px-4 min-h-[50px] text-sm bg-zinc-50 border border-zinc-300 rounded-2xl cursor-pointer"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  placeholder="Plan feature summary..."
                  className="w-full p-3.5 text-sm bg-zinc-50 border border-zinc-300 rounded-2xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Monthly (₹)</label>
                  <input
                    type="number"
                    required
                    value={planMonthly}
                    onChange={(e) => setPlanMonthly(e.target.value)}
                    className="w-full px-3 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Quarterly (₹)</label>
                  <input
                    type="number"
                    required
                    value={planQuarterly}
                    onChange={(e) => setPlanQuarterly(e.target.value)}
                    className="w-full px-3 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Annual (₹)</label>
                  <input
                    type="number"
                    required
                    value={planAnnual}
                    onChange={(e) => setPlanAnnual(e.target.value)}
                    className="w-full px-3 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Max Staff (-1 for unltd)</label>
                  <input
                    type="number"
                    value={planMaxMembers}
                    onChange={(e) => setPlanMaxMembers(e.target.value)}
                    className="w-full px-4 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Max Menu Items (-1 for unltd)</label>
                  <input
                    type="number"
                    value={planMaxItems}
                    onChange={(e) => setPlanMaxItems(e.target.value)}
                    className="w-full px-4 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={planIsPopular}
                  onChange={(e) => setPlanIsPopular(e.target.checked)}
                  className="w-6 h-6 rounded-lg text-zinc-950 focus:ring-zinc-900 cursor-pointer"
                />
                <span className="text-sm font-bold text-zinc-800">Mark as 'Most Popular' plan badge</span>
              </label>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="flex-1 min-h-[52px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-2xl text-sm active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[52px] bg-zinc-950 hover:bg-zinc-900 text-white font-bold rounded-2xl shadow-xs text-sm active:scale-95 transition-all"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN / RENEW MODAL */}
      {assignShop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-zinc-800" />
                <h3 className="text-lg font-extrabold text-zinc-950">Renew Subscription: {assignShop.name}</h3>
              </div>
              <button onClick={() => setAssignShop(null)} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Select Plan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`min-h-[48px] text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                        selectedPlanId === p.id
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
                    value={selectedCycle}
                    onChange={(e) => setSelectedCycle(e.target.value as BillingCycle)}
                    className="w-full px-3.5 min-h-[50px] bg-zinc-50 border border-zinc-300 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly (3 Months)</option>
                    <option value="ANNUAL">Annual (1 Year)</option>
                    <option value="CUSTOM">Custom Days</option>
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
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
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
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-4 min-h-[50px] bg-zinc-50 border border-zinc-300 rounded-xl text-sm font-mono font-bold"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignShop(null)}
                  className="flex-1 min-h-[52px] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-2xl text-sm active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[52px] bg-zinc-950 hover:bg-zinc-900 text-white font-bold rounded-2xl shadow-xs text-sm active:scale-95 transition-all"
                >
                  Confirm Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
