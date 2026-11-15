import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  AccessPlan, 
  BillingCycle, 
  RenewalReminder, 
  SubscriptionPayment, 
  SubscriptionPlan, 
  SubscriptionRecord, 
  SubscriptionStatus 
} from '../../types';

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_starter',
    name: 'Starter Counter',
    tierKey: 'starter',
    description: 'Perfect for small food stalls, single-counter cafes, and fast-food kiosks',
    monthlyPrice: 999,
    quarterlyPrice: 2699,
    annualPrice: 9999,
    currency: 'INR',
    maxMembers: 3,
    maxMenuItems: 200,
    features: {
      billing: true,
      orders: true,
      pendingPayments: true,
      menuManagement: true,
      tableManagement: false,
      suppliers: false,
      inventory: false,
      purchaseOrders: false,
      reports: true,
      gst: true,
      whatsapp: true,
      printing: true,
      customerManagement: true,
      memberManagement: true,
      expenses: false,
      offlineBilling: true,
    },
    isPopular: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan_pro',
    name: 'Professional Counter',
    tierKey: 'pro',
    description: 'Designed for busy dine-in restaurants, cafes, and multi-staff food outlets',
    monthlyPrice: 2499,
    quarterlyPrice: 6749,
    annualPrice: 24999,
    currency: 'INR',
    maxMembers: 10,
    maxMenuItems: -1, // Unlimited
    features: {
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
      expenses: true,
      offlineBilling: true,
    },
    isPopular: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise Multi-Outlet',
    tierKey: 'enterprise',
    description: 'Full suite with unlimited staff, advanced multi-channel reporting, and dedicated support',
    monthlyPrice: 4999,
    quarterlyPrice: 13499,
    annualPrice: 49999,
    currency: 'INR',
    maxMembers: 50,
    maxMenuItems: -1,
    features: {
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
      expenses: true,
      offlineBilling: true,
    },
    isPopular: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const LOCAL_PLANS_KEY = 'food_pos_subscription_plans';
const LOCAL_SUBS_KEY_PREFIX = 'food_pos_shop_sub_';

function getLocalPlans(): SubscriptionPlan[] {
  try {
    const raw = localStorage.getItem(LOCAL_PLANS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SUBSCRIPTION_PLANS;
  } catch {
    return DEFAULT_SUBSCRIPTION_PLANS;
  }
}

function saveLocalPlans(plans: SubscriptionPlan[]): void {
  try {
    localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(plans));
  } catch {}
}

/**
 * Get all available subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const local = getLocalPlans();
  try {
    const colRef = collection(db, 'platform', 'subscriptionPlans', 'items');
    const snap = await withTimeout(getDocs(colRef), 2000);
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan));
      saveLocalPlans(list);
      return list;
    } else {
      // Seed default plans if empty
      await Promise.all(
        DEFAULT_SUBSCRIPTION_PLANS.map(p =>
          setDoc(doc(db, 'platform', 'subscriptionPlans', 'items', p.id), p)
        )
      );
      return DEFAULT_SUBSCRIPTION_PLANS;
    }
  } catch (err) {
    console.warn('Using local fallback for subscription plans:', err);
    return local;
  }
}

/**
 * Save or update a subscription plan
 */
export async function saveSubscriptionPlan(plan: SubscriptionPlan): Promise<void> {
  const plans = getLocalPlans();
  const existingIdx = plans.findIndex(p => p.id === plan.id);
  const now = new Date().toISOString();
  const planToSave = { ...plan, updatedAt: now };

  if (existingIdx >= 0) {
    plans[existingIdx] = planToSave;
  } else {
    plans.push(planToSave);
  }
  saveLocalPlans(plans);

  try {
    const planRef = doc(db, 'platform', 'subscriptionPlans', 'items', plan.id);
    await withTimeout(setDoc(planRef, planToSave, { merge: true }), 2000);
  } catch (err) {
    console.warn('Could not sync subscription plan to cloud:', err);
  }
}

/**
 * Delete a subscription plan
 */
