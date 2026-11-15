import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNewShop, CreateShopResult, isLoginIdAvailable } from '../../services/admin/superAdminService';
import { AccessPlan, BillingCycle, BusinessCategory } from '../../types';
import { 
  Store, 
  CheckCircle2, 
  Copy, 
  KeyRound, 
  ExternalLink, 
  ArrowRight,
  ShieldCheck,
  Sparkles,
  User,
  Mail,
  Phone,
  Building,
  CreditCard,
  Lock
} from 'lucide-react';

export const AdminCreateShopPage: React.FC = () => {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('restaurant');
  const [address, setAddress] = useState('');
  const [plan, setPlan] = useState<AccessPlan>('pro');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [validityDays, setValidityDays] = useState('30');
  const [customPassword, setCustomPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<CreateShopResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!businessName.trim() || !ownerEmail.trim() || !phone.trim()) {
      setFormError('Please fill out all required fields.');
      return;
    }

    // Check login ID if specified
    if (loginId.trim()) {
      const isAvail = await isLoginIdAvailable(loginId.trim().toLowerCase());
      if (!isAvail) {
        setFormError(`Login ID "${loginId.trim()}" is already taken. Please choose another.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const days = parseInt(validityDays) || 30;
      const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

      const result = await createNewShop({
        name: businessName.trim(),
        brandName: brandName.trim() || businessName.trim(),
        loginId: loginId.trim() || undefined,
        ownerName: ownerName.trim() || 'Business Owner',
        ownerEmail: ownerEmail.trim().toLowerCase(),
        phone: phone.trim(),
        category,
        address: address.trim(),
        plan,
        billingCycle,
        planExpiresAt: expiresAt,
        temporaryPassword: customPassword.trim() || undefined,
      });

      setCreatedResult(result);
    } catch (err: any) {
      setFormError(err.message || 'Shop creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const text = `====================================
Food POS - Shop Onboarding Credentials
====================================
Shop Name: ${createdResult.profile.name}
Brand: ${createdResult.profile.brandName || createdResult.profile.name}
Business ID: ${createdResult.businessId}
Owner Login ID: @${createdResult.loginId}
Registered Email: ${createdResult.email}
Temporary Password: ${createdResult.temporaryPassword}
Plan Assigned: ${createdResult.profile.plan.toUpperCase()}
Access Expiration: ${createdResult.profile.planExpiresAt ? new Date(createdResult.profile.planExpiresAt).toLocaleDateString('en-IN') : '30 Days'}

Counter Login URL: ${window.location.origin}/login
====================================`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">Provision New Business Tenant</h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Create a new isolated restaurant or food counter, generate staff credentials and initialize subscription
        </p>
      </div>

      {formError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold rounded-2xl flex items-center gap-2">
          <span>{formError}</span>
        </div>
      )}

      {createdResult ? (
        /* SUCCESS CREDENTIALS DISPLAY */
        <div className="bg-white border border-emerald-300 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-950">Shop Successfully Created!</h2>
              <p className="text-xs sm:text-sm text-zinc-500">
                The business tenant and its staff credentials have been provisioned in Cloud Firestore.
              </p>
            </div>
          </div>

          {/* Credentials Box */}
          <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2.5 text-xs sm:text-sm font-mono">
            <div className="flex justify-between border-b border-zinc-200/60 pb-2">
              <span className="text-zinc-500 font-sans">Business Name:</span>
              <span className="font-bold text-zinc-900 font-sans">{createdResult.profile.name}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200/60 pb-2">
              <span className="text-zinc-500 font-sans">Tenant ID:</span>
              <span className="font-bold text-zinc-800">{createdResult.businessId}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200/60 pb-2">
              <span className="text-zinc-500 font-sans">Owner Login ID:</span>
              <span className="font-bold text-indigo-700">@{createdResult.loginId}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200/60 pb-2">
              <span className="text-zinc-500 font-sans">Login Email:</span>
              <span className="font-bold text-zinc-900">{createdResult.email}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200/60 pb-2">
              <span className="text-zinc-500 font-sans">Temporary Password:</span>
              <span className="font-bold text-emerald-600 font-mono text-base">{createdResult.temporaryPassword}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 font-sans">Plan Assigned:</span>
              <span className="uppercase text-indigo-600 font-bold">{createdResult.profile.plan}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={handleCopyCredentials}
              className="w-full sm:flex-1 min-h-[52px] bg-zinc-950 hover:bg-zinc-900 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
            >
              <Copy className="w-5 h-5" />
              <span>{copied ? 'Credentials Copied!' : 'Copy Full Login Details'}</span>
            </button>

            <button
              onClick={() => {
                setCreatedResult(null);
                setBusinessName('');
                setBrandName('');
                setLoginId('');
                setOwnerName('');
                setOwnerEmail('');
                setPhone('');
                setAddress('');
              }}
              className="w-full sm:w-auto px-6 min-h-[52px] border border-zinc-300 text-zinc-700 text-sm font-bold rounded-2xl hover:bg-zinc-50 transition-all active:scale-95"
            >
              Create Another Shop
            </button>

            <button
              onClick={() => navigate('/admin/shops')}
              className="w-full sm:w-auto px-6 min-h-[52px] bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-sm font-bold rounded-2xl transition-all active:scale-95"
            >
              Back to Directory
            </button>
          </div>
        </div>
      ) : (
        /* SHOP CREATION FORM (Touch friendly min 52px) */
        <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Business / Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Prince Pavbhaji"
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Brand / Signboard Name
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Prince Bhajipav Manekchowkwala"
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Owner / Manager Name *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Business Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BusinessCategory)}
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer"
                >
                  <option value="restaurant">Restaurant & Dining</option>
                  <option value="cafe">Cafe & Beverages</option>
                  <option value="food_stall">Food Stall / Food Truck</option>
                  <option value="bakery">Bakery & Desserts</option>
                  <option value="takeaway">Takeaway Counter</option>
                  <option value="sweet_shop">Sweets & Snacks</option>
                  <option value="cloud_kitchen">Cloud Kitchen</option>
                  <option value="other">General Outlet</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Owner Login Email *
                </label>
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@princepavbhaji.com"
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Counter Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98250 12345"
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Custom Staff / Owner Login ID
                </label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="e.g. princeowner (auto-generated if empty)"
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base font-mono bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Custom Temporary Password
                </label>
                <input
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Leave empty for auto-generated password"
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Physical Shop Address
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Outlet / Shop full address..."
                className="w-full p-4 text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {/* Plan & Subscription Configuration */}
            <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-3xl space-y-4">
              <span className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider block">
                Initial Subscription & Access Validity
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1">Access Plan</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as AccessPlan)}
                    className="w-full px-3.5 min-h-[50px] text-xs sm:text-sm bg-white border border-zinc-300 rounded-xl cursor-pointer"
                  >
                    <option value="trial">14-Day Free Trial</option>
                    <option value="starter">Starter Counter</option>
                    <option value="pro">Pro Counter</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1">Billing Cycle</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="w-full px-3.5 min-h-[50px] text-xs sm:text-sm bg-white border border-zinc-300 rounded-xl cursor-pointer"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly (3 Months)</option>
                    <option value="ANNUAL">Annual (1 Year)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1">Validity (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    className="w-full px-4 min-h-[50px] text-sm bg-white border border-zinc-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[56px] bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 mt-2"
            >
              <span>{isSubmitting ? 'Provisioning Shop...' : 'Create Shop & Generate Credentials'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
