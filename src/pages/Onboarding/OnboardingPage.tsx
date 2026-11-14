import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { BusinessCategory, PricingMode } from '../../types';
import { Store, Check, ArrowRight } from 'lucide-react';
import { addCategory, addMenuItem } from '../../services/business/businessService';

export const OnboardingPage: React.FC = () => {
  const { user, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('cafe');
  const [address, setAddress] = useState('');
  const [currency] = useState('INR');
  const [currencySymbol] = useState('₹');

  // Tax settings
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstin, setGstin] = useState('');
  const [defaultGstRate, setDefaultGstRate] = useState(5);
  const [pricingMode, setPricingMode] = useState<PricingMode>('exclusive');
  const [footerMessage, setFooterMessage] = useState('Thank you for visiting! Please visit again.');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriesList: { id: BusinessCategory; label: string }[] = [
    { id: 'cafe', label: 'Cafe & Beverages' },
    { id: 'restaurant', label: 'Restaurant & Dining' },
    { id: 'food_stall', label: 'Food Stall / Food Truck' },
    { id: 'bakery', label: 'Bakery & Desserts' },
    { id: 'takeaway', label: 'Takeaway Counter' },
    { id: 'sweet_shop', label: 'Sweets & Snacks' },
    { id: 'other', label: 'General Food Counter' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setError('Business name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!user) throw new Error('Authentication required');

      await completeOnboarding(
        {
          name: businessName.trim(),
          ownerName: ownerName.trim() || 'Owner',
          phone: phone.trim(),
          category,
          address: address.trim(),
          currency,
          currencySymbol,
        },
        {
          tax: {
            enabled: gstEnabled,
            gstin: gstEnabled ? gstin.trim() : '',
            defaultGstRate,
            pricingMode,
          },
          receipt: {
            defaultFormat: 'compact80',
            showLogo: true,
            showAddress: true,
            showPhone: true,
            showGstin: gstEnabled,
            footerMessage: footerMessage.trim(),
          },
        }
      );

      // Seed initial sample categories and items for the business so POS is immediately ready
      const cat1 = await addCategory(user.uid, 'Popular Combos', 1);
      const cat2 = await addCategory(user.uid, 'Main Course', 2);
      const cat3 = await addCategory(user.uid, 'Beverages', 3);

      await addMenuItem(user.uid, {
        businessId: user.uid,
        name: 'Special Thali / Combo',
        price: 180,
        categoryId: cat1.id,
        categoryName: cat1.name,
        isVeg: true,
        isActive: true,
        sortOrder: 1,
      });

      await addMenuItem(user.uid, {
        businessId: user.uid,
        name: 'Cheese Paneer Burger',
        price: 120,
        categoryId: cat2.id,
        categoryName: cat2.name,
        isVeg: true,
        isActive: true,
        sortOrder: 2,
      });

      await addMenuItem(user.uid, {
        businessId: user.uid,
        name: 'Masala Chai',
        price: 30,
        categoryId: cat3.id,
        categoryName: cat3.name,
        isVeg: true,
        isActive: true,
        sortOrder: 3,
      });

      await addMenuItem(user.uid, {
        businessId: user.uid,
        name: 'Cold Coffee Frappe',
        price: 90,
        categoryId: cat3.id,
        categoryName: cat3.name,
        isVeg: true,
        isActive: true,
        sortOrder: 4,
      });

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to save business details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-xl bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 sm:p-8 my-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-zinc-950 text-white rounded-xl flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Set Up Your Food Business</h1>
            <p className="text-xs text-zinc-500">
              Configure your counter profile, currency and billing preferences
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Business Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Food Stall / Restaurant Name *
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Chai Shai Cafe, Mumbai Street Food"
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white"
            />
          </div>

          {/* Owner Name & Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Owner / Cashier Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Jenish Patel"
                className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Counter Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Business Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BusinessCategory)}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white"
            >
              {categoriesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Shop / Outlet Address
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Shop No 4, Main Market, MG Road"
              className="w-full px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white"
            />
          </div>

          {/* GST Configuration Box */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900">GST Billing</p>
                <p className="text-xs text-zinc-500">Enable tax invoices with GST calculation</p>
              </div>
              <button
                type="button"
                onClick={() => setGstEnabled(!gstEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  gstEnabled ? 'bg-zinc-900' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    gstEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {gstEnabled && (
              <div className="space-y-3 pt-2 border-t border-zinc-200">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    GSTIN (15-digit Tax Number)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="24ABCDE1234F1Z5"
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Default GST Rate (%)
                    </label>
                    <select
                      value={defaultGstRate}
                      onChange={(e) => setDefaultGstRate(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg"
                    >
                      <option value={5}>5% (Standard Food / Cafe)</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={0}>0% (Exempt)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Menu Price Mode
                    </label>
                    <select
                      value={pricingMode}
                      onChange={(e) => setPricingMode(e.target.value as PricingMode)}
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg"
                    >
                      <option value="exclusive">Exclusive (+ GST added on bill)</option>
                      <option value="inclusive">Inclusive (GST included in menu price)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Receipt Footer */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Receipt Footer Note
            </label>
            <input
              type="text"
              value={footerMessage}
              onChange={(e) => setFooterMessage(e.target.value)}
              placeholder="Thank you for visiting! Please visit again."
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            <span>Complete Setup & Start Billing</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
