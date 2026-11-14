export type BusinessCategory = 
  | 'restaurant' 
  | 'cafe' 
  | 'food_stall' 
  | 'bakery' 
  | 'takeaway' 
  | 'sweet_shop' 
  | 'cloud_kitchen' 
  | 'other';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type AccessPlan = 'trial' | 'starter' | 'pro' | 'enterprise';

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER';

export interface BusinessMember {
  id: string; // memberId or uid
  businessId: string;
  email: string;
  loginId?: string; // custom staff login ID, e.g. "cashier01", "counter02", "manager01"
  name: string;
  role: UserRole;
  canCollectPayment: boolean; // Cashiers can only record payment if permitted
  status: 'INVITED' | 'ACTIVE' | 'DEACTIVATED';
  invitedAt: string;
  joinedAt?: string;
  temporaryPassword?: string;
}

// ========================
// CENTRALIZED FEATURE FLAGS
// ========================

export interface BusinessFeatures {
  billing: boolean;
  orders: boolean;
  pendingPayments: boolean;
  menuManagement: boolean;
  tableManagement: boolean;
  suppliers: boolean;
  inventory: boolean;
  purchaseOrders: boolean;
  reports: boolean;
  gst: boolean;
  whatsapp: boolean;
  printing: boolean;
  customerManagement: boolean;
  memberManagement: boolean;
  expenses: boolean;
  offlineBilling: boolean;
}

export type FeatureFlagKey = keyof BusinessFeatures;

export const DEFAULT_BUSINESS_FEATURES: BusinessFeatures = {
  billing: true,
  orders: true,
  pendingPayments: true,
  menuManagement: true,
  tableManagement: true,
  suppliers: true,
  inventory: true,
  purchaseOrders: true,
  reports: true,
  gst: true,
  whatsapp: true,
  printing: true,
  customerManagement: true,
  memberManagement: true,
  expenses: false,
  offlineBilling: true,
};

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'OTHER';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PARTIALLY_PAID' | 'PAID';
export type OrderStatus = 'DRAFT' | 'OPEN' | 'COMPLETED' | 'CANCELLED' | 'VOIDED';
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'PARCEL' | 'CUSTOM';
export type DiscountType = 'fixed' | 'percentage';
export type ReceiptFormat = 'compact80' | 'compact58' | 'a4';
export type PricingMode = 'inclusive' | 'exclusive';

