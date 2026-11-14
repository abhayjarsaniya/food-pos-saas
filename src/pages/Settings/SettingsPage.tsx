import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../contexts/SyncContext';
import { BusinessCategory, PricingMode, ReceiptFormat, PaymentMethod } from '../../types';
import { 
  Building, 
  Receipt, 
  FileText, 
  Percent, 
  Smartphone, 
  RefreshCw, 
  LogOut, 
  Check, 
  Store,
  Wifi,
  WifiOff,
  LayoutGrid,
  ChevronRight
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, settings, updateProfile, updateSettings, logout } = useAuth();
  const { isOnline, pendingCount, isSyncing, triggerSync } = useSync();

  // Profile Form
  const [name, setName] = useState(profile?.name || '');
  const [ownerName, setOwnerName] = useState(profile?.ownerName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [category, setCategory] = useState<BusinessCategory>(profile?.category || 'cafe');
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

  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        name: name.trim(),
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
      setSavingStatus('Settings updated successfully!');
      setTimeout(() => setSavingStatus(null), 3000);
    } catch {
      alert('Failed to update settings');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Settings & Configuration</h1>
        <p className="text-xs text-zinc-500">
          Manage your business profile, GST tax rates, receipt layouts and sync settings
        </p>
      </div>

      {savingStatus && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{savingStatus}</span>
        </div>
      )}

      {/* TABLE MANAGEMENT SHORTCUT BANNER */}
      <div 
        onClick={() => navigate('/tables')}
        className="bg-gradient-to-r from-zinc-900 to-zinc-800 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between cursor-pointer hover:from-zinc-800 hover:to-zinc-700 transition-all border border-zinc-700/50 group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
            <LayoutGrid className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold">Table Management</h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full">
                Unlimited Tables
              </span>
            </div>
            <p className="text-xs text-zinc-300 mt-0.5">
              Create custom dining tables, family booths, VIP lounges & monitor live occupancy
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold text-zinc-300 group-hover:text-white group-hover:translate-x-1 transition-all">
          <span>Manage Tables</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* SECTION 1: BUSINESS PROFILE */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
          <Store className="w-4 h-4 text-zinc-700" />
          <h2 className="text-sm font-bold text-zinc-900">Business Profile</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Business / Restaurant Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Owner / Manager Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Counter Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BusinessCategory)}
                className="w-full px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
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

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Shop / Outlet Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
            />
          </div>

          <button
            type="submit"
            className="py-2.5 px-5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors"
          >
            Update Business Profile
          </button>
        </form>
      </div>

      {/* SECTION 2: TAX & GST CONFIGURATION */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-zinc-700" />
            <h2 className="text-sm font-bold text-zinc-900">GST & Tax Configuration</h2>
          </div>
          <button
            type="button"
            onClick={() => setGstEnabled(!gstEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              gstEnabled ? 'bg-zinc-950' : 'bg-zinc-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                gstEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-zinc-500">
            {gstEnabled
              ? 'GST is enabled. Tax breakdowns (CGST/SGST/IGST) will be computed and saved on every order.'
              : 'GST is disabled. Simple receipts without tax fields will be generated.'}
          </p>

          {gstEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="24ABCDE1234F1Z5"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Default GST Rate
                </label>
                <select
                  value={defaultGstRate}
                  onChange={(e) => setDefaultGstRate(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl"
                >
                  <option value={5}>5% (Standard Food / Cafe)</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={0}>0%</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Pricing Mode
                </label>
                <select
                  value={pricingMode}
                  onChange={(e) => setPricingMode(e.target.value as PricingMode)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl"
                >
                  <option value="exclusive">Exclusive (Add GST on subtotal)</option>
                  <option value="inclusive">Inclusive (GST included in price)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: RECEIPT & BILLING PREFERENCES */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
          <Receipt className="w-4 h-4 text-zinc-700" />
          <h2 className="text-sm font-bold text-zinc-900">Receipt & Billing Preferences</h2>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Default PDF Format
              </label>
              <select
                value={defaultFormat}
                onChange={(e) => setDefaultFormat(e.target.value as ReceiptFormat)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl"
              >
                <option value="compact80">Compact 80mm Thermal</option>
                <option value="a4">Standard A4 Tax Invoice</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Default Payment Method
              </label>
              <select
                value={defaultPaymentMethod}
                onChange={(e) => setDefaultPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Bill Prefix
              </label>
              <input
                type="text"
                value={billNumberPrefix}
                onChange={(e) => setBillNumberPrefix(e.target.value.toUpperCase())}
                placeholder="BILL-"
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl uppercase font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Receipt Footer Note
            </label>
            <input
              type="text"
              value={footerMessage}
              onChange={(e) => setFooterMessage(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1 text-xs text-zinc-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAddress}
                onChange={(e) => setShowAddress(e.target.checked)}
                className="rounded"
              />
              <span>Show Address on Receipt</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPhone}
                onChange={(e) => setShowPhone(e.target.checked)}
                className="rounded"
              />
              <span>Show Phone on Receipt</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showGstin}
                onChange={(e) => setShowGstin(e.target.checked)}
                className="rounded"
              />
              <span>Show GSTIN on Receipt</span>
            </label>
          </div>

          <button
            type="submit"
            className="py-2.5 px-5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors"
          >
            Save All Preferences
          </button>
        </form>
      </div>

      {/* SECTION 4: OFFLINE QUEUE & PWA STATUS */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
          <Smartphone className="w-4 h-4 text-zinc-700" />
          <h2 className="text-sm font-bold text-zinc-900">Application & Offline Storage</h2>
        </div>

        <div className="flex items-center justify-between text-xs py-1">
          <span className="text-zinc-600">Network Connectivity:</span>
          <span className={`font-semibold flex items-center gap-1.5 ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isOnline ? 'Online (Connected)' : 'Offline (Local Cache Active)'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1">
          <span className="text-zinc-600">Pending Offline Orders Queue:</span>
          <div className="flex items-center gap-2">
            <span className="font-bold font-mono text-zinc-900">{pendingCount} orders</span>
            {pendingCount > 0 && (
              <button
                onClick={() => triggerSync()}
                disabled={isSyncing || !isOnline}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs py-1">
          <span className="text-zinc-600">PWA Status:</span>
          <span className="font-semibold text-emerald-600">Ready to Install / Standalone PWA</span>
        </div>
      </div>

      {/* SECTION 5: ACCOUNT & LOGOUT */}
      <div className="pt-2">
        <button
          onClick={() => logout()}
          className="w-full py-3 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Counter</span>
        </button>
      </div>
    </div>
  );
};
