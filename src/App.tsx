import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import { BillingProvider } from './contexts/BillingContext';
import { OrdersProvider } from './contexts/OrdersContext';
import { AppLayout } from './components/navigation/AppLayout';
import { FeatureGuard } from './components/common/FeatureGuard';
import { HomePage } from './pages/Home/HomePage';
import { BillingPage } from './pages/Billing/BillingPage';
import { LoginPage } from './pages/Login/LoginPage';

// Code-split modules for optimal initial load time and mobile bundle performance
const KitchenOrdersPage = React.lazy(() => import('./pages/Kitchen/KitchenOrdersPage').then(m => ({ default: m.KitchenOrdersPage })));
const OrdersPage = React.lazy(() => import('./pages/Orders/OrdersPage').then(m => ({ default: m.OrdersPage })));
const PendingPaymentsPage = React.lazy(() => import('./pages/Payments/PendingPaymentsPage').then(m => ({ default: m.PendingPaymentsPage })));
const MorePage = React.lazy(() => import('./pages/More/MorePage').then(m => ({ default: m.MorePage })));
const MenuPage = React.lazy(() => import('./pages/Menu/MenuPage').then(m => ({ default: m.MenuPage })));
const InventoryPage = React.lazy(() => import('./pages/Inventory/InventoryPage').then(m => ({ default: m.InventoryPage })));
const SuppliersPage = React.lazy(() => import('./pages/Suppliers/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const PurchaseOrdersPage = React.lazy(() => import('./pages/Purchases/PurchaseOrdersPage').then(m => ({ default: m.PurchaseOrdersPage })));
const TableManagementPage = React.lazy(() => import('./pages/Tables/TableManagementPage').then(m => ({ default: m.TableManagementPage })));
const ReportsPage = React.lazy(() => import('./pages/Reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const MembersPage = React.lazy(() => import('./pages/Members/MembersPage').then(m => ({ default: m.MembersPage })));
const CustomersPage = React.lazy(() => import('./pages/Customers/CustomersPage').then(m => ({ default: m.CustomersPage })));
const ExpensesPage = React.lazy(() => import('./pages/Expenses/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const SettingsPage = React.lazy(() => import('./pages/Settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Super Admin Components (Lazy loaded)
const AdminLayout = React.lazy(() => import('./pages/Admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminOverviewPage = React.lazy(() => import('./pages/Admin/AdminOverviewPage').then(m => ({ default: m.AdminOverviewPage })));
const AdminShopsPage = React.lazy(() => import('./pages/Admin/AdminShopsPage').then(m => ({ default: m.AdminShopsPage })));
const AdminCreateShopPage = React.lazy(() => import('./pages/Admin/AdminCreateShopPage').then(m => ({ default: m.AdminCreateShopPage })));
const AdminOrdersPage = React.lazy(() => import('./pages/Admin/AdminOrdersPage').then(m => ({ default: m.AdminOrdersPage })));
const AdminAnalyticsPage = React.lazy(() => import('./pages/Admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const AdminSubscriptionsPage = React.lazy(() => import('./pages/Admin/AdminSubscriptionsPage').then(m => ({ default: m.AdminSubscriptionsPage })));
const AdminDemoDataPage = React.lazy(() => import('./pages/Admin/AdminDemoDataPage').then(m => ({ default: m.AdminDemoDataPage })));
const AdminSettingsPage = React.lazy(() => import('./pages/Admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));

const PageLoader: React.FC = () => (
  <div className="flex-1 w-full min-h-[50vh] flex flex-col items-center justify-center p-8">
    <div className="w-8 h-8 border-3 border-[#145C43] border-t-transparent rounded-full animate-spin"></div>
    <span className="mt-3 text-xs font-semibold text-[#68736D]">Loading...</span>
  </div>
);

// Protected Route Guard for Shop Owners & Staff
const ProtectedShopRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, isSuperAdmin, isShopSuspended, isMemberDeactivated, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#145C43] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is super admin only without shop profile, route to admin
  if (isSuperAdmin && !profile) {
    return <Navigate to="/admin" replace />;
  }

  // If staff member account has been deactivated by owner
  if (isMemberDeactivated) {
    return (
      <div className="min-h-screen bg-[#F7F9F7] flex flex-col justify-center items-center px-4">
        <div className="bg-white border border-rose-200 p-8 rounded-2xl max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
            !
          </div>
          <h2 className="text-xl font-bold text-[#202923] mb-2">Account Deactivated</h2>
          <p className="text-sm text-[#68736D] mb-6 leading-relaxed">
            Your staff account has been deactivated by the shop owner. Please contact your restaurant manager or administrator.
          </p>
          <button
            onClick={() => logout()}
            className="w-full py-3 bg-[#145C43] text-white font-semibold rounded-xl hover:bg-[#0F4935] transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (isShopSuspended) {
    return (
      <div className="min-h-screen bg-[#F7F9F7] flex flex-col justify-center items-center px-4">
        <div className="bg-white border border-rose-200 p-8 rounded-2xl max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
            !
          </div>
          <h2 className="text-xl font-bold text-[#202923] mb-2">Shop Suspended</h2>
          <p className="text-sm text-[#68736D] mb-6">
            Your shop account has been suspended or archived. Please contact platform support or your Super Admin.
          </p>
          <button
            onClick={() => logout()}
            className="w-full py-3 bg-[#145C43] text-white font-semibold rounded-xl hover:bg-[#0F4935] transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#145C43] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <>{children}</>;
};

// Protected Route Guard for Super Admin
const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9F7]">
        <div className="w-8 h-8 border-2 border-[#145C43] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const AppContent: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes: ONE unified login portal */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/super-admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/shop/login" element={<Navigate to="/login" replace />} />
        <Route path="/member/login" element={<Navigate to="/login" replace />} />
        <Route path="/onboarding" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />

        {/* Super Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminLayout />
            </ProtectedAdminRoute>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="shops" element={<AdminShopsPage />} />
          <Route path="create-shop" element={<AdminCreateShopPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
          <Route path="demo-data" element={<AdminDemoDataPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        {/* Business Tenant POS Routes */}
        <Route
          element={
            <ProtectedShopRoute>
              <AppLayout />
            </ProtectedShopRoute>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route 
            path="/kitchen" 
            element={
              <FeatureGuard navKey="kitchen">
                <KitchenOrdersPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/billing" 
            element={
              <FeatureGuard feature="billing" navKey="billing">
                <BillingPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/pending-payments" 
            element={
              <FeatureGuard feature="pendingPayments" navKey="pendingPayments">
                <PendingPaymentsPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/orders" 
            element={
              <FeatureGuard feature="orders" navKey="orders">
                <OrdersPage />
              </FeatureGuard>
            } 
          />
          <Route path="/more" element={<MorePage />} />
          <Route 
            path="/menu" 
            element={
              <FeatureGuard feature="menuManagement" navKey="menu">
                <MenuPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/inventory" 
            element={
              <FeatureGuard feature="inventory" navKey="inventory">
                <InventoryPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/suppliers" 
            element={
              <FeatureGuard feature="suppliers" navKey="suppliers">
                <SuppliersPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/purchases" 
            element={
              <FeatureGuard feature="purchaseOrders" navKey="purchases">
                <PurchaseOrdersPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/tables" 
            element={
              <FeatureGuard feature="tableManagement" navKey="tables">
                <TableManagementPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/reports" 
            element={
              <FeatureGuard feature="reports" navKey="reports">
                <ReportsPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/members" 
            element={
              <FeatureGuard feature="memberManagement" navKey="members">
                <MembersPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/customers" 
            element={
              <FeatureGuard feature="customerManagement" navKey="customers">
                <CustomersPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/expenses" 
            element={
              <FeatureGuard feature="expenses" navKey="expenses">
                <ExpensesPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <FeatureGuard navKey="settings">
                <SettingsPage />
              </FeatureGuard>
            } 
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SyncProvider>
        <BillingProvider>
          <OrdersProvider>
            <AppContent />
          </OrdersProvider>
        </BillingProvider>
      </SyncProvider>
    </AuthProvider>
  );
};

export default App;
