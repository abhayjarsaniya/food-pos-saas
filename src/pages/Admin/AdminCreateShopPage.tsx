import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNewShop, CreateShopResult } from '../../services/admin/superAdminService';
import { AccessPlan, BusinessCategory } from '../../types';
import { 
  Store, 
  CheckCircle2, 
  Copy, 
  KeyRound, 
  ExternalLink, 
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export const AdminCreateShopPage: React.FC = () => {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('cafe');
  const [address, setAddress] = useState('');
  const [plan, setPlan] = useState<AccessPlan>('starter');
  const [validityDays, setValidityDays] = useState('30');
  const [customPassword, setCustomPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<CreateShopResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerEmail.trim() || !phone.trim()) {
      alert('Please fill out all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const days = parseInt(validityDays) || 30;
      const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

      const result = await createNewShop({
        name: businessName.trim(),
        ownerName: ownerName.trim() || 'Owner',
        ownerEmail: ownerEmail.trim().toLowerCase(),
        phone: phone.trim(),
        category,
        address: address.trim(),
        plan,
        planExpiresAt: expiresAt,
        temporaryPassword: customPassword.trim() || undefined,
      });

      setCreatedResult(result);
    } catch (err: any) {
      alert(err.message || 'Shop creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const text = `Food POS Onboarding Credentials
Business: ${createdResult.profile.name}
Login Email: ${createdResult.email}
Temporary Password: ${createdResult.temporaryPassword}
Login URL: ${window.location.origin}/login`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Create New Business Tenant</h1>
        <p className="text-xs text-zinc-500">
          Provision an independent restaurant or cafe shop, generate auth credentials and assign access plan
        </p>
      </div>

      {createdResult ? (
        /* SUCCESS CREDENTIALS DISPLAY */
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-900">Shop Successfully Created!</h2>
            <p className="text-xs text-zinc-500">
              The business tenant has been provisioned and its credentials are ready to share with the owner.
            </p>
          </div>

          {/* Credentials Box */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-zinc-500">Business Name:</span>
              <span className="font-bold text-zinc-900">{createdResult.profile.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Tenant ID:</span>
              <span className="text-zinc-900">{createdResult.businessId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Login Email:</span>
              <span className="font-bold text-zinc-900">{createdResult.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Temporary Password:</span>
              <span className="font-bold text-indigo-600">{createdResult.temporaryPassword}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Plan Assigned:</span>
              <span className="uppercase text-emerald-600 font-bold">{createdResult.profile.plan}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <button
              onClick={handleCopyCredentials}
              className="w-full sm:flex-1 py-3 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
            >
              <Copy className="w-4 h-4" />
              <span>{copied ? 'Credentials Copied!' : 'Copy Login Details'}</span>
            </button>

            <button
              onClick={() => {
                setCreatedResult(null);
                setBusinessName('');
                setOwnerName('');
                setOwnerEmail('');
                setPhone('');
              }}
              className="w-full sm:w-auto px-5 py-3 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl hover:bg-zinc-50"
            >
              Create Another Shop
            </button>
          </div>
        </div>
      ) : (
        /* SHOP CREATION FORM */
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-2xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Food Shop / Business Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Bombay Frankie & Chai Bar"
                className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Owner / Cashier Name *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Business Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BusinessCategory)}
                  className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                >
                  <option value="cafe">Cafe & Beverages</option>
                  <option value="restaurant">Restaurant & Dining</option>
                  <option value="food_stall">Food Stall / Food Truck</option>
                  <option value="bakery">Bakery & Desserts</option>
                  <option value="takeaway">Takeaway Counter</option>
                  <option value="sweet_shop">Sweets & Snacks</option>
                  <option value="other">General Food Counter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Owner Login Email *
                </label>
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@foodstall.com"
                  className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Counter Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9825012345"
                  className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Physical Shop Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Market Stall No 12, MG Road, Ahmedabad"
                className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
              />
            </div>

            {/* Plan & Security Box */}
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3.5">
              <span className="text-xs font-bold text-zinc-900 block">Subscription & Access Security</span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Access Plan</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as AccessPlan)}
                    className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
                  >
                    <option value="trial">14-Day Free Trial</option>
                    <option value="starter">Starter Counter</option>
                    <option value="pro">Pro Multi-Counter</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Validity (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Custom Temp Password</label>
                  <input
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <span>{isSubmitting ? 'Provisioning Shop...' : 'Create Shop & Generate Credentials'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
