import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ShieldCheck, 
  Store, 
  PlusCircle, 
  ShoppingBag, 
  BarChart3, 
  CreditCard, 
  Database, 
  Settings, 
  ArrowLeft, 
  LogOut 
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const adminNav = [
    { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
    { to: '/admin/shops', label: 'All Shops', icon: Store },
    { to: '/admin/create-shop', label: 'Create Shop', icon: PlusCircle },
    { to: '/admin/orders', label: 'All Orders', icon: ShoppingBag },
    { to: '/admin/analytics', label: 'Platform Analytics', icon: BarChart3 },
    { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { to: '/admin/demo-data', label: 'Demo Data Manager', icon: Database },
    { to: '/admin/settings', label: 'Platform Settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-50 w-full overflow-x-hidden">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed top-0 left-0 h-[100dvh] z-30 border-r border-[#E5EAE6] bg-white p-4 justify-between select-none">
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center gap-2.5 px-2 py-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 leading-tight">Super Admin</h1>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                Platform Owner
              </span>
            </div>
          </div>

          {/* Navigation - Scrollable internally if height is exceeded */}
          <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 no-scrollbar pr-0.5">
            {adminNav.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#145C43] text-white font-semibold shadow-2xs'
                        : 'text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 pt-4 border-t border-zinc-100">
          <button
            onClick={async () => {
              await logout();
              navigate('/admin/login');
            }}
            className="w-full p-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full md:ml-64 pb-16 md:pb-6 overflow-y-auto overflow-x-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-zinc-200 p-4 sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-zinc-900">Super Admin</span>
          </div>

          <button
            onClick={async () => {
              await logout();
              navigate('/admin/login');
            }}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-2.5 py-1.5 rounded-lg"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </header>

        {/* Mobile Sub-Navigation Bar */}
        <div className="md:hidden bg-white border-b border-zinc-200 px-3 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5">
          {adminNav.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive ? 'bg-[#145C43] text-white shadow-2xs' : 'text-[#68736D] bg-zinc-100 hover:bg-[#EAF5EF] hover:text-[#145C43]'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <main className="flex-1 w-full min-w-0 max-w-none p-3.5 sm:p-5 md:p-6 lg:p-7 xl:p-8 box-border overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
