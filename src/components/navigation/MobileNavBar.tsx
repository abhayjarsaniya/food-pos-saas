import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Receipt, ShoppingBag, Wallet, Menu as MenuIcon } from 'lucide-react';
import { useBilling } from '../../contexts/BillingContext';
import { useAuth } from '../../contexts/AuthContext';

export const MobileNavBar: React.FC = () => {
  const { items, extras } = useBilling();
  const { features } = useAuth();
  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0) + extras.reduce((sum, e) => sum + e.quantity, 0);

  const allNavItems = [
    { to: '/', label: 'Home', icon: Home, feature: null },
    { to: '/billing', label: 'Billing', icon: Receipt, badge: totalItemCount > 0 ? totalItemCount : null, highlight: true, feature: 'billing' as const },
    { to: '/orders', label: 'Orders', icon: ShoppingBag, feature: 'orders' as const },
    { to: '/pending-payments', label: 'Pending', icon: Wallet, feature: 'pendingPayments' as const },
    { to: '/more', label: 'More', icon: MenuIcon, feature: null },
  ];

  const navItems = allNavItems.filter(
    (item) => !item.feature || (features && features[item.feature] !== false)
  );

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E5EAE6] z-40 safe-bottom shadow-lg">
      <div className="flex items-center justify-around h-16 sm:h-18 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center flex-1 h-full min-h-[52px] min-w-[48px] py-1 text-xs font-semibold transition-all select-none active:scale-95 ${
                  isActive
                    ? 'text-[#145C43] font-bold'
                    : 'text-[#929B95] hover:text-[#202923]'
                }`
              }
            >
              <div className="relative">
                <Icon className={`w-6 h-6 transition-transform duration-200 ${item.highlight && totalItemCount > 0 ? 'text-[#145C43] scale-110' : ''}`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-3 bg-[#145C43] text-white text-[11px] font-bold rounded-full h-4.5 min-w-[18px] px-1 flex items-center justify-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] sm:text-xs mt-1 truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
