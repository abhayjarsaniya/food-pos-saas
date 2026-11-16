import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../services/firebase/config';
import { AuthUser, loginWithEmail, logoutUser, signupWithEmail, subscribeToAuth } from '../services/auth/authService';
import { BusinessFeatures, BusinessProfile, BusinessSettings, DEFAULT_BUSINESS_FEATURES, UserRole, BusinessMember, MemberPermissions, MemberNavigationVisibility } from '../types';
import { 
  DEFAULT_BUSINESS_SETTINGS, 
  getBusinessProfile, 
  getBusinessSettings, 
  saveBusinessProfile, 
  saveBusinessSettings 
} from '../services/business/businessService';
import { getBusinessFeatures } from '../services/features/featureService';
import { resolveStaffLoginId, ResolvedStaffIdentity, STATIC_LOGIN_IDENTITIES } from '../services/members/memberService';
import { hasMemberPermission, getDefaultNavigationForRole, getDefaultPermissionsForRole } from '../services/members/permissionService';
import { clearLocalShopCache } from '../services/offline/indexedDb';

/**
 * Robust business resolver for an authenticated Firebase user.
 * Searches:
 * 1. Direct document: businesses/{uid}
 * 2. Businesses collection where ownerUid == uid, ownerEmail == email, or email == email
 * 3. Platform shops directory
 */