export interface BusinessProfile {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail?: string;
  phone: string;
  category: BusinessCategory;
  address: string;
  logoUrl?: string;
  currency: string; // 'INR'
  currencySymbol: string; // '₹'
  status: AccountStatus;
  plan: AccessPlan;
  planExpiresAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSettings {
  tax: {
    enabled: boolean;
    gstin: string;
    defaultGstRate: number; // e.g. 5, 12, 18
    pricingMode: PricingMode;
    isInterState?: boolean; // IGST vs CGST+SGST
  };
  receipt: {
    defaultFormat: ReceiptFormat;
    showLogo: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showGstin: boolean;
    footerMessage: string;
  };
  billing: {
    defaultPaymentMethod: PaymentMethod;
    billNumberPrefix: string;
    nextBillNumber: number;
  };
  tables?: {
    enabled: boolean;
    availableTables: string[];
  };
  permissions?: {
    cashiersCanCollectPayments: boolean;
  };
}

// ========================
// CUSTOM TABLE MANAGEMENT
// ========================

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'PAYMENT_PENDING';

export interface RestaurantTable {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  seatingCapacity?: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface TableWithStatus extends RestaurantTable {
  status: TableStatus;
  activeOrders: Order[];
  totalOutstanding: number;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  businessId: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName: string;
  imageUrl?: string;
  gstRate?: number; // optional custom GST rate
  isVeg?: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
  gstRate: number;
  lineTotal: number;
  isCustom?: boolean;
  isVeg?: boolean;
}

export interface TaxCalculationResult {
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  effectiveGstRate: number;
}

export interface BillExtra {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  gstRate?: number;
}

export interface OrderPayment {
  id: string;
  orderId: string;
  businessId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  receivedBy: string; // uid or member name
  receivedByName?: string;
  receivedAt: string;
  notes?: string;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
}

export interface Order {
  id: string;
  billNumber: string;
  businessId: string;
  tableId?: string | null;
  tableName?: string | null; // Snapshot preserved on historical orders
  tableNumber?: string | null; // e.g. "Table 01", "Table 02", "Takeaway", "Parcel"
  orderType?: OrderType;
  customer?: CustomerInfo;
  items: OrderItem[];
  extras?: BillExtra[];
  payments?: OrderPayment[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  balanceDue: number;
  status: OrderStatus;
  voidReason?: string;
  createdBy?: string;
  createdByName?: string;
  completedBy?: string;
  taxConfigSnapshot: {
    enabled: boolean;
    gstin: string;
    pricingMode: PricingMode;
    defaultGstRate: number;
    isInterState?: boolean;
  };
  isDemo?: boolean;
  isOfflineCreated?: boolean;
  syncedWithCloud?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueStats {
  todayRevenue: number;
  todayOrdersCount: number;
  averageOrderValue: number;
  todayCashCollected: number;
  todayUpiCollected: number;
  todayCardCollected: number;
  todayOtherCollected: number;
  todayOutstanding: number;
}

// ========================
// SUPER ADMIN & PLATFORM
// ========================

export interface SuperAdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: 'SUPER_ADMIN';
}

export interface PlatformMetrics {
  totalShops: number;
  activeShops: number;
  suspendedShops: number;
  totalOrders: number;
  totalSalesVolume: number;
  newRegistrationsThisMonth: number;
  activeToday: number;
}

export interface ShopSummary extends BusinessProfile {
  totalOrders: number;
  totalSales: number;
  lastOrderAt?: string;
}

// ========================
// SUPPLIER MANAGEMENT
// ========================

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  companyName: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  gstin?: string;
  suppliedProducts?: string;
  paymentTerms?: string; // e.g. "Net 15", "Immediate", "Weekly"
  notes?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ========================
// INVENTORY MANAGEMENT
// ========================

export type InventoryUnit = 'kg' | 'g' | 'l' | 'ml' | 'pcs' | 'packets' | 'boxes';
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryItem {
  id: string;
  businessId: string;
  name: string;
  category: string;
  sku?: string;
  unit: InventoryUnit;
  currentStock: number;
  minimumStock: number;
  purchasePrice: number;
  supplierId?: string;
  supplierName?: string;
  lastPurchaseDate?: string;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = 'PURCHASE_RECEIPT' | 'MANUAL_ADJUSTMENT' | 'USAGE' | 'WASTAGE';

export interface StockMovement {
  id: string;
  businessId: string;
  inventoryItemId: string;
  itemName: string;
  type: StockMovementType;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string; // e.g. PO Number or Audit ID
  createdAt: string;
}

// ========================
// PURCHASE ORDERS & PAYMENTS
// ========================

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  inventoryItemId: string;
  itemName: string;
  unit: InventoryUnit;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // e.g. "PO-1001"
  businessId: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
  status: PurchaseOrderStatus;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  orderDate: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayment {
  id: string;
  businessId: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
}

// ========================
// EXPENSES & ACTIVITY LOGS
// ========================

export interface Expense {
  id: string;
  businessId: string;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
  date: string;
  createdBy: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  businessId: string;
  action: string;
  module: string;
  performedBy: string;
  details: Record<string, any>;
  createdAt: string;
}

export interface PlatformAdmin {
  uid: string;
  email: string;
  displayName: string;
  role: 'SUPER_ADMIN';
  createdAt: string;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  defaultCurrency: string;
  plans: Record<string, any>;
  maintenanceMode: boolean;
  updatedAt: string;
}
