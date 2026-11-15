import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Check, Key, Server, Lock } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [platformName, setPlatformName] = useState('Universal Food POS Multi-Tenant SaaS');
  const [supportEmail, setSupportEmail] = useState('support@foodpos.app');
  const [defaultCurrency, setDefaultCurrency] = useState('INR (₹)');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Platform Configuration</h1>
        <p className="text-xs text-zinc-500">
          Global multi-tenant system parameters, security policies and master admin account
        </p>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Platform configuration saved successfully!</span>
        </div>
      )}

      {/* Admin Profile Details */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-zinc-900">Master Super Admin Session</h2>
        </div>
        <div className="text-xs space-y-1 text-zinc-600">
          <p>
            <span className="font-semibold text-zinc-800">Admin Account:</span> {user?.email || 'superadmin@foodpos.app'}
          </p>
          <p>
            <span className="font-semibold text-zinc-800">Privileges:</span> Global Tenant Provisioning & Platform Administration
          </p>
          <p>
            <span className="font-semibold text-zinc-800">Database Role:</span> SUPER_ADMIN
          </p>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-2xs">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Platform Brand Name
            </label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Platform Support Email
            </label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Default Platform Currency
            </label>
            <input
              type="text"
              disabled
              value={defaultCurrency}
              className="w-full px-3.5 py-2 text-xs bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-500 font-mono"
            />
          </div>

          <button
            type="submit"
            className="py-2.5 px-5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            Save Platform Settings
          </button>
        </form>
      </div>
    </div>
  );
};