export async function deleteSubscriptionPlan(planId: string): Promise<void> {
  const plans = getLocalPlans().filter(p => p.id !== planId);
  saveLocalPlans(plans);

  try {
    const planRef = doc(db, 'platform', 'subscriptionPlans', 'items', planId);
    await withTimeout(deleteDoc(planRef), 2000);
  } catch (err) {
    console.warn('Could not delete plan from cloud:', err);
  }
}

/**
 * Compute subscription status based on current date, expiration date, and grace period
 */
export function computeSubscriptionStatus(
  status: SubscriptionStatus,
  expiresAt: string,
  graceExpiresAt: string
): SubscriptionStatus {
  if (status === 'SUSPENDED' || status === 'CANCELLED') {
    return status;
  }

  const now = new Date().getTime();
  const expiryTime = new Date(expiresAt).getTime();
  const graceTime = new Date(graceExpiresAt).getTime();

  if (now > graceTime) {
    return 'EXPIRED';
  }

  if (now > expiryTime) {
    return 'GRACE_PERIOD';
  }

  const sevenDaysMs = 7 * 24 * 3600 * 1000;
  if (expiryTime - now <= sevenDaysMs) {
    return 'EXPIRING_SOON';
  }

  return status === 'TRIAL' ? 'TRIAL' : 'ACTIVE';
}

/**
 * Get active subscription for a business
 */
