import { 
  UserRole, 
  MemberPermissions, 
  MemberNavigationVisibility, 
  BusinessMember,
  PaymentPermissions 
} from '../../types';

export const SUGGESTED_POSITIONS: string[] = [
  'Head Chef',
  'Cook',
  'Assistant Cook',
  'Kitchen Staff',
  'Cashier',
  'Billing Executive',
  'Restaurant Manager',
  'Floor Manager',
  'Waiter',
  'Delivery Staff',
  'Store Keeper',
  'Inventory Manager',
];

export interface RoleTemplateMeta {
  role: UserRole;
  title: string;
  description: string;
  recommendedPosition: string;
  badgeColor: string;
}

export const ROLE_TEMPLATES: RoleTemplateMeta[] = [
  {
    role: 'OWNER',
    title: 'Owner',
    description: 'Full unrestricted control of all business modules, staff, settings and billing.',
    recommendedPosition: 'Store Owner',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  },
  {
    role: 'MANAGER',
    title: 'Restaurant Manager',
    description: 'Manage daily restaurant operations, inventory, suppliers, reports and orders.',
    recommendedPosition: 'Restaurant Manager',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  },
  {
    role: 'CASHIER',
    title: 'Cashier / Billing Counter',
    description: 'Create fast bills, view permitted orders, print receipts & collect payments (if authorized).',
    recommendedPosition: 'Cashier',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  {
    role: 'KITCHEN',
    title: 'Cook / Kitchen Staff',
    description: 'View incoming kitchen tickets, food variants, preparation notes & update order readiness.',
    recommendedPosition: 'Cook',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-300',
  },
  {
    role: 'CUSTOM',
    title: 'Custom Staff Role',
    description: 'Choose custom position and hand-pick exact module access and action permissions.',
    recommendedPosition: 'Floor Staff',
    badgeColor: 'bg-zinc-100 text-zinc-800 border-zinc-300',
  },
];

export const DEFAULT_PAYMENT_PERMISSIONS: PaymentPermissions = {
  canCollectPayment: true,
  collectCash: true,
  collectUpi: true,
  collectCard: true,
  collectOther: true,
  partialPayment: true,
  markFullPaid: true,
  viewPaymentHistory: true,
  issueRefunds: false, // Explicit owner authorization required
};

export function getDefaultPermissionsForRole(role: UserRole): MemberPermissions {
  switch (role) {
    case 'OWNER':
    case 'SUPER_ADMIN':
      return {
        dashboard: { view: true },
        billing: { view: true, create: true, edit: true, delete: true },
        orders: { view: true, create: true, edit: true, delete: true, voidOrder: true },
        pendingPayments: { ...DEFAULT_PAYMENT_PERMISSIONS, issueRefunds: true },
        kitchenOrders: { view: true, accept: true, prepare: true, markReady: true, markServed: true },
        menuManagement: { view: true, create: true, edit: true, delete: true },
        tableManagement: { view: true, create: true, edit: true, delete: true },
        inventory: { view: true, create: true, edit: true, delete: true },
        suppliers: { view: true, create: true, edit: true, delete: true },
        purchaseOrders: { view: true, create: true, edit: true, delete: true },
        reports: { view: true, exportReports: true },
        customerManagement: { view: true, create: true, edit: true, delete: true },
        memberManagement: { view: true, create: true, edit: true, delete: true },
        expenses: { view: true, create: true, edit: true, delete: true },
        settings: { view: true, edit: true },
      };

    case 'MANAGER':
      return {
        dashboard: { view: true },
        billing: { view: true, create: true, edit: true, delete: false },
        orders: { view: true, create: true, edit: true, delete: false, voidOrder: true },
        pendingPayments: { ...DEFAULT_PAYMENT_PERMISSIONS, issueRefunds: false },
        kitchenOrders: { view: true, accept: true, prepare: true, markReady: true, markServed: true },
        menuManagement: { view: true, create: true, edit: true, delete: false },
        tableManagement: { view: true, create: true, edit: true, delete: false },
        inventory: { view: true, create: true, edit: true, delete: false },
        suppliers: { view: true, create: true, edit: true, delete: false },
        purchaseOrders: { view: true, create: true, edit: true, delete: false },
        reports: { view: true, exportReports: true },
        customerManagement: { view: true, create: true, edit: true, delete: false },
        memberManagement: { view: true, create: false, edit: false, delete: false },
        expenses: { view: true, create: true, edit: true, delete: false },
        settings: { view: true, edit: false },
      };

    case 'CASHIER':
      return {
        dashboard: { view: true },
        billing: { view: true, create: true, edit: true, delete: false },
        orders: { view: true, create: true, edit: false, delete: false, voidOrder: false },
        pendingPayments: {
          canCollectPayment: true,
          collectCash: true,
          collectUpi: true,
          collectCard: true,
          collectOther: true,
          partialPayment: true,
          markFullPaid: true,
          viewPaymentHistory: true,
          issueRefunds: false,
        },
        kitchenOrders: { view: true, accept: false, prepare: false, markReady: false, markServed: false },
        menuManagement: { view: false, create: false, edit: false, delete: false },
        tableManagement: { view: true, create: false, edit: false, delete: false },
        inventory: { view: false, create: false, edit: false, delete: false },
        suppliers: { view: false, create: false, edit: false, delete: false },
        purchaseOrders: { view: false, create: false, edit: false, delete: false },
        reports: { view: false, exportReports: false },
        customerManagement: { view: true, create: true, edit: false, delete: false },
        memberManagement: { view: false, create: false, edit: false, delete: false },
        expenses: { view: false, create: false, edit: false, delete: false },
        settings: { view: false, edit: false },
      };

    case 'KITCHEN':
      return {
        dashboard: { view: false },
        billing: { view: false, create: false, edit: false, delete: false },
        orders: { view: true, create: false, edit: false, delete: false, voidOrder: false },
        pendingPayments: {
          canCollectPayment: false,
          collectCash: false,
          collectUpi: false,
          collectCard: false,
          collectOther: false,
          partialPayment: false,
          markFullPaid: false,
          viewPaymentHistory: false,
          issueRefunds: false,
        },
        kitchenOrders: { view: true, accept: true, prepare: true, markReady: true, markServed: true },
        menuManagement: { view: false, create: false, edit: false, delete: false },
        tableManagement: { view: true, create: false, edit: false, delete: false },
        inventory: { view: false, create: false, edit: false, delete: false },
        suppliers: { view: false, create: false, edit: false, delete: false },
        purchaseOrders: { view: false, create: false, edit: false, delete: false },
        reports: { view: false, exportReports: false },
        customerManagement: { view: false, create: false, edit: false, delete: false },
        memberManagement: { view: false, create: false, edit: false, delete: false },
        expenses: { view: false, create: false, edit: false, delete: false },
        settings: { view: false, edit: false },
      };

    case 'CUSTOM':
    default:
      return {
        dashboard: { view: true },
        billing: { view: true, create: true, edit: false, delete: false },
        orders: { view: true, create: false, edit: false, delete: false },
        pendingPayments: {
          canCollectPayment: false,
          collectCash: false,
          collectUpi: false,
          collectCard: false,
          collectOther: false,
          partialPayment: false,
          markFullPaid: false,
          viewPaymentHistory: false,
          issueRefunds: false,
        },
        kitchenOrders: { view: true, accept: false, prepare: false, markReady: false, markServed: false },
        menuManagement: { view: false, create: false, edit: false, delete: false },
        tableManagement: { view: true, create: false, edit: false, delete: false },
        inventory: { view: false, create: false, edit: false, delete: false },
        suppliers: { view: false, create: false, edit: false, delete: false },
        purchaseOrders: { view: false, create: false, edit: false, delete: false },
        reports: { view: false, exportReports: false },
        customerManagement: { view: false, create: false, edit: false, delete: false },
        memberManagement: { view: false, create: false, edit: false, delete: false },
        expenses: { view: false, create: false, edit: false, delete: false },
        settings: { view: false, edit: false },
      };
  }
}

export function getDefaultNavigationForRole(role: UserRole): MemberNavigationVisibility {
  switch (role) {
    case 'OWNER':
    case 'SUPER_ADMIN':
      return {
        dashboard: true,
        billing: true,
        kitchen: true,
        tables: true,
        pendingPayments: true,
        orders: true,
        menu: true,
        inventory: true,
        suppliers: true,
        purchases: true,
        reports: true,
        expenses: true,
        customers: true,
        members: true,
        settings: true,
      };

    case 'MANAGER':
      return {
        dashboard: true,
        billing: true,
        kitchen: true,
        tables: true,
        pendingPayments: true,
        orders: true,
        menu: true,
        inventory: true,
        suppliers: true,
        purchases: true,
        reports: true,
        expenses: true,
        customers: true,
        members: false,
        settings: false,
      };

    case 'CASHIER':
      return {
        dashboard: true,
        billing: true,
        kitchen: true,
        tables: true,
        pendingPayments: true,
        orders: true,
        menu: false,
        inventory: false,
        suppliers: false,
        purchases: false,
        reports: false,
        expenses: false,
        customers: true,
        members: false,
        settings: false,
      };

    case 'KITCHEN':
      return {
        dashboard: false,
        billing: false,
        kitchen: true,
        tables: false,
        pendingPayments: false,
        orders: false,
        menu: false,
        inventory: false,
        suppliers: false,
        purchases: false,
        reports: false,
        expenses: false,
        customers: false,
        members: false,
        settings: false,
      };

    case 'CUSTOM':
    default:
      return {
        dashboard: true,
        billing: true,
        kitchen: true,
        tables: true,
        pendingPayments: false,
        orders: true,
        menu: false,
        inventory: false,
        suppliers: false,
        purchases: false,
        reports: false,
        expenses: false,
        customers: false,
        members: false,
        settings: false,
      };
  }
}

/**
 * Checks whether a member has permission to perform an action on a module
 */
export function hasMemberPermission(
  member: BusinessMember | null | undefined,
  userRole: UserRole,
  moduleKey: keyof MemberPermissions,
  actionKey: 'view' | 'create' | 'edit' | 'delete' | 'special' = 'view',
  specialField?: string
): boolean {
  if (userRole === 'OWNER' || userRole === 'SUPER_ADMIN') {
    return true;
  }

  if (!member) {
    // If no member record attached, fallback to role default
    const defaults = getDefaultPermissionsForRole(userRole);
    const mod = (defaults as any)[moduleKey];
    if (!mod) return false;
    return !!mod[actionKey];
  }

  const permissions = member.permissions || getDefaultPermissionsForRole(member.role);
  const modPerms = (permissions as any)[moduleKey];
  if (!modPerms) return false;

  if (actionKey === 'special' && specialField) {
    return !!modPerms[specialField];
  }

  return !!modPerms[actionKey];
}
