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
  LogOut, 
  ShieldCheck, 
  Wallet, 
  Users, 
  LayoutGrid, 
  UserCheck, 
  Banknote,
  ChefHat
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBilling } from '../../contexts/BillingContext';
import { useOrders } from '../../contexts/OrdersContext';
import { MemberNavigationVisibility } from '../../types';

export const DesktopSidebar: React.FC = () => {
  const { profile, logout, features, userRole, currentMember, hasNavAccess } = useAuth();
  const { items } = useBilling();
  const { pendingPaymentCount } = useOrders();
  const navigate = useNavigate();

  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const allNavLinks = [
    { to: '/', label: 'Dashboard', icon: Home, navKey: 'dashboard' as keyof MemberNavigationVisibility, feature: null },
    { to: '/kitchen', label: 'Kitchen Orders', icon: ChefHat, navKey: 'kitchen' as keyof MemberNavigationVisibility, feature: null },
    { to: '/billing', label: 'POS & Billing', icon: Receipt, badge: totalItemCount > 0 ? totalItemCount : null, navKey: 'billing' as keyof MemberNavigationVisibility, feature: 'billing' as const },
    { to: '/tables', label: 'Table Management', icon: LayoutGrid, navKey: 'tables' as keyof MemberNavigationVisibility, feature: 'tableManagement' as const },
    { to: '/pending-payments', label: 'Pending Payments', icon: Wallet, badge: pendingPaymentCount > 0 ? pendingPaymentCount : null, navKey: 'pendingPayments' as keyof MemberNavigationVisibility, feature: 'pendingPayments' as const },
    { to: '/orders', label: 'All Customer Orders', icon: ShoppingBag, navKey: 'orders' as keyof MemberNavigationVisibility, feature: 'orders' as const },
    { to: '/menu', label: 'Menu Management', icon: UtensilsCrossed, navKey: 'menu' as keyof MemberNavigationVisibility, feature: 'menuManagement' as const },
    { to: '/inventory', label: 'Inventory & Materials', icon: Boxes, navKey: 'inventory' as keyof MemberNavigationVisibility, feature: 'inventory' as const },
    { to: '/suppliers', label: 'Suppliers & Vendors', icon: Truck, navKey: 'suppliers' as keyof MemberNavigationVisibility, feature: 'suppliers' as const },
    { to: '/purchases', label: 'Purchase Orders', icon: ClipboardList, navKey: 'purchases' as keyof MemberNavigationVisibility, feature: 'purchaseOrders' as const },
    { to: '/reports', label: 'Reports & Analytics', icon: BarChart3, navKey: 'reports' as keyof MemberNavigationVisibility, feature: 'reports' as const },
    { to: '/expenses', label: 'Expenses & Petty Cash', icon: Banknote, navKey: 'expenses' as keyof MemberNavigationVisibility, feature: 'expenses' as const },
    { to: '/customers', label: 'Customer Directory', icon: UserCheck, navKey: 'customers' as keyof MemberNavigationVisibility, feature: 'customerManagement' as const },
    { to: '/members', label: 'Staff & Members', icon: Users, navKey: 'members' as keyof MemberNavigationVisibility, feature: 'memberManagement' as const },
    { to: '/settings', label: 'Settings', icon: Settings, navKey: 'settings' as keyof MemberNavigationVisibility, feature: null },
  ];

  const navLinks = allNavLinks.filter((link) => {
    if (link.feature && features && features[link.feature] === false) return false;
    if (userRole === 'OWNER' || userRole === 'SUPER_ADMIN') return true;
    if (link.navKey) return hasNavAccess(link.navKey);
    return true;
  });

  const displayName = currentMember?.name || profile?.ownerName || 'Prince Owner';
  const displayRoleOrPosition = currentMember?.position || (userRole === 'OWNER' ? 'Shop Owner' : userRole === 'KITCHEN' ? 'Cook' : userRole === 'CASHIER' ? 'Cashier' : 'Staff');

  return (
    <aside className="hidden md:flex flex-col w-64 fixed top-0 left-0 h-[100dvh] z-30 border-r border-[#E5EAE6] bg-white p-3.5 justify-between select-none">
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Brand Header */}
        <div className="shrink-0 flex items-center gap-3 px-2 py-2.5 mb-2.5 border-b border-[#E5EAE6]/60 pb-3">
          <div className="w-10 h-10 rounded-xl bg-[#145C43] flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'F'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-[#202923] truncate">
              {profile?.name || 'Food POS'}
            </h1>
            <p className="text-[11px] text-[#68736D] capitalize truncate">
              {profile?.category?.replace('_', ' ') || 'Restaurant / Fast Food'}
            </p>
          </div>
        </div>

        {/* 1-Tap All Customer Orders Shortcut */}
        {(userRole === 'OWNER' || userRole === 'SUPER_ADMIN' || hasNavAccess('orders')) && (
          <div className="shrink-0 px-1 mb-2">
            <button
              onClick={() => navigate('/orders')}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#145C43] hover:bg-[#0F4935] text-white rounded-xl text-xs font-bold transition-all shadow-2xs group cursor-pointer"
              title="One-tap shortcut to view all customer orders"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span>All Orders</span>
              </div>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono">
                View
              </span>
            </button>
          </div>
        )}

        {/* Navigation links - Scrollable independently if height is exceeded */}
        <nav className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5 no-scrollbar">
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
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </div>
                {link.badge !== null && link.badge !== undefined && (
                  <span className="bg-[#145C43] text-white text-[11px] px-2 py-0.5 rounded-full font-bold shadow-xs shrink-0">
                    {link.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Footer - Pinned at the bottom */}
      <div className="shrink-0 pt-3 mt-2 border-t border-[#E5EAE6]">
        <div className="flex items-center justify-between px-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#202923] truncate">
              {displayName}
            </p>
            <p className="text-[10px] font-bold text-[#145C43] uppercase tracking-wider truncate">
              {displayRoleOrPosition}
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
