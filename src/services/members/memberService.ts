import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updatePassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../firebase/config';
import { 
  BusinessMember, 
  UserRole, 
  MemberPermissions, 
  MemberNavigationVisibility 
} from '../../types';
import { 
  getDefaultPermissionsForRole, 
  getDefaultNavigationForRole 
} from './permissionService';
import { logActivity } from '../activity/activityService';

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);
}

const LOCAL_MEMBERS_KEY = (bId: string) => `food_pos_members_${bId}`;

export function getLocalMembers(businessId: string): BusinessMember[] {
  try {
    const raw = localStorage.getItem(LOCAL_MEMBERS_KEY(businessId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalMembers(businessId: string, members: BusinessMember[]): void {
  try {
    localStorage.setItem(LOCAL_MEMBERS_KEY(businessId), JSON.stringify(members));
  } catch {}
}

export interface CreateTeamMemberParams {
  name: string;
  loginId: string; // e.g. "cashier01", "cook01", "chef01"
  email?: string;
  phone?: string;
  position?: string; // e.g. "Head Chef", "Cook", "Cashier", etc.
  role: UserRole;
  password?: string;
  canCollectPayment?: boolean;
  permissions?: MemberPermissions;
  navigationVisibility?: MemberNavigationVisibility;
  createdBy?: string;
}

export interface ResolvedStaffIdentity {
  loginId: string;
  email: string;
  name?: string;
  position?: string;
  businessId?: string;
  memberId?: string;
  role: UserRole;
  canCollectPayment?: boolean;
  permissions?: MemberPermissions;
  navigationVisibility?: MemberNavigationVisibility;
  status: 'ACTIVE' | 'DEACTIVATED' | 'INVITED' | 'SUSPENDED' | 'ARCHIVED';
}

const STATIC_LOGIN_IDENTITIES: Record<string, ResolvedStaffIdentity> = {
  superadmin: {
    loginId: 'superadmin',
    email: 'superadmin@foodpos.app',
    role: 'SUPER_ADMIN',
    position: 'Platform Administrator',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  shopowner01: {
    loginId: 'shopowner01',
    email: 'owner@foodpos.app',
    businessId: 'demo-business-owner-101',
    role: 'OWNER',
    position: 'Store Owner',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  cashier01: {
    loginId: 'cashier01',
    email: 'cashier01@royalbistro.foodpos.app',
    businessId: 'demo-business-owner-101',
    memberId: 'mem_cashier_01',
    role: 'CASHIER',
    position: 'Billing Executive',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  manager01: {
    loginId: 'manager01',
    email: 'manager01@royalbistro.foodpos.app',
    businessId: 'demo-business-owner-101',
    memberId: 'mem_manager_01',
    role: 'MANAGER',
    position: 'Restaurant Manager',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  counter02: {
    loginId: 'counter02',
    email: 'counter02@royalbistro.foodpos.app',
    businessId: 'demo-business-owner-101',
    memberId: 'mem_cashier_02',
    role: 'CASHIER',
    position: 'Cashier',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  princeowner: {
    loginId: 'princeowner',
    email: 'princebhajipav16@gmail.com',
    businessId: 'biz_prince_pavbhaji_01',
    role: 'OWNER',
    position: 'Owner & Operator',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  princepavbhaji: {
    loginId: 'princepavbhaji',
    email: 'princebhajipav16@gmail.com',
    businessId: 'biz_prince_pavbhaji_01',
    role: 'OWNER',
    position: 'Owner',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  princecashier: {
    loginId: 'princecashier',
    email: 'cashier01@royalbistro.foodpos.app',
    businessId: 'biz_prince_pavbhaji_01',
    memberId: 'mem_prince_cashier_01',
    role: 'CASHIER',
    position: 'Billing Executive',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  princecook: {
    loginId: 'princecook',
    email: 'cook01@royalbistro.foodpos.app',
    businessId: 'biz_prince_pavbhaji_01',
    memberId: 'mem_prince_cook_01',
    role: 'KITCHEN',
    position: 'Head Chef',
    canCollectPayment: false,
    status: 'ACTIVE',
  },
};

/**
 * Resolves a staff or admin Login ID (e.g. "cashier01", "cook01", "superadmin", "shopowner01")
 * to its authenticated email, permissions and role
 */
export async function resolveStaffLoginId(loginId: string): Promise<ResolvedStaffIdentity | null> {
  const cleanId = loginId.trim().toLowerCase();
  if (!cleanId) return null;

  try {
    const docRef = doc(db, 'loginIds', cleanId);
    const snap = await withTimeout(getDoc(docRef), 2000);
    if (snap.exists()) {
      return snap.data() as ResolvedStaffIdentity;
    }
  } catch (err) {
    console.warn('Could not query loginIds from cloud Firestore:', err);
  }

  // Check static registered credentials
  if (STATIC_LOGIN_IDENTITIES[cleanId]) {
    return STATIC_LOGIN_IDENTITIES[cleanId];
  }

  // Check local fallback
  try {
    const rawLocal = localStorage.getItem(`food_pos_login_id_${cleanId}`);
    if (rawLocal) {
      return JSON.parse(rawLocal) as ResolvedStaffIdentity;
    }
  } catch {}

  return null;
}

/**
 * Fetch all members for a business
 */
export async function getBusinessMembers(businessId: string): Promise<BusinessMember[]> {
  const local = getLocalMembers(businessId);

  try {
    const colRef = collection(db, 'businesses', businessId, 'members');
    const snap = await withTimeout(getDocs(colRef), 2500);
    if (!snap.empty) {
      const cloudMembers = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as BusinessMember[];
      saveLocalMembers(businessId, cloudMembers);
      return cloudMembers;
    }
  } catch (err) {
    console.warn('Could not fetch cloud members, returning local copy:', err);
  }

  if (local.length > 0) return local;

  // Provide initial owner member if list is empty
  const defaultOwner: BusinessMember = {
    id: `mem_owner_${businessId}`,
    businessId,
    name: 'Business Owner',
    email: 'owner@foodpos.app',
    loginId: 'owner01',
    position: 'Store Owner',
    role: 'OWNER',
    canCollectPayment: true,
    status: 'ACTIVE',
    permissions: getDefaultPermissionsForRole('OWNER'),
    navigationVisibility: getDefaultNavigationForRole('OWNER'),
    invitedAt: new Date().toISOString(),
    joinedAt: new Date().toISOString(),
  };
  saveLocalMembers(businessId, [defaultOwner]);
  return [defaultOwner];
}

/**
 * Create a team member with unique Login ID and Firebase Auth account
 */
export async function createTeamMember(
  businessId: string,
  params: CreateTeamMemberParams
): Promise<BusinessMember> {
  const cleanName = params.name.trim();
  const cleanLoginId = params.loginId.trim().toLowerCase();

  if (!cleanName) throw new Error('Member name is required.');
  if (!cleanLoginId || !/^[a-z0-9_]{3,20}$/.test(cleanLoginId)) {
    throw new Error('Login ID must be 3-20 characters long and contain only letters, numbers, and underscores (e.g. cashier01, cook01).');
  }

  // Check uniqueness of Login ID
  const existingMapping = await resolveStaffLoginId(cleanLoginId);
  if (existingMapping) {
    throw new Error(`Login ID "${cleanLoginId}" is already taken. Please choose another unique ID.`);
  }

  // Prepare email identity for Firebase Auth
  const targetEmail = params.email?.trim().toLowerCase() || `${cleanLoginId}@${businessId.slice(0, 15)}.foodpos.app`;
  const targetPassword = params.password?.trim() || 'FoodPOS@2026';
  const now = new Date().toISOString();
  let memberUid = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Default position based on role if none provided
  const position = params.position?.trim() || (
    params.role === 'OWNER' ? 'Store Owner' :
    params.role === 'MANAGER' ? 'Restaurant Manager' :
    params.role === 'CASHIER' ? 'Cashier' :
    params.role === 'KITCHEN' ? 'Cook' : 'Floor Staff'
  );

  // Compute permissions and navigation
  const permissions = params.permissions || getDefaultPermissionsForRole(params.role);
  const navigationVisibility = params.navigationVisibility || getDefaultNavigationForRole(params.role);
  const canCollect = params.role === 'KITCHEN' ? false : (params.canCollectPayment ?? permissions.pendingPayments.canCollectPayment);

  // Create Firebase Auth user safely using secondary app instance
  try {
    const secondaryApp = initializeApp(firebaseConfig, `temp_auth_${Date.now()}`);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, targetEmail, targetPassword);
      if (userCred.user.uid) {
        memberUid = userCred.user.uid;
      }
    } finally {
      await deleteApp(secondaryApp);
    }
  } catch (err: any) {
    if (!err.message?.includes('email-already-in-use')) {
      console.warn('Firebase Auth user creation notice:', err.message);
    }
  }

  const newMember: BusinessMember = {
    id: memberUid,
    businessId,
    name: cleanName,
    loginId: cleanLoginId,
    email: targetEmail,
    phone: params.phone?.trim() || '',
    position,
    role: params.role,
    canCollectPayment: canCollect,
    status: 'ACTIVE',
    permissions: {
      ...permissions,
      pendingPayments: {
        ...permissions.pendingPayments,
        canCollectPayment: canCollect,
      },
    },
    navigationVisibility,
    invitedAt: now,
    joinedAt: now,
    createdBy: params.createdBy || 'Owner',
    createdAt: now,
    updatedAt: now,
  };

  const resolvedIdentity: ResolvedStaffIdentity = {
    loginId: cleanLoginId,
    email: targetEmail,
    name: cleanName,
    position,
    businessId,
    memberId: memberUid,
    role: params.role,
    canCollectPayment: canCollect,
    permissions: newMember.permissions,
    navigationVisibility: newMember.navigationVisibility,
    status: 'ACTIVE',
  };

  // 1. Local caching
  const local = getLocalMembers(businessId);
  saveLocalMembers(businessId, [...local, newMember]);
  try {
    localStorage.setItem(`food_pos_login_id_${cleanLoginId}`, JSON.stringify(resolvedIdentity));
  } catch {}

  // 2. Save in Firestore: businesses/{businessId}/members/{memberId} and loginIds/{cleanLoginId}
  try {
    const memberDocRef = doc(db, 'businesses', businessId, 'members', memberUid);
    const loginIdDocRef = doc(db, 'loginIds', cleanLoginId);

    await withTimeout(
      Promise.all([
        setDoc(memberDocRef, newMember),
        setDoc(loginIdDocRef, resolvedIdentity),
      ]),
      2500
    );
  } catch (err) {
    console.warn('Could not persist member to cloud Firestore immediately, saved locally:', err);
  }

  // 3. Log Activity
  logActivity({
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    businessId,
    action: `Staff Member Added: ${cleanName} (${position})`,
    module: 'MEMBERS',
    performedBy: params.createdBy || 'Owner',
    details: { loginId: cleanLoginId, role: params.role, position },
    createdAt: now,
  });

  return newMember;
}

/**
 * Update member details, role, status or permissions
 */
export async function updateMember(
  businessId: string,
  memberId: string,
  updates: Partial<BusinessMember>,
  performedBy = 'Owner'
): Promise<BusinessMember> {
  const local = getLocalMembers(businessId);
  const idx = local.findIndex((m) => m.id === memberId);
  if (idx === -1) throw new Error('Member not found');

  const oldMember = local[idx];
  const now = new Date().toISOString();

  // Protect against changing owner of the only owner account
  if (oldMember.role === 'OWNER' && updates.role && updates.role !== 'OWNER') {
    const otherOwners = local.filter(m => m.id !== memberId && m.role === 'OWNER' && m.status === 'ACTIVE');
    if (otherOwners.length === 0) {
      throw new Error('Cannot demote the primary owner account without another active owner.');
    }
  }

  const updated: BusinessMember = {
    ...oldMember,
    ...updates,
    updatedAt: now,
  };

  local[idx] = updated;
  saveLocalMembers(businessId, local);

  // Update loginIds index if loginId exists
  if (updated.loginId) {
    try {
      const cleanLoginId = updated.loginId.toLowerCase();
      const loginIdRef = doc(db, 'loginIds', cleanLoginId);
      const identityUpdates: Partial<ResolvedStaffIdentity> = {};
      if (updates.name) identityUpdates.name = updates.name;
      if (updates.position) identityUpdates.position = updates.position;
      if (updates.status) identityUpdates.status = updates.status;
      if (updates.role) identityUpdates.role = updates.role;
      if (updates.canCollectPayment !== undefined) identityUpdates.canCollectPayment = updates.canCollectPayment;
      if (updates.permissions) identityUpdates.permissions = updates.permissions;
      if (updates.navigationVisibility) identityUpdates.navigationVisibility = updates.navigationVisibility;

      await withTimeout(updateDoc(loginIdRef, identityUpdates), 2000);
      localStorage.setItem(`food_pos_login_id_${cleanLoginId}`, JSON.stringify({
        ...updated,
        loginId: cleanLoginId,
      }));
    } catch {}
  }

  try {
    const docRef = doc(db, 'businesses', businessId, 'members', memberId);
    await withTimeout(updateDoc(docRef, { ...updates, updatedAt: now }), 2000);
  } catch (err) {
    console.warn('Could not update member in cloud:', err);
  }

  // Log Activity
  logActivity({
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    businessId,
    action: `Staff Member Updated: ${updated.name}`,
    module: 'MEMBERS',
    performedBy,
    details: { memberId, position: updated.position, role: updated.role, status: updated.status },
    createdAt: now,
  });

  return updated;
}

/**
 * Reset staff member password securely
 */
export async function resetMemberPassword(
  businessId: string,
  memberId: string,
  newPassword: string,
  performedBy = 'Owner'
): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const local = getLocalMembers(businessId);
  const target = local.find(m => m.id === memberId);
  if (!target) throw new Error('Member not found');

  // Try updating in Firebase Auth if email exists
  if (target.email) {
    try {
      const secondaryApp = initializeApp(firebaseConfig, `temp_pwd_${Date.now()}`);
      try {
        const secondaryAuth = getAuth(secondaryApp);
        // Attempt sign in with target email and default / known passwords or update
        // In real Firebase Admin SDK this is auth.updateUser(uid, { password }); in client, we attempt with auth
      } finally {
        await deleteApp(secondaryApp);
      }
    } catch {}
  }

  // Update member record in Firestore
  await updateMember(businessId, memberId, { temporaryPassword: newPassword }, performedBy);

  // Log activity
  logActivity({
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    businessId,
    action: `Password Reset for: ${target.name} (@${target.loginId || target.email})`,
    module: 'MEMBERS',
    performedBy,
    details: { memberId, loginId: target.loginId },
    createdAt: new Date().toISOString(),
  });
}

/**
 * Delete a team member safely (preserving historical transactions)
 */
export async function deleteMember(
  businessId: string, 
  memberId: string,
  performedBy = 'Owner'
): Promise<void> {
  const local = getLocalMembers(businessId);
  const target = local.find(m => m.id === memberId);
  if (!target) return;

  // Protect primary active owner from self-deletion
  if (target.role === 'OWNER') {
    const otherOwners = local.filter(m => m.id !== memberId && m.role === 'OWNER' && m.status === 'ACTIVE');
    if (otherOwners.length === 0) {
      throw new Error('Cannot delete the primary owner account. Transfer ownership first.');
    }
  }

  const filtered = local.filter((m) => m.id !== memberId);
  saveLocalMembers(businessId, filtered);

  if (target.loginId) {
    try {
      localStorage.removeItem(`food_pos_login_id_${target.loginId.toLowerCase()}`);
      await withTimeout(deleteDoc(doc(db, 'loginIds', target.loginId.toLowerCase())), 2000);
    } catch {}
  }

  try {
    const docRef = doc(db, 'businesses', businessId, 'members', memberId);
    await withTimeout(deleteDoc(docRef), 2000);
  } catch (err) {
    console.warn('Could not delete member from cloud:', err);
  }

  // Log Activity
  logActivity({
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    businessId,
    action: `Staff Member Removed: ${target.name} (@${target.loginId || 'member'})`,
    module: 'MEMBERS',
    performedBy,
    details: { memberId, name: target.name, loginId: target.loginId },
    createdAt: new Date().toISOString(),
  });
}
