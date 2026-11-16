import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import { BillingProvider } from './contexts/BillingContext';
import { OrdersProvider } from './contexts/OrdersContext';
import { AppLayout } from './components/navigation/AppLayout';
import { FeatureGuard } from './components/common/FeatureGuard';
import { HomePage } from './pages/Home/HomePage';
import { BillingPage } from './pages/Billing/BillingPage';
import { OrdersPage } from './pages/Orders/OrdersPage';
import { MorePage } from './pages/More/MorePage';
import { MenuPage } from './pages/Menu/MenuPage';
import { InventoryPage } from './pages/Inventory/InventoryPage';
import { SuppliersPage } from './pages/Suppliers/SuppliersPage';
import { PurchaseOrdersPage } from './pages/Purchases/PurchaseOrdersPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { PendingPaymentsPage } from './pages/Payments/PendingPaymentsPage';
import { MembersPage } from './pages/Members/MembersPage';
import { TableManagementPage } from './pages/Tables/TableManagementPage';
import { CustomersPage } from './pages/Customers/CustomersPage';
import { ExpensesPage } from './pages/Expenses/ExpensesPage';
import { LoginPage } from './pages/Login/LoginPage';
import { OnboardingPage } from './pages/Onboarding/OnboardingPage';
import { KitchenOrdersPage } from './pages/Kitchen/KitchenOrdersPage';

// Multi-Portal Login Components
import { SuperAdminLoginPage } from './pages/Auth/SuperAdminLoginPage';
import { ShopOwnerLoginPage } from './pages/Auth/ShopOwnerLoginPage';
import { MemberLoginPage } from './pages/Auth/MemberLoginPage';

// Super Admin Components
import { AdminLayout } from './pages/Admin/AdminLayout';
import { AdminOverviewPage } from './pages/Admin/AdminOverviewPage';
import { AdminShopsPage } from './pages/Admin/AdminShopsPage';
import { AdminCreateShopPage } from './pages/Admin/AdminCreateShopPage';
import { AdminOrdersPage } from './pages/Admin/AdminOrdersPage';
import { AdminAnalyticsPage } from './pages/Admin/AdminAnalyticsPage';
import { AdminSubscriptionsPage } from './pages/Admin/AdminSubscriptionsPage';
import { AdminDemoDataPage } from './pages/Admin/AdminDemoDataPage';
import { AdminSettingsPage } from './pages/Admin/AdminSettingsPage';

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
