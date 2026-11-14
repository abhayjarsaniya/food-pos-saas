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

// Super Admin Components
import { AdminLayout } from './pages/Admin/AdminLayout';
import { AdminLoginPage } from './pages/Admin/AdminLoginPage';
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
  const { user, profile, loading, isOnboarded, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
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

  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

// Protected Route Guard for Super Admin
const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

export const AppContent: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

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
