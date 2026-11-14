import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Receipt, ShoppingBag, Wallet, Menu as MenuIcon } from 'lucide-react';
import { useBilling } from '../../contexts/BillingContext';
import { useAuth } from '../../contexts/AuthContext';

export const MobileNavBar: React.FC = () => {
  const { items } = useBilling();
  const { features } = useAuth();
  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0);

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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-zinc-200 z-40 safe-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`
              }
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.highlight && totalItemCount > 0 ? 'text-zinc-950 scale-110' : ''}`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 bg-zinc-950 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
