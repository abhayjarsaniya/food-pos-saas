import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import { BillingProvider } from './contexts/BillingContext';
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
import { LoginPage } from './pages/Login/LoginPage';
import { OnboardingPage } from './pages/Onboarding/OnboardingPage';

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
  const { user, profile, loading, isSuperAdmin, isShopSuspended, logout } = useAuth();

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

  if (isShopSuspended) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center px-4">
        <div className="bg-white border border-rose-200 p-8 rounded-2xl max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
            !
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Shop Suspended</h2>
          <p className="text-sm text-zinc-600 mb-6">
            Your shop account has been suspended or archived. Please contact platform support or your Super Admin.
          </p>
          <button
            onClick={() => logout()}
            className="w-full py-3 bg-[#145C43] text-white font-semibold rounded-xl hover:bg-[#0F4935] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
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
            path="/billing" 
            element={
              <FeatureGuard feature="billing">
                <BillingPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/pending-payments" 
            element={
              <FeatureGuard feature="pendingPayments">
                <PendingPaymentsPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/orders" 
            element={
              <FeatureGuard feature="orders">
                <OrdersPage />
              </FeatureGuard>
            } 
          />
          <Route path="/more" element={<MorePage />} />
          <Route 
            path="/menu" 
            element={
              <FeatureGuard feature="menuManagement">
                <MenuPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/inventory" 
            element={
              <FeatureGuard feature="inventory">
                <InventoryPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/suppliers" 
            element={
              <FeatureGuard feature="suppliers">
                <SuppliersPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/purchases" 
            element={
              <FeatureGuard feature="purchaseOrders">
                <PurchaseOrdersPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/tables" 
            element={
              <FeatureGuard feature="tableManagement">
                <TableManagementPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/reports" 
            element={
              <FeatureGuard feature="reports">
                <ReportsPage />
              </FeatureGuard>
            } 
          />
          <Route 
            path="/members" 
            element={
              <FeatureGuard feature="memberManagement">
                <MembersPage />
              </FeatureGuard>
            } 
          />
          <Route path="/settings" element={<SettingsPage />} />
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
          <AppContent />
        </BillingProvider>
      </SyncProvider>
    </AuthProvider>
  );
};

export default App;
