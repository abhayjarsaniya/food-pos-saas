import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Receipt, 
  ShoppingBag, 
  UtensilsCrossed, 
  Boxes, 
  Truck, 
  ClipboardList, 
  BarChart3, 
  Settings, 
  WifiOff, 
  RefreshCw, 
  LogOut, 
  ShieldCheck,
  Wallet,
  Users,
  LayoutGrid
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBilling } from '../../contexts/BillingContext';
import { useSync } from '../../contexts/SyncContext';

export const DesktopSidebar: React.FC = () => {
  const { profile, logout, features } = useAuth();
  const { items } = useBilling();
  const { isOnline, pendingCount, isSyncing, triggerSync } = useSync();
  const navigate = useNavigate();

  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const allNavLinks = [
    { to: '/', label: 'Dashboard', icon: Home, feature: null },
    { to: '/billing', label: 'POS & Billing', icon: Receipt, badge: totalItemCount > 0 ? totalItemCount : null, feature: 'billing' as const },
    { to: '/tables', label: 'Table Management', icon: LayoutGrid, feature: 'tableManagement' as const },
    { to: '/pending-payments', label: 'Pending Payments', icon: Wallet, feature: 'pendingPayments' as const },
    { to: '/orders', label: 'Orders History', icon: ShoppingBag, feature: 'orders' as const },
    { to: '/menu', label: 'Menu Management', icon: UtensilsCrossed, feature: 'menuManagement' as const },
    { to: '/inventory', label: 'Inventory & Materials', icon: Boxes, feature: 'inventory' as const },
    { to: '/suppliers', label: 'Suppliers & Vendors', icon: Truck, feature: 'suppliers' as const },
    { to: '/purchases', label: 'Purchase Orders', icon: ClipboardList, feature: 'purchaseOrders' as const },
    { to: '/reports', label: 'Reports & Analytics', icon: BarChart3, feature: 'reports' as const },
    { to: '/members', label: 'Staff & Members', icon: Users, feature: 'memberManagement' as const },
    { to: '/settings', label: 'Settings', icon: Settings, feature: null },
  ];

  const navLinks = allNavLinks.filter(
    (link) => !link.feature || (features && features[link.feature] !== false)
  );

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-[#E5EAE6] bg-white min-h-screen p-4 justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#145C43] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'F'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-[#202923] truncate">
              {profile?.name || 'Food POS'}
            </h1>
            <p className="text-xs text-[#68736D] capitalize truncate">
              {profile?.category?.replace('_', ' ') || 'Billing Counter'}
            </p>
          </div>
        </div>

        {/* Sync Indicator */}
        <div className="mb-4 px-3 py-2 bg-white border border-[#E5EAE6] rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-xs text-[#19865D] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#20A879] animate-pulse"></span>
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </div>
          {pendingCount > 0 && (
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing || !isOnline}
              title="Sync pending orders now"
              className="p-1 text-[#68736D] hover:text-[#202923] disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Navigation links */}
        <nav className="space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                    isActive
                      ? 'bg-[#EAF5EF] text-[#145C43] border border-[#CFE5D8]/80 font-bold shadow-2xs'
                      : 'text-[#68736D] hover:bg-[#F7F9F7] hover:text-[#202923] font-medium'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </div>
                {link.badge !== null && link.badge !== undefined && (
                  <span className="bg-[#145C43] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {link.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="pt-4 border-t border-[#E5EAE6]">
        <div className="flex items-center justify-between px-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#202923] truncate">
              {profile?.ownerName || 'Cashier'}
            </p>
            <p className="text-[11px] text-[#929B95] truncate">
              {profile?.status || 'ACTIVE'}
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="p-2 text-[#929B95] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
