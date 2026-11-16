import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../contexts/SyncContext';
import { BusinessCategory, PricingMode, ReceiptFormat, PaymentMethod, SubscriptionRecord } from '../../types';
import { getShopSubscription } from '../../services/subscription/subscriptionService';
import { updateOwnerLoginId, updateOwnerEmailAddress, changeOwnerAccountPassword } from '../../services/auth/accountService';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { 
  Building, 
  Receipt, 
  Percent, 
  Smartphone, 
  RefreshCw, 
  LogOut, 
  Check, 
  Store,
  Wifi,
  WifiOff,
  LayoutGrid,
  ChevronRight,
  Shield,
  KeyRound,
  CreditCard,
  User,
  Mail,
  Phone,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, settings, updateProfile, updateSettings, logout } = useAuth();
  const { isOnline, pendingCount, isSyncing, triggerSync } = useSync();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'account' | 'subscription'>('profile');

  // Profile Form
  const [name, setName] = useState(profile?.name || '');
  const [brandName, setBrandName] = useState(profile?.brandName || profile?.name || '');
  const [ownerName, setOwnerName] = useState(profile?.ownerName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [category, setCategory] = useState<BusinessCategory>(profile?.category || 'restaurant');
  const [address, setAddress] = useState(profile?.address || '');

  // Tax Form
  const [gstEnabled, setGstEnabled] = useState(settings.tax.enabled);
  const [gstin, setGstin] = useState(settings.tax.gstin);
  const [defaultGstRate, setDefaultGstRate] = useState(settings.tax.defaultGstRate);
  const [pricingMode, setPricingMode] = useState<PricingMode>(settings.tax.pricingMode);
  const [isInterState, setIsInterState] = useState(settings.tax.isInterState || false);

  // Receipt Form
  const [defaultFormat, setDefaultFormat] = useState<ReceiptFormat>(settings.receipt.defaultFormat);
  const [showAddress, setShowAddress] = useState(settings.receipt.showAddress);
  const [showPhone, setShowPhone] = useState(settings.receipt.showPhone);
  const [showGstin, setShowGstin] = useState(settings.receipt.showGstin);
  const [footerMessage, setFooterMessage] = useState(settings.receipt.footerMessage);

  // Billing Form
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethod>(settings.billing.defaultPaymentMethod);
  const [billNumberPrefix, setBillNumberPrefix] = useState(settings.billing.billNumberPrefix);

  // Account & Security Form
  const [currentLoginId, setCurrentLoginId] = useState(profile?.loginId || 'owner01');
  const [newLoginId, setNewLoginId] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(profile?.ownerEmail || 'owner@foodpos.app');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Subscription state
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      setName(profile.name || '');
      setBrandName(profile.brandName || profile.name || '');
      setOwnerName(profile.ownerName || '');
      setPhone(profile.phone || '');
      setCategory(profile.category || 'restaurant');
      setAddress(profile.address || '');
      if (profile.loginId) setCurrentLoginId(profile.loginId);
      if (profile.ownerEmail) setOwnerEmail(profile.ownerEmail);

      loadSubscription(profile.id);
    }
  }, [profile]);

  const loadSubscription = async (businessId: string) => {
    try {
      const sub = await getShopSubscription(businessId);
      setSubscription(sub);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        name: name.trim(),
        brandName: brandName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        category,
        address: address.trim(),
      });
      setSavingStatus('Profile details updated successfully!');
      setTimeout(() => setSavingStatus(null), 3000);
    } catch {
      alert('Failed to update profile');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({
        tax: {
          enabled: gstEnabled,
          gstin: gstEnabled ? gstin.trim() : '',
          defaultGstRate,
          pricingMode,
          isInterState,
        },
        receipt: {
          defaultFormat,
          showLogo: true,
          showAddress,
          showPhone,
          showGstin: gstEnabled ? showGstin : false,
          footerMessage: footerMessage.trim(),
        },
        billing: {
          defaultPaymentMethod,
          billNumberPrefix: billNumberPrefix.trim() || 'BILL-',
          nextBillNumber: settings.billing.nextBillNumber,
        },
      });
      setSavingStatus('Tax & receipt settings updated successfully!');
      setTimeout(() => setSavingStatus(null), 3000);
    } catch {
      alert('Failed to update settings');
    }
  };

  const handleChangeLoginId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !newLoginId.trim()) return;
    setIsSubmittingAccount(true);
    setAccountFeedback(null);

    try {
      const res = await updateOwnerLoginId(profile.id, newLoginId.trim());
      if (res.success) {
        setCurrentLoginId(newLoginId.trim().toLowerCase());
        setNewLoginId('');
        setAccountFeedback({ type: 'success', message: res.message });
      } else {
        setAccountFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setAccountFeedback({ type: 'error', message: err.message || 'Failed to update login ID.' });
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !newOwnerEmail.trim()) return;
    setIsSubmittingAccount(true);
    setAccountFeedback(null);

    try {
      const res = await updateOwnerEmailAddress(profile.id, newOwnerEmail.trim(), currentPassword);
      if (res.success) {
        setOwnerEmail(newOwnerEmail.trim().toLowerCase());
        setNewOwnerEmail('');
        setCurrentPassword('');
        setAccountFeedback({ type: 'success', message: res.message });
      } else {
        setAccountFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setAccountFeedback({ type: 'error', message: err.message || 'Failed to update email address.' });
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setAccountFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setAccountFeedback({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }

    setIsSubmittingAccount(true);
    setAccountFeedback(null);

    try {
      const res = await changeOwnerAccountPassword(currentPassword, newPassword);
      if (res.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setAccountFeedback({ type: 'success', message: res.message });
      } else {
        setAccountFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setAccountFeedback({ type: 'error', message: err.message || 'Failed to change password.' });
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  return (
    <div className="space-y-6 w-full min-w-0 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">Shop Settings</h1>
        <p className="hidden md:block text-xs sm:text-sm text-zinc-500 mt-1">
          Manage your business profile, GST tax rates, receipt layouts, staff credentials and subscription
        </p>
      </div>

      {savingStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-200">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{savingStatus}</span>
        </div>
      )}

      {/* TABLE MANAGEMENT SHORTCUT BANNER (Large touch banner) */}
      <div 
        onClick={() => navigate('/tables')}
        className="min-h-[72px] bg-gradient-to-r from-zinc-900 to-zinc-800 text-white p-5 rounded-2xl shadow-md flex items-center justify-between cursor-pointer hover:from-zinc-800 hover:to-zinc-700 transition-all border border-zinc-700/50 group active:scale-[0.99]"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
            <LayoutGrid className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold">Table Management</h2>
              <span className="text-[11px] bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded-full">
                Unlimited Tables
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 mt-0.5">
              Create custom dining tables, family booths, VIP lounges & monitor live occupancy
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm font-bold text-zinc-300 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0">
          <span className="hidden sm:inline">Manage Tables</span>
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>

      {/* TAB NAVIGATION PILLS (Touch Friendly min 48px) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'profile' as const, label: 'Business Profile', icon: Store },
          { id: 'billing' as const, label: 'Tax & Receipts', icon: Percent },
          { id: 'account' as const, label: 'Account & Security', icon: Shield },
          { id: 'subscription' as const, label: 'Subscription Plan', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[48px] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 flex items-center gap-2 ${
                isActive
                  ? 'bg-[#145C43] text-white shadow-xs'
                  : 'bg-[#F7F9F7] text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43] border border-[#E5EAE6]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BUSINESS PROFILE */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <Store className="w-5 h-5 text-zinc-800" />
            <h2 className="text-base font-bold text-zinc-900">Business & Counter Profile</h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Business / Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]"
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
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Owner / Manager Name
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Counter Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BusinessCategory)}
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43] cursor-pointer"
                >
                  <option value="restaurant">Restaurant & Dining</option>
                  <option value="cafe">Cafe & Beverages</option>
                  <option value="food_stall">Food Stall / Food Truck / Fast Food</option>
                  <option value="bakery">Bakery & Desserts</option>
                  <option value="takeaway">Takeaway Counter</option>
                  <option value="sweet_shop">Sweets & Snacks</option>
                  <option value="cloud_kitchen">Cloud Kitchen</option>
                  <option value="other">General Food Counter</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Shop / Outlet Address
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-3.5 text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto min-h-[52px] px-6 bg-[#145C43] hover:bg-[#0F4935] text-white text-sm sm:text-base font-bold rounded-2xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              <span>Update Business Profile</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: TAX & RECEIPTS */}
      {activeTab === 'billing' && (
        <div className="space-y-5">
          {/* GST Configuration */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-zinc-800" />
                <h2 className="text-base font-bold text-zinc-900">GST & Tax Configuration</h2>
              </div>
              <button
                type="button"
                onClick={() => setGstEnabled(!gstEnabled)}
                className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors ${
                  gstEnabled ? 'bg-[#145C43]' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    gstEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-500">
              {gstEnabled
                ? 'GST is enabled. Tax breakdowns (CGST/SGST/IGST) will be computed and saved on every order.'
                : 'GST is disabled. Simple receipts without tax fields will be generated.'}
            </p>

            {gstEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="24ABCDE1234F1Z5"
                    className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Default GST Rate
                  </label>
                  <select
                    value={defaultGstRate}
                    onChange={(e) => setDefaultGstRate(Number(e.target.value))}
                    className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl cursor-pointer"
                  >
                    <option value={5}>5% (Standard Food / Cafe)</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Pricing Mode
                  </label>
                  <select
                    value={pricingMode}
                    onChange={(e) => setPricingMode(e.target.value as PricingMode)}
                    className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl cursor-pointer"
                  >
                    <option value="exclusive">Exclusive (Add GST on subtotal)</option>
                    <option value="inclusive">Inclusive (GST included in price)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Receipt & Billing Preferences */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
              <Receipt className="w-5 h-5 text-zinc-800" />
              <h2 className="text-base font-bold text-zinc-900">Receipt & Print Preferences</h2>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Default PDF Format
                  </label>
                  <select
                    value={defaultFormat}
                    onChange={(e) => setDefaultFormat(e.target.value as ReceiptFormat)}
                    className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl cursor-pointer"
                  >
                    <option value="compact80">Compact 80mm Thermal</option>
                    <option value="compact58">Compact 58mm Thermal</option>
                    <option value="a4">Standard A4 Tax Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Default Payment Method
                  </label>
                  <select
                    value={defaultPaymentMethod}
                    onChange={(e) => setDefaultPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl cursor-pointer"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Bill Prefix
                  </label>
                  <input
                    type="text"
                    value={billNumberPrefix}
                    onChange={(e) => setBillNumberPrefix(e.target.value.toUpperCase())}
                    placeholder="BILL-"
                    className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Receipt Footer Note
                </label>
                <input
                  type="text"
                  value={footerMessage}
                  onChange={(e) => setFooterMessage(e.target.value)}
                  placeholder="e.g. Thank you! Visit again."
                  className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl"
                />
              </div>

              {/* Large Touch Checkboxes (min 44px hit area) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
                <label className="flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAddress}
                    onChange={(e) => setShowAddress(e.target.checked)}
                    className="w-6 h-6 rounded-lg text-[#145C43] focus:ring-[#145C43] border-zinc-300 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-zinc-800">Show Address on Receipt</span>
                </label>

                <label className="flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPhone}
                    onChange={(e) => setShowPhone(e.target.checked)}
                    className="w-6 h-6 rounded-lg text-[#145C43] focus:ring-[#145C43] border-zinc-300 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-zinc-800">Show Phone on Receipt</span>
                </label>

                <label className="flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showGstin}
                    onChange={(e) => setShowGstin(e.target.checked)}
                    className="w-6 h-6 rounded-lg text-[#145C43] focus:ring-[#145C43] border-zinc-300 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-zinc-800">Show GSTIN on Receipt</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto min-h-[52px] px-6 bg-[#145C43] hover:bg-[#0F4935] text-white text-sm sm:text-base font-bold rounded-2xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                <span>Save All Preferences</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: ACCOUNT & SECURITY */}
      {activeTab === 'account' && (
        <div className="space-y-5">
          {accountFeedback && (
            <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-2.5 ${
              accountFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {accountFeedback.type === 'success' ? (
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{accountFeedback.message}</span>
            </div>
          )}

          {/* Section: Change Login ID */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
              <User className="w-5 h-5 text-zinc-800" />
              <h2 className="text-base font-bold text-zinc-900">Counter Login ID</h2>
            </div>

            <p className="text-xs sm:text-sm text-zinc-500">
              Your Login ID allows instant login to the counter portal without typing an email address.
            </p>

            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Current Login ID</span>
                <span className="text-base font-bold font-mono text-zinc-900">{currentLoginId}</span>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">
                Active
              </span>
            </div>

            <form onSubmit={handleChangeLoginId} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Change Login ID
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    value={newLoginId}
                    onChange={(e) => setNewLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="Enter new unique login ID (e.g. princeowner)"
                    className="flex-1 px-4 min-h-[52px] text-sm sm:text-base bg-white border border-zinc-300 rounded-2xl font-mono focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingAccount || !newLoginId.trim()}
                    className="min-h-[52px] px-6 bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-sm sm:text-base rounded-2xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmittingAccount ? 'Updating...' : 'Update Login ID'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section: Change Account Email */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
              <Mail className="w-5 h-5 text-zinc-800" />
              <h2 className="text-base font-bold text-zinc-900">Owner Email Address</h2>
            </div>

            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Registered Email</span>
                <span className="text-sm sm:text-base font-bold text-zinc-900">{ownerEmail}</span>
              </div>
            </div>

            <form onSubmit={handleChangeEmail} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Update Email Address
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email"
                    required
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    placeholder="Enter new verified email address"
                    className="flex-1 px-4 min-h-[52px] text-sm sm:text-base bg-white border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingAccount || !newOwnerEmail.trim()}
                    className="min-h-[52px] px-6 bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-sm sm:text-base rounded-2xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmittingAccount ? 'Updating...' : 'Update Email'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section: Change Password */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
              <KeyRound className="w-5 h-5 text-zinc-800" />
              <h2 className="text-base font-bold text-zinc-900">Change Password</h2>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-4 min-h-[52px] text-sm sm:text-base bg-zinc-50 border border-zinc-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAccount}
                className="w-full sm:w-auto min-h-[52px] px-6 bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-sm sm:text-base rounded-2xl shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmittingAccount ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: SUBSCRIPTION PLAN */}
      {activeTab === 'subscription' && (
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <CreditCard className="w-5 h-5 text-zinc-800" />
            <h2 className="text-base font-bold text-zinc-900">Current Subscription & Plan</h2>
          </div>

          {loadingSubscription ? (
            <div className="py-8 text-center text-zinc-400 text-sm">Loading subscription status...</div>
          ) : (
            <div className="space-y-4">
              <div className="p-5 bg-gradient-to-br from-zinc-950 to-zinc-800 text-white rounded-2xl shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Active Plan
                  </span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
                    {subscription?.status || 'ACTIVE'}
                  </span>
                </div>

                <div className="text-2xl sm:text-3xl font-black tracking-tight">
                  {subscription?.planName || 'Professional Counter'}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-zinc-800">
                  <div>
                    <span className="text-zinc-400 block">Billing Cycle:</span>
                    <span className="font-bold text-zinc-200">{subscription?.billingCycle || 'MONTHLY'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Expires On:</span>
                    <span className="font-bold text-zinc-200 font-mono">
                      {subscription?.expiresAt ? formatDateTime(subscription.expiresAt) : '30 Days'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Auto-Renew Mandate:</span>
                    <span className="font-bold text-zinc-200">
                      {subscription?.mandateStatus === 'ACTIVE' ? 'Active' : 'Manual Renewal'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grace period & renewal note */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs sm:text-sm text-amber-900 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">3-Day Grace Period Protection</span>
                  <p className="mt-0.5 text-amber-800">
                    If your subscription reaches its expiration date, your counter billing will continue operating uninterrupted for an additional 3 days grace period.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION: APPLICATION & OFFLINE STORAGE */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
          <Smartphone className="w-5 h-5 text-zinc-800" />
          <h2 className="text-base font-bold text-zinc-900">Application & Offline Storage</h2>
        </div>

        <div className="flex items-center justify-between text-xs sm:text-sm py-1.5">
          <span className="text-zinc-600 font-medium">Network Status:</span>
          <span className={`font-bold flex items-center gap-2 ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            {isOnline ? 'Online (Connected)' : 'Offline (Local Cache Active)'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs sm:text-sm py-1.5">
          <span className="text-zinc-600 font-medium">Pending Offline Queue:</span>
          <div className="flex items-center gap-2.5">
            <span className="font-bold font-mono text-zinc-900">{pendingCount} orders</span>
            {pendingCount > 0 && (
              <button
                onClick={() => triggerSync()}
                disabled={isSyncing || !isOnline}
                className="min-h-[44px] px-3.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs sm:text-sm py-1.5">
          <span className="text-zinc-600 font-medium">PWA Status:</span>
          <span className="font-bold text-emerald-600">Installable PWA Active</span>
        </div>
      </div>

      {/* SECTION: SIGN OUT */}
      <div className="pt-2">
        <button
          onClick={() => logout()}
          className="w-full min-h-[52px] border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-bold rounded-2xl transition-all active:scale-98 flex items-center justify-center gap-2 shadow-2xs"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out of Counter</span>
        </button>
      </div>
    </div>
  );
};