async function findBusinessForUser(uid: string, email: string): Promise<BusinessProfile | null> {
  const cleanEmail = (email || '').toLowerCase().trim();

  // 1. Direct document check
  try {
    const directSnap = await getDoc(doc(db, 'businesses', uid));
    if (directSnap.exists()) {
      return { id: directSnap.id, ...(directSnap.data() as any) };
    }
  } catch {}

  // 2. Query businesses collection
  try {
    const bSnap = await getDocs(collection(db, 'businesses'));
    for (const d of bSnap.docs) {
      const data = d.data();
      const bOwnerEmail = (data.ownerEmail || '').toLowerCase().trim();
      const bEmail = (data.email || '').toLowerCase().trim();
      if (
        data.ownerUid === uid ||
        (cleanEmail && (bOwnerEmail === cleanEmail || bEmail === cleanEmail))
      ) {
        return { id: d.id, ...(data as any) };
      }
    }
  } catch (err) {
    console.warn('Error querying businesses for user:', err);
  }

  // 3. Platform directory lookup
  try {
    const platSnap = await getDocs(collection(db, 'platform', 'shops', 'directory'));
    for (const d of platSnap.docs) {
      const data = d.data();
      const bOwnerEmail = (data.ownerEmail || '').toLowerCase().trim();
      if (
        data.ownerUid === uid ||
        (cleanEmail && bOwnerEmail === cleanEmail)
      ) {
        return { id: d.id, ...(data as any) };
      }
    }
  } catch {}

  return null;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: BusinessProfile | null;
  currentMember: BusinessMember | null;
  settings: BusinessSettings;
  features: BusinessFeatures;
  loading: boolean;
  isOnboarded: boolean;
  isSuperAdmin: boolean;
  isShopSuspended: boolean;
  isMemberDeactivated: boolean;
  userRole: UserRole;
  canCollectPayment: boolean;
  hasPermission: (moduleKey: keyof MemberPermissions, actionKey?: 'view' | 'create' | 'edit' | 'delete' | 'special', specialKey?: string) => boolean;
  hasNavAccess: (navKey: keyof MemberNavigationVisibility) => boolean;
  login: (identifier: string, pass: string) => Promise<UserRole>;
  signup: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: (profileData: Omit<BusinessProfile, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'plan'>, initialSettings?: Partial<BusinessSettings>) => Promise<void>;
  updateProfile: (profileData: Partial<BusinessProfile>) => Promise<void>;
  updateSettings: (settingsData: Partial<BusinessSettings>) => Promise<void>;
  demoLogin: () => Promise<void>;
  superAdminLogin: (email: string, pass: string) => Promise<void>;
  refreshFeatures: () => Promise<void>;
  switchShop: (businessId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [currentMember, setCurrentMember] = useState<BusinessMember | null>(null);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [features, setFeatures] = useState<BusinessFeatures>(DEFAULT_BUSINESS_FEATURES);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isMemberDeactivated, setIsMemberDeactivated] = useState<boolean>(false);

  const [userRole, setUserRole] = useState<UserRole>('OWNER');
  const [canCollectPayment, setCanCollectPayment] = useState<boolean>(true);

  const hasPermission = (
    moduleKey: keyof MemberPermissions,
    actionKey: 'view' | 'create' | 'edit' | 'delete' | 'special' = 'view',
    specialKey?: string
  ): boolean => {
    return hasMemberPermission(currentMember, userRole, moduleKey, actionKey, specialKey);
  };

  const hasNavAccess = (navKey: keyof MemberNavigationVisibility): boolean => {
    if (userRole === 'OWNER' || userRole === 'SUPER_ADMIN') return true;
    if (currentMember?.navigationVisibility) {
      return !!currentMember.navigationVisibility[navKey];
    }
    const defaults = getDefaultNavigationForRole(userRole);
    return !!defaults[navKey];
  };

  const loadShopContext = async (targetBusinessId: string) => {
    try {
      localStorage.setItem('food_pos_active_shop_id', targetBusinessId);
      const [prof, sett, feat] = await Promise.all([
        getBusinessProfile(targetBusinessId),
        getBusinessSettings(targetBusinessId),
        getBusinessFeatures(targetBusinessId),
      ]);
      if (prof) setProfile(prof);
      if (sett) setSettings(sett);
      if (feat) setFeatures(feat);
    } catch (err) {
      console.warn('Error fetching shop context:', err);
    }
  };

  const refreshFeatures = async () => {
    if (profile?.id) {
      const feat = await getBusinessFeatures(profile.id);
      setFeatures(feat);
    }
  };

  // Initialize Auth Listener
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (authUser) => {
      if (!authUser) {
        // If active staff session exists in localStorage, maintain session on page reload!
        const staffMetaRaw = localStorage.getItem('food_pos_staff_session');
        if (staffMetaRaw) {
          try {
            const staffMeta = JSON.parse(staffMetaRaw);
            if (staffMeta.businessId && staffMeta.member) {
              const activeMember = staffMeta.member;
              setUser({
                uid: activeMember.id || 'staff_session',
                email: activeMember.email || `${staffMeta.loginId}@staff.foodpos.app`,
                displayName: activeMember.name || staffMeta.loginId,
                isAnonymous: false,
                emailVerified: true,
              });
              setCurrentMember(activeMember);
              setUserRole(activeMember.role || staffMeta.role || 'CASHIER');
              setCanCollectPayment(activeMember.canCollectPayment ?? (activeMember.role !== 'KITCHEN'));
              setIsMemberDeactivated(activeMember.status === 'DEACTIVATED');
              await loadShopContext(staffMeta.businessId);
              setLoading(false);
              return;
            }
          } catch {}
        }

        const adminFlag = localStorage.getItem('food_pos_is_super_admin') === 'true';
        setIsSuperAdmin(adminFlag);
        setUser(null);
        setProfile(null);
        setCurrentMember(null);
        setIsMemberDeactivated(false);
        setUserRole('CASHIER');
        setLoading(false);
        return;
      }

      setUser(authUser);
      setLoading(true);

      try {
        const isAdmin = 
          authUser.email === 'superadmin@foodpos.app' || 
          authUser.email === 'admin@foodpos.app' || 
          localStorage.getItem('food_pos_is_super_admin') === 'true';

        setIsSuperAdmin(isAdmin);

        if (isAdmin) {
          setUserRole('SUPER_ADMIN');
          setCanCollectPayment(true);
          setProfile(null);
          setIsMemberDeactivated(false);
          setLoading(false);
          return;
        }

        // 1. Retrieve active staff session info if present
        const staffMetaRaw = localStorage.getItem('food_pos_staff_session');
        if (staffMetaRaw) {
          try {
            const staffMeta = JSON.parse(staffMetaRaw);
            if (staffMeta.businessId) {
              await loadShopContext(staffMeta.businessId);

              // Live verification of member account status from Firestore
              let liveMember: BusinessMember | null = null;
              try {
                const memberDocId = staffMeta.member?.id || authUser.uid;
                const mSnap = await getDoc(doc(db, 'businesses', staffMeta.businessId, 'members', memberDocId));
                if (mSnap.exists()) {
                  liveMember = { id: mSnap.id, ...(mSnap.data() as any) };
                }
              } catch {}

              const activeMember = liveMember || staffMeta.member;
              if (activeMember) {
                const isDeactivated = activeMember.status === 'DEACTIVATED' || activeMember.status === 'SUSPENDED';
                setIsMemberDeactivated(isDeactivated);
                setCurrentMember(activeMember);
                setUserRole(activeMember.role || staffMeta.role || 'CASHIER');
                setCanCollectPayment(activeMember.canCollectPayment ?? (activeMember.role !== 'KITCHEN'));
              } else {
                setUserRole(staffMeta.role || 'CASHIER');
                setCanCollectPayment(staffMeta.canCollectPayment ?? true);
              }
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Error reading staff session:', e);
          }
        }

        // 2. Discover business for authenticated user (Owner check)
        const biz = await findBusinessForUser(authUser.uid, authUser.email || '');
        if (biz) {
          setUserRole('OWNER');
          setCanCollectPayment(true);
          setIsMemberDeactivated(false);
          await loadShopContext(biz.id);
          setLoading(false);
          return;
        }

        // 3. Check if UID belongs to a registered staff member in Firestore
        try {
          const uidSnap = await getDoc(doc(db, 'members_by_uid', authUser.uid));
          if (uidSnap.exists()) {
            const uidData = uidSnap.data();
            const bId = uidData.businessId;
            if (bId) {
              await loadShopContext(bId);
              const mSnap = await getDoc(doc(db, 'businesses', bId, 'members', authUser.uid));
              if (mSnap.exists()) {
                const mData = { id: mSnap.id, ...(mSnap.data() as any) } as BusinessMember;
                const isDeactivated = (mData as any).status === 'DEACTIVATED' || (mData as any).status === 'SUSPENDED';
                setIsMemberDeactivated(isDeactivated);
                setCurrentMember(mData);
                setUserRole(mData.role);
                setCanCollectPayment(mData.canCollectPayment ?? (mData.role !== 'KITCHEN'));
                setLoading(false);
                return;
              }
            }
          }
        } catch {}

        // 4. Fallback to active shop ID if stored
        const storedShop = localStorage.getItem('food_pos_active_shop_id');
        if (storedShop) {
          await loadShopContext(storedShop);
          try {
            const mSnap = await getDoc(doc(db, 'businesses', storedShop, 'members', authUser.uid));
            if (mSnap.exists()) {
              const mData = { id: mSnap.id, ...(mSnap.data() as any) } as BusinessMember;
              const isDeactivated = (mData as any).status === 'DEACTIVATED' || (mData as any).status === 'SUSPENDED';
              setIsMemberDeactivated(isDeactivated);
              setCurrentMember(mData);
              setUserRole(mData.role);
              setCanCollectPayment(mData.canCollectPayment ?? (mData.role !== 'KITCHEN'));
            }
          } catch {}
        }
      } catch (err) {
        console.warn('Error during auth initialization:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Universal Login: Supports Super Admin, Shop Owner, Manager, Cashier, and Cook
   * via Login ID (e.g. superadmin, princeowner, princecook, cashier01) or Email + Password.
   * Resolves identity, verifies status & role from database, sets session, and returns UserRole.
   */
  const login = async (identifier: string, pass: string): Promise<UserRole> => {
    setLoading(true);
    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier || !pass) {
      setLoading(false);
      throw new Error('Please enter both Login ID / Email and password.');
    }

    try {
      let targetEmail = '';
      let resolvedIdentity: ResolvedStaffIdentity | null = null;

      // 1. Determine target email and staff identity
      if (cleanIdentifier.includes('@')) {
        targetEmail = cleanIdentifier.toLowerCase();
        try {
          const staticList = Object.values(STATIC_LOGIN_IDENTITIES as Record<string, ResolvedStaffIdentity>);
          const staticMatch = staticList.find(
            (s: ResolvedStaffIdentity) => s.email.toLowerCase() === targetEmail
          );
          if (staticMatch) resolvedIdentity = staticMatch;
        } catch {}
      } else {
        resolvedIdentity = await resolveStaffLoginId(cleanIdentifier);
        if (!resolvedIdentity) {
          throw new Error('Account not found. Please verify your Login ID or contact your Shop Owner.');
        }

        if (resolvedIdentity.status === 'DEACTIVATED' || (resolvedIdentity.status as any) === 'SUSPENDED') {
          throw new Error('Your staff account has been deactivated. Please contact your restaurant owner.');
        }

        targetEmail = resolvedIdentity.email.toLowerCase();
      }

      // If staff identity is known, pre-initialize session and load shop context BEFORE auth trigger
      if (resolvedIdentity && (
        resolvedIdentity.role === 'CASHIER' || 
        resolvedIdentity.role === 'MANAGER' || 
        resolvedIdentity.role === 'KITCHEN' || 
        resolvedIdentity.role === 'CUSTOM'
      )) {
        const staffBizId = resolvedIdentity.businessId || 'biz_prince_pavbhaji_01';
        localStorage.removeItem('food_pos_is_super_admin');

        const activeMemberObj: BusinessMember = {
          id: resolvedIdentity.memberId || `mem_${resolvedIdentity.loginId}`,
          businessId: staffBizId,
          name: resolvedIdentity.name || resolvedIdentity.loginId,
          loginId: resolvedIdentity.loginId,
          email: targetEmail,
          position: resolvedIdentity.position || (resolvedIdentity.role === 'KITCHEN' ? 'Cook' : resolvedIdentity.role === 'CASHIER' ? 'Cashier' : 'Staff'),
          role: resolvedIdentity.role,
          canCollectPayment: resolvedIdentity.role === 'KITCHEN' ? false : (resolvedIdentity.canCollectPayment ?? true),
          status: ((resolvedIdentity.status as any) === 'SUSPENDED' ? 'DEACTIVATED' : resolvedIdentity.status) as any,
          permissions: resolvedIdentity.permissions || getDefaultPermissionsForRole(resolvedIdentity.role),
          navigationVisibility: resolvedIdentity.navigationVisibility || getDefaultNavigationForRole(resolvedIdentity.role),
          invitedAt: new Date().toISOString(),
          joinedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };

        localStorage.setItem(
          'food_pos_staff_session',
          JSON.stringify({
            loginId: resolvedIdentity.loginId,
            businessId: staffBizId,
            role: resolvedIdentity.role,
            canCollectPayment: activeMemberObj.canCollectPayment,
            member: activeMemberObj,
          })
        );
        localStorage.setItem('food_pos_active_shop_id', staffBizId);

        // Pre-load shop profile & settings so they are ready immediately
        await loadShopContext(staffBizId);
        setCurrentMember(activeMemberObj);
        setUserRole(resolvedIdentity.role);
        setCanCollectPayment(activeMemberObj.canCollectPayment);
      }

      // 2. Authenticate with Firebase Authentication
      let authUser: any;
      try {
        authUser = await loginWithEmail(targetEmail, pass);
      } catch (authErr: any) {
        // Fallback: Check if owner assigned a temporary/new password stored in member record
        if (resolvedIdentity?.memberId && (authErr?.code === 'auth/invalid-credential' || authErr?.code === 'auth/wrong-password')) {
          try {
            const bId = resolvedIdentity.businessId || 'biz_prince_pavbhaji_01';
            const mSnap = await getDoc(doc(db, 'businesses', bId, 'members', resolvedIdentity.memberId));
            if (mSnap.exists()) {
              const mData = mSnap.data() as any;
              if (mData.temporaryPassword && mData.temporaryPassword === pass) {
                // Password matches owner-reset password! Re-create/sync Firebase Auth user
                try {
                  const secondaryApp = initializeApp(firebaseConfig, `temp_sync_${Date.now()}`);
                  try {
                    const secondaryAuth = getAuth(secondaryApp);
                    try {
                      const uCred = await createUserWithEmailAndPassword(secondaryAuth, targetEmail, pass);
                      authUser = uCred.user;
                    } catch {
                      // Already exists, attempt update if possible
                    }
                  } finally {
                    await deleteApp(secondaryApp);
                  }
                  authUser = await loginWithEmail(targetEmail, pass);
                } catch {}
              }
            }
          } catch {}
        }

        if (!authUser) {
          const code = authErr?.code || '';
          if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
            throw new Error('Incorrect Login ID / Email or password.');
          } else if (code === 'auth/user-disabled') {
            throw new Error('Your account has been suspended. Contact support.');
          } else if (code === 'auth/too-many-requests') {
            throw new Error('Too many login attempts. Please try again later.');
          } else if (code === 'auth/network-request-failed') {
            throw new Error('Authentication service temporarily unavailable.');
          } else {
            throw new Error(authErr.message || 'Incorrect Login ID or password.');
          }
        }
      }

      // 3. Super Admin Verification
      const isSuper = 
        targetEmail === 'superadmin@foodpos.app' || 
        targetEmail === 'admin@foodpos.app' || 
        resolvedIdentity?.role === 'SUPER_ADMIN';

      if (isSuper) {
        localStorage.setItem('food_pos_is_super_admin', 'true');
        localStorage.removeItem('food_pos_staff_session');
        localStorage.removeItem('food_pos_active_shop_id');
        setUser({
          uid: authUser.uid,
          email: targetEmail,
          displayName: 'Super Administrator',
          isAnonymous: false,
          emailVerified: true,
        });
        setIsSuperAdmin(true);
        setUserRole('SUPER_ADMIN');
        setCanCollectPayment(true);
        setProfile(null);
        return 'SUPER_ADMIN';
      }

      // 4. Shop Owner Verification from Database
      let targetBiz = await findBusinessForUser(authUser.uid, targetEmail);
      if (!targetBiz && resolvedIdentity?.businessId) {
        targetBiz = await getBusinessProfile(resolvedIdentity.businessId);
      }

      // If business found or resolved as OWNER
      if (targetBiz && (resolvedIdentity?.role === 'OWNER' || !resolvedIdentity)) {
        if (targetBiz.status === 'SUSPENDED' || (targetBiz as any).isArchived) {
          await logoutUser();
          throw new Error('Your account has been suspended. Contact support.');
        }

        localStorage.removeItem('food_pos_is_super_admin');
        localStorage.removeItem('food_pos_staff_session');
        localStorage.setItem('food_pos_active_shop_id', targetBiz.id);
        setUser({
          uid: authUser.uid,
          email: targetEmail,
          displayName: targetBiz.name || 'Shop Owner',
          isAnonymous: false,
          emailVerified: true,
        });
        setIsSuperAdmin(false);
        setUserRole('OWNER');
        setCanCollectPayment(true);
        await loadShopContext(targetBiz.id);
        return 'OWNER';
      }

      // 5. Staff Member Verification (Manager / Cashier / Cook / Kitchen / Custom)
      if (resolvedIdentity && (
        resolvedIdentity.role === 'CASHIER' || 
        resolvedIdentity.role === 'MANAGER' || 
        resolvedIdentity.role === 'KITCHEN' || 
        resolvedIdentity.role === 'CUSTOM'
      )) {
        setUser({
          uid: authUser.uid,
          email: targetEmail,
          displayName: currentMember?.name || resolvedIdentity.name || resolvedIdentity.loginId,
          isAnonymous: false,
          emailVerified: true,
        });
        setIsSuperAdmin(false);
        setIsMemberDeactivated(false);
        return resolvedIdentity.role;
      }

      // 6. Check if email-based staff
      const staffByEmail = 
        targetEmail.includes('cook') || targetEmail.includes('chef') ? 'KITCHEN' :
        targetEmail.includes('cashier') ? 'CASHIER' : 
        targetEmail.includes('manager') ? 'MANAGER' : null;
      if (staffByEmail && targetBiz) {
        localStorage.removeItem('food_pos_is_super_admin');
        localStorage.setItem(
          'food_pos_staff_session',
          JSON.stringify({
            loginId: targetEmail.split('@')[0],
            businessId: targetBiz.id,
            role: staffByEmail,
            canCollectPayment: true,
          })
        );
        localStorage.setItem('food_pos_active_shop_id', targetBiz.id);
        setUser({
          uid: authUser.uid,
          email: targetEmail,
          displayName: targetEmail.split('@')[0],
          isAnonymous: false,
          emailVerified: true,
        });
        setIsSuperAdmin(false);
        setUserRole(staffByEmail);
        setCanCollectPayment(true);
        await loadShopContext(targetBiz.id);
        return staffByEmail;
      }

      // 7. No shop association found
      await logoutUser();
      throw new Error('Your account is not associated with an active shop. Contact your Super Admin.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Dedicated Super Admin Login: accepts superadmin email or login ID
   */
  const superAdminLogin = async (identifier: string, pass: string) => {
    const role = await login(identifier, pass);
    if (role !== 'SUPER_ADMIN') {
      await logout();
      throw new Error('Unauthorized. This portal is restricted to Platform Super Admin accounts.');
    }
  };

  const signup = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signupWithEmail(email, pass);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    localStorage.removeItem('food_pos_demo_user');
    localStorage.removeItem('food_pos_is_super_admin');
    localStorage.removeItem('food_pos_staff_session');
    localStorage.removeItem('food_pos_active_shop_id');
    await clearLocalShopCache();
    await logoutUser();
    setUser(null);
    setProfile(null);
    setCurrentMember(null);
    setIsSuperAdmin(false);
    setIsMemberDeactivated(false);
    setUserRole('OWNER');
    setCanCollectPayment(true);
    setLoading(false);
  };

  const demoLogin = async () => {
    setLoading(true);
    const demoId = 'demo-business-owner-101';
    const demoUser: AuthUser = {
      uid: demoId,
      email: 'owner@foodpos.app',
      displayName: 'Chef Jenish',
      isAnonymous: false,
      emailVerified: true,
    };
    localStorage.removeItem('food_pos_is_super_admin');
    localStorage.removeItem('food_pos_staff_session');
    localStorage.setItem('food_pos_demo_user', JSON.stringify({ user: demoUser }));
    setUser(demoUser);
    setIsSuperAdmin(false);
    setUserRole('OWNER');
    setCanCollectPayment(true);

    let prof = await getBusinessProfile(demoId);
    if (!prof) {
      prof = {
        id: demoId,
        name: 'The Royal Bistro & Cafe',
        ownerName: 'Jenish Kanani',
        ownerEmail: 'owner@foodpos.app',
        phone: '9876543210',
        category: 'cafe',
        address: '506 Sahajanand Trade Center, Opp. High Court, Ahmedabad',
        currency: 'INR',
        currencySymbol: '₹',
        status: 'ACTIVE',
        plan: 'pro',
        planExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        isDemo: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveBusinessProfile(prof);
      await saveBusinessSettings(demoId, DEFAULT_BUSINESS_SETTINGS);
    }
    setProfile(prof);
    setSettings(DEFAULT_BUSINESS_SETTINGS);
    const feat = await getBusinessFeatures(demoId);
    setFeatures(feat);
    setLoading(false);
  };

  const switchShop = async (businessId: string) => {
    setLoading(true);
    try {
      await loadShopContext(businessId);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async (
    profileData: Omit<BusinessProfile, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'plan'>,
    initialSettings?: Partial<BusinessSettings>
  ) => {
    if (!user) throw new Error('Must be logged in to onboard business');
    const now = new Date().toISOString();
    const newProfile: BusinessProfile = {
      ...profileData,
      id: user.uid,
      status: 'ACTIVE',
      plan: 'trial',
      planExpiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      currency: profileData.currency || 'INR',
      currencySymbol: '₹',
      createdAt: now,
      updatedAt: now,
    };
    await saveBusinessProfile(newProfile);

    const mergedSettings: BusinessSettings = {
      ...DEFAULT_BUSINESS_SETTINGS,
      ...initialSettings,
      tax: {
        ...DEFAULT_BUSINESS_SETTINGS.tax,
        ...(initialSettings?.tax || {}),
      },
    };
    await saveBusinessSettings(user.uid, mergedSettings);

    setProfile(newProfile);
    setSettings(mergedSettings);
    const feat = await getBusinessFeatures(user.uid);
    setFeatures(feat);
  };

  const updateProfile = async (updates: Partial<BusinessProfile>) => {
    if (!profile) return;
    const updated: BusinessProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await saveBusinessProfile(updated);
    setProfile(updated);
  };

  const updateSettings = async (updates: Partial<BusinessSettings>) => {
    if (!user) return;
    const updated: BusinessSettings = {
      ...settings,
      ...updates,
      tax: {
        ...settings.tax,
        ...(updates.tax || {}),
      },
      receipt: {
        ...settings.receipt,
        ...(updates.receipt || {}),
      },
      billing: {
        ...settings.billing,
        ...(updates.billing || {}),
      },
    };
    await saveBusinessSettings(user.uid, updated);
    setSettings(updated);
  };

  const isShopSuspended = profile?.status === 'SUSPENDED';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        currentMember,
        settings,
        features,
        loading,
        isOnboarded: !!profile,
        isSuperAdmin,
        isShopSuspended,
        isMemberDeactivated,
        userRole,
        canCollectPayment,
        hasPermission,
        hasNavAccess,
        login,
        signup,
        logout,
        completeOnboarding,
        updateProfile,
        updateSettings,
        demoLogin,
        superAdminLogin,
        refreshFeatures,
        switchShop,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