export async function getShopSubscription(businessId: string): Promise<SubscriptionRecord | null> {
  try {
    const rawLocal = localStorage.getItem(`${LOCAL_SUBS_KEY_PREFIX}${businessId}`);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal) as SubscriptionRecord;
      parsed.status = computeSubscriptionStatus(parsed.status, parsed.expiresAt, parsed.graceExpiresAt);
      return parsed;
    }
  } catch {}

  try {
    const docRef = doc(db, 'businesses', businessId, 'subscriptions', 'current');
    const snap = await withTimeout(getDoc(docRef), 2000);
    if (snap.exists()) {
      const data = snap.data() as SubscriptionRecord;
      data.status = computeSubscriptionStatus(data.status, data.expiresAt, data.graceExpiresAt);
      try {
        localStorage.setItem(`${LOCAL_SUBS_KEY_PREFIX}${businessId}`, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (err) {
    console.warn('Could not fetch cloud subscription:', err);
  }

  // Fallback default trial
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
  const graceExpires = new Date(now.getTime() + 33 * 24 * 3600 * 1000).toISOString();

  const fallbackSub: SubscriptionRecord = {
    id: `sub_${businessId}_init`,
    businessId,
    planId: 'plan_pro',
    planName: 'Professional Counter',
    tierKey: 'pro',
    billingCycle: 'MONTHLY',
    pricePaid: 0,
    status: 'ACTIVE',
    startDate: now.toISOString(),
    expiresAt: expires,
    gracePeriodDays: 3,
    graceExpiresAt: graceExpires,
    autoRenew: false,
    mandateStatus: 'NONE',
    assignedBy: 'SYSTEM',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  try {
    localStorage.setItem(`${LOCAL_SUBS_KEY_PREFIX}${businessId}`, JSON.stringify(fallbackSub));
  } catch {}

  return fallbackSub;
}

/**
 * Assign or renew a subscription for a shop
 */
export async function assignShopSubscription(
  businessId: string,
  params: {
    planId: string;
    billingCycle: BillingCycle;
    durationDays?: number;
    pricePaid: number;
    autoRenew?: boolean;
    mandateId?: string;
    mandateGateway?: 'RAZORPAY' | 'CASHFREE' | 'MANUAL';
    assignedBy?: string;
    notes?: string;
  }
): Promise<SubscriptionRecord> {
  const plans = await getSubscriptionPlans();
  const selectedPlan = plans.find(p => p.id === params.planId) || DEFAULT_SUBSCRIPTION_PLANS[1];

  let days = params.durationDays;
  if (!days) {
    switch (params.billingCycle) {
      case 'QUARTERLY':
        days = 90;
        break;
      case 'HALF_YEARLY':
        days = 180;
        break;
      case 'ANNUAL':
        days = 365;
        break;
      case 'MONTHLY':
      default:
        days = 30;
        break;
    }
  }

  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 3600 * 1000).toISOString();
  const graceExpires = new Date(now.getTime() + (days + 3) * 24 * 3600 * 1000).toISOString();
  const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newSub: SubscriptionRecord = {
    id: subId,
    businessId,
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    tierKey: selectedPlan.tierKey,
    billingCycle: params.billingCycle,
    pricePaid: params.pricePaid,
    status: 'ACTIVE',
    startDate: now.toISOString(),
    expiresAt: expires,
    gracePeriodDays: 3,
    graceExpiresAt: graceExpires,
    autoRenew: params.autoRenew ?? false,
    mandateId: params.mandateId,
    mandateStatus: params.mandateId ? 'ACTIVE' : 'NONE',
    mandateGateway: params.mandateGateway || 'MANUAL',
    assignedBy: params.assignedBy || 'SUPER_ADMIN',
    notes: params.notes,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Cache locally
  try {
    localStorage.setItem(`${LOCAL_SUBS_KEY_PREFIX}${businessId}`, JSON.stringify(newSub));
  } catch {}

  // Save to Firestore:
  // 1. businesses/{businessId}/subscriptions/current
  // 2. businesses/{businessId}/subscriptions/history/{subId}
  // 3. update business profile plan & planExpiresAt
  // 4. update platform directory shop record
  try {
    const curRef = doc(db, 'businesses', businessId, 'subscriptions', 'current');
    const histRef = doc(db, 'businesses', businessId, 'subscriptions', 'history', subId);
    const profRef = doc(db, 'businesses', businessId, 'meta', 'profile');
    const dirRef = doc(db, 'platform', 'shops', 'directory', businessId);

    await withTimeout(
      Promise.all([
        setDoc(curRef, newSub),
        setDoc(histRef, newSub),
        updateDoc(profRef, {
          plan: selectedPlan.tierKey,
          planExpiresAt: expires,
          subscriptionStatus: 'ACTIVE',
          updatedAt: now.toISOString(),
        }),
        updateDoc(dirRef, {
          plan: selectedPlan.tierKey,
          planExpiresAt: expires,
          subscriptionStatus: 'ACTIVE',
          updatedAt: now.toISOString(),
        }),
      ]),
      2500
    );
  } catch (err) {
    console.warn('Could not sync assigned subscription to cloud Firestore:', err);
  }

  // Also record payment if price > 0
  if (params.pricePaid > 0) {
    await recordSubscriptionPayment({
      subscriptionId: subId,
      businessId,
      amount: params.pricePaid,
      currency: 'INR',
      paymentMethod: params.mandateGateway === 'MANUAL' ? 'CASH' : 'ONLINE_MANDATE',
      gateway: params.mandateGateway === 'RAZORPAY' ? 'RAZORPAY' : params.mandateGateway === 'CASHFREE' ? 'CASHFREE' : 'MANUAL_CASH',
      status: 'SUCCESS',
      paidAt: now.toISOString(),
      notes: `Subscription payment for ${selectedPlan.name} (${params.billingCycle})`,
    });
  }

  // Schedule renewal reminders
  await scheduleRenewalReminders(businessId, newSub);

  return newSub;
}

/**
 * Record a subscription payment
 */
export async function recordSubscriptionPayment(payment: Omit<SubscriptionPayment, 'id' | 'createdAt'>): Promise<SubscriptionPayment> {
  const paymentId = `spay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const record: SubscriptionPayment = {
    ...payment,
    id: paymentId,
    createdAt: now,
  };

  // Cache locally
  try {
    const key = `food_pos_sub_payments_${payment.businessId}`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    localStorage.setItem(key, JSON.stringify([record, ...list]));
  } catch {}

  try {
    const payRef = doc(db, 'businesses', payment.businessId, 'payments', paymentId);
    await withTimeout(setDoc(payRef, record), 2000);
  } catch (err) {
    console.warn('Could not save subscription payment to cloud:', err);
  }

  return record;
}

/**
 * Get subscription payment records for a business
 */
export async function getSubscriptionPayments(businessId: string): Promise<SubscriptionPayment[]> {
  try {
    const key = `food_pos_sub_payments_${businessId}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}

  try {
    const colRef = collection(db, 'businesses', businessId, 'payments');
    const snap = await withTimeout(getDocs(colRef), 2000);
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPayment));
    }
  } catch (err) {
    console.warn('Could not load subscription payments:', err);
  }

  return [];
}

