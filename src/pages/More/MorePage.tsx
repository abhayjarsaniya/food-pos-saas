import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  UtensilsCrossed, 
  Truck, 
  Boxes, 
  ClipboardList, 
  BarChart3, 
  Settings, 
  ShieldCheck, 
  LogOut, 
  ChevronRight,
  Wallet,
  Users
} from 'lucide-react';

export const MorePage: React.FC = () => {
  const { profile, features, logout } = useAuth();
  const navigate = useNavigate();

  const menuSections = [
    {
      title: 'Counter & Billing Operations',
      items: [
        { label: 'Table Management', icon: UtensilsCrossed, path: '/tables', desc: 'Custom tables, live status & seating', feature: 'tableManagement' as const },
        { label: 'Pending Payments', icon: Wallet, path: '/pending-payments', desc: 'Collect table dues & partial balances', feature: 'pendingPayments' as const },
        { label: 'Menu Management', icon: UtensilsCrossed, path: '/menu', desc: 'Categories, items & pricing', feature: 'menuManagement' as const },
        { label: 'Inventory & Materials', icon: Boxes, path: '/inventory', desc: 'Raw stock, alerts & adjustments', feature: 'inventory' as const },
        { label: 'Suppliers & Vendors', icon: Truck, path: '/suppliers', desc: 'Vendor directory & WhatsApp', feature: 'suppliers' as const },
        { label: 'Purchase Orders', icon: ClipboardList, path: '/purchases', desc: 'Procurement & payments', feature: 'purchaseOrders' as const },
      ],
    },
    {
      title: 'Business & Management',
      items: [
        { label: 'Revenue Reports', icon: BarChart3, path: '/reports', desc: 'Sales, GST, collections & dues', feature: 'reports' as const },
        { label: 'Staff & Members', icon: Users, path: '/members', desc: 'Staff roles & cashier permissions', feature: 'memberManagement' as const },
        { label: 'Shop Settings', icon: Settings, path: '/settings', desc: 'Tables, tax, receipt format & profile', feature: null },
      ],
    },
  ];

  const visibleSections = menuSections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => !it.feature || (features && features[it.feature] !== false)),
    }))
    .filter((sec) => sec.items.length > 0);

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-6">
      {/* Shop Profile Banner */}
      <div className="p-4 bg-white border border-[#E5EAE6] rounded-2xl shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#EAF5EF] border border-[#CFE5D8] text-[#145C43] flex items-center justify-center font-bold text-lg">
            {profile?.name?.charAt(0) || 'S'}
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#202923] truncate">{profile?.name}</h2>
            <p className="text-xs text-[#68736D] capitalize">{profile?.category?.replace('_', ' ')} Counter</p>
            <span className="inline-block mt-1 text-[10px] bg-[#EAF5EF] text-[#145C43] border border-[#CFE5D8] font-semibold px-2 py-0.5 rounded-full">
              {profile?.status || 'ACTIVE'}
            </span>
          </div>
        </div>
      </div>

      {/* Sections */}
      {visibleSections.map((sec) => (
        <div key={sec.title} className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
            {sec.title}
          </h3>
          <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100 overflow-hidden shadow-2xs">
            {sec.items.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.path}
                  onClick={() => navigate(it.path)}
                  className="w-full p-3.5 hover:bg-zinc-50 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900">{it.label}</h4>
                      <p className="text-[11px] text-zinc-400">{it.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Sign Out */}
      <button
        onClick={() => logout()}
        className="w-full py-3.5 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out of Counter</span>
      </button>
    </div>
  );
};
