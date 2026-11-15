import { computeSubscriptionStatus, DEFAULT_SUBSCRIPTION_PLANS } from '../src/services/subscription/subscriptionService';
import * as fs from 'fs';
import * as path from 'path';

async function runAcceptanceTests() {
  console.log('--- STARTING ACCEPTANCE TESTS: TOUCH UX & SUBSCRIPTIONS ---');

  // Test 1: Subscription default plans
  console.log('\n[Test 1] Verify Subscription Default Plans');
  if (DEFAULT_SUBSCRIPTION_PLANS.length !== 3) {
    throw new Error(`Expected 3 default plans, got ${DEFAULT_SUBSCRIPTION_PLANS.length}`);
  }
  const [starter, pro, enterprise] = DEFAULT_SUBSCRIPTION_PLANS;
  if (starter.tierKey !== 'starter' || pro.tierKey !== 'pro' || enterprise.tierKey !== 'enterprise') {
    throw new Error('Default plan tierKeys incorrect');
  }
  if (starter.monthlyPrice !== 999 || pro.monthlyPrice !== 2499 || enterprise.monthlyPrice !== 4999) {
    throw new Error('Default plan monthly prices incorrect');
  }
  console.log('✅ Default plans verified: Starter (₹999), Pro (₹2,499), Enterprise (₹4,999)');

  // Test 2: computeSubscriptionStatus logic
  console.log('\n[Test 2] Verify computeSubscriptionStatus Logic');
  const now = new Date();
  
  // Future expiry (> 7 days)
  const future10Days = new Date(now.getTime() + 10 * 86400000).toISOString();
  const future13Days = new Date(now.getTime() + 13 * 86400000).toISOString();
  const resActive = computeSubscriptionStatus('ACTIVE', future10Days, future13Days);
  if (resActive !== 'ACTIVE') {
    throw new Error(`Expected ACTIVE, got ${resActive}`);
  }

  // Expiring soon (within 7 days)
  const future4Days = new Date(now.getTime() + 4 * 86400000).toISOString();
  const future7Days = new Date(now.getTime() + 7 * 86400000).toISOString();
  const resExpiring = computeSubscriptionStatus('ACTIVE', future4Days, future7Days);
  if (resExpiring !== 'EXPIRING_SOON') {
    throw new Error(`Expected EXPIRING_SOON, got ${resExpiring}`);
  }

  // Grace period (expired 1 day ago, grace is 3 days)
  const past1Day = new Date(now.getTime() - 1 * 86400000).toISOString();
  const future2Days = new Date(now.getTime() + 2 * 86400000).toISOString();
  const resGrace = computeSubscriptionStatus('ACTIVE', past1Day, future2Days);
  if (resGrace !== 'GRACE_PERIOD') {
    throw new Error(`Expected GRACE_PERIOD, got ${resGrace}`);
  }

  // Expired (expired 4 days ago, grace expired 1 day ago)
  const past4Days = new Date(now.getTime() - 4 * 86400000).toISOString();
  const past1Grace = new Date(now.getTime() - 1 * 86400000).toISOString();
  const resExpired = computeSubscriptionStatus('ACTIVE', past4Days, past1Grace);
  if (resExpired !== 'EXPIRED') {
    throw new Error(`Expected EXPIRED, got ${resExpired}`);
  }

  // Suspended override
  const resSuspended = computeSubscriptionStatus('SUSPENDED', future10Days, future13Days);
  if (resSuspended !== 'SUSPENDED') {
    throw new Error(`Expected SUSPENDED, got ${resSuspended}`);
  }
  console.log('✅ Subscription status lifecycle (ACTIVE, EXPIRING_SOON, GRACE_PERIOD, EXPIRED, SUSPENDED) verified');

  // Test 3: Check CSS touch classes in src/index.css
  console.log('\n[Test 3] Verify Touch Design System Classes in index.css');
  const cssContent = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
  const requiredClasses = [
    '.btn-mobile-primary',
    '.btn-mobile-secondary',
    '.btn-mobile-danger',
    '.btn-icon-mobile',
    '.input-mobile',
    '.select-mobile',
    '.stepper-btn-mobile',
    'min-height: 52px',
    'min-height: 48px',
    'min-width: 44px',
  ];
  for (const token of requiredClasses) {
    if (!cssContent.includes(token)) {
      throw new Error(`CSS missing required touch utility token: "${token}"`);
    }
  }
  console.log('✅ CSS touch utility tokens and sizing rules verified');

  // Test 4: Check Mobile Navigation padding & sizing
  console.log('\n[Test 4] Verify AppLayout & MobileNavBar touch ergonomics');
  const layoutContent = fs.readFileSync(path.resolve('src/components/navigation/AppLayout.tsx'), 'utf-8');
  if (!layoutContent.includes('pb-32')) {
    throw new Error('AppLayout does not provide pb-32 clearance for bottom nav bar and floating action panels');
  }

  const navContent = fs.readFileSync(path.resolve('src/components/navigation/MobileNavBar.tsx'), 'utf-8');
  if (!navContent.includes('min-h-[52px]') || !navContent.includes('min-w-[48px]')) {
    throw new Error('MobileNavBar touch targets below 52px minimum height specification');
  }
  console.log('✅ Bottom bar clearance (pb-32) and tab hit targets (min-h-[52px]) verified');

  // Test 5: Verify Touch target sizes on BillingPage
  console.log('\n[Test 5] Verify Touch target sizes on BillingPage');
  const billingContent = fs.readFileSync(path.resolve('src/pages/Billing/BillingPage.tsx'), 'utf-8');
  if (!billingContent.includes('min-h-[52px]') && !billingContent.includes('h-13')) {
    throw new Error('BillingPage missing required 52px primary action buttons');
  }
  if (!billingContent.includes('w-11 h-11') && !billingContent.includes('stepper-btn-mobile')) {
    throw new Error('BillingPage missing 44x44px stepper quantity buttons');
  }
  console.log('✅ BillingPage steppers (44x44px) and primary action buttons (>=52px) verified');

  console.log('\n🎉 ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
}

runAcceptanceTests().catch((err) => {
  console.error('❌ Acceptance test failed:', err);
  process.exit(1);
});