/**
 * Generate automatic renewal reminders schedule (7 days, 3 days, 1 day, on expiry, 3 days grace)
 */
export async function scheduleRenewalReminders(
  businessId: string, 
  subscription: SubscriptionRecord
): Promise<RenewalReminder[]> {
  const expiryTime = new Date(subscription.expiresAt).getTime();
  const intervals = [
    { days: 7, label: '7 Days Before Expiration Reminder' },
    { days: 3, label: '3 Days Before Expiration Reminder' },
    { days: 1, label: '1 Day Before Expiration Reminder' },
    { days: 0, label: 'Subscription Expires Today Reminder' },
    { days: -3, label: 'Grace Period Overdue Final Notice' },
  ];

  const now = new Date().getTime();
  const reminders: RenewalReminder[] = intervals.map(item => {
    const targetMs = expiryTime - item.days * 24 * 3600 * 1000;
    const targetDate = new Date(targetMs).toISOString();
    return {
      id: `rem_${subscription.id}_${item.days}`,
      businessId,
      subscriptionId: subscription.id,
      daysBeforeExpiry: item.days,
      targetDate,
      status: targetMs <= now ? 'SENT' : 'PENDING',
      channel: 'IN_APP',
      message: `Your Food POS ${subscription.planName} subscription ${
        item.days > 0 
          ? `expires in ${item.days} days on ${new Date(subscription.expiresAt).toLocaleDateString('en-IN')}` 
          : item.days === 0 
          ? 'expires today. Please renew to ensure uninterrupted counter billing.'
          : 'has expired and your grace period has ended. Access is locked until renewal.'
      }`,
      createdAt: new Date().toISOString(),
    };
  });

  try {
    const remKey = `food_pos_reminders_${businessId}`;
    localStorage.setItem(remKey, JSON.stringify(reminders));
  } catch {}

  return reminders;
}

/**
 * Check shop access permission: returns whether counter billing is allowed or locked out
 */
export async function checkShopAccess(businessId: string): Promise<{
  allowed: boolean;
  status: SubscriptionStatus;
  planName: string;
  daysRemaining: number;
  reason?: string;
}> {
  const sub = await getShopSubscription(businessId);
  if (!sub) {
    return { allowed: true, status: 'ACTIVE', planName: 'Pro Counter', daysRemaining: 30 };
  }

  const now = new Date().getTime();
  const expiryMs = new Date(sub.expiresAt).getTime();
  const graceMs = new Date(sub.graceExpiresAt).getTime();
  const daysRemaining = Math.max(0, Math.ceil((expiryMs - now) / (1000 * 3600 * 24)));

  if (sub.status === 'SUSPENDED') {
    return {
      allowed: false,
      status: 'SUSPENDED',
      planName: sub.planName,
      daysRemaining: 0,
      reason: 'Your account has been suspended by the platform administrator. Please contact support.',
    };
  }

  if (now > graceMs) {
    return {
      allowed: false,
      status: 'EXPIRED',
      planName: sub.planName,
      daysRemaining: 0,
      reason: 'Your subscription has expired and your 3-day grace period has elapsed. Please renew your plan to continue billing.',
    };
  }

  if (now > expiryMs) {
    return {
      allowed: true, // Still allowed during grace period
      status: 'GRACE_PERIOD',
      planName: sub.planName,
      daysRemaining: 0,
      reason: 'Your subscription has expired. You are currently in a 3-day grace period.',
    };
  }

  return {
    allowed: true,
    status: sub.status,
    planName: sub.planName,
    daysRemaining,
  };
}
