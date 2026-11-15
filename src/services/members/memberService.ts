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
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../firebase/config';
import { BusinessMember, UserRole } from '../../types';

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
  loginId: string; // e.g. "cashier01", "counter02"
  email?: string;
  role: UserRole;
  password?: string;
  canCollectPayment?: boolean;
}

export interface ResolvedStaffIdentity {
  loginId: string;
  email: string;
  name?: string;
  businessId?: string;
  memberId?: string;
  role: UserRole;
  canCollectPayment?: boolean;
  status: 'ACTIVE' | 'DEACTIVATED' | 'INVITED' | 'SUSPENDED';
}

const STATIC_LOGIN_IDENTITIES: Record<string, ResolvedStaffIdentity> = {
  superadmin: {
    loginId: 'superadmin',
    email: 'superadmin@foodpos.app',
    role: 'SUPER_ADMIN',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  shopowner01: {
    loginId: 'shopowner01',
    email: 'owner@foodpos.app',
    businessId: 'demo-business-owner-101',
    role: 'OWNER',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  cashier01: {
    loginId: 'cashier01',
    email: 'cashier01@royalbistro.foodpos.app',
    businessId: 'demo-business-owner-101',
    memberId: 'mem_cashier_01',
    role: 'CASHIER',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  manager01: {
    loginId: 'manager01',
    email: 'manager01@royalbistro.foodpos.app',
    businessId: 'demo-business-owner-101',
    memberId: 'mem_manager_01',
    role: 'MANAGER',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  counter02: {
    loginId: 'counter02',
    email: 'counter02@royalbistro.foodpos.app',
    businessId: 'demo-business-owner-101',
    memberId: 'mem_cashier_02',
    role: 'CASHIER',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  princeowner: {
    loginId: 'princeowner',
    email: 'princebhajipav16@gmail.com',
    businessId: 'biz_prince_pavbhaji_01',
    role: 'OWNER',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  princepavbhaji: {
    loginId: 'princepavbhaji',
    email: 'princebhajipav16@gmail.com',
    businessId: 'biz_prince_pavbhaji_01',
    role: 'OWNER',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
  princecashier: {
    loginId: 'princecashier',
    email: 'cashier01@royalbistro.foodpos.app',
    businessId: 'biz_prince_pavbhaji_01',
    memberId: 'mem_prince_cashier_01',
    role: 'CASHIER',
    canCollectPayment: true,
    status: 'ACTIVE',
  },
};

/**
 * Resolves a staff or admin Login ID (e.g. "cashier01", "superadmin", "shopowner01")
 * to its authenticated email and permissions
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
    role: 'OWNER',
    canCollectPayment: true,
    status: 'ACTIVE',
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
    throw new Error('Login ID must be 3-20 characters long and contain only letters, numbers, and underscores (e.g. cashier01).');
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
    // If account already exists in Firebase Auth, proceed using generated UID
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
    role: params.role,
    canCollectPayment: params.role === 'CASHIER' ? !!params.canCollectPayment : true,
    status: 'ACTIVE',
    invitedAt: now,
    joinedAt: now,
  };

  const resolvedIdentity: ResolvedStaffIdentity = {
    loginId: cleanLoginId,
    email: targetEmail,
    businessId,
    memberId: memberUid,
    role: params.role,
    canCollectPayment: newMember.canCollectPayment,
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

  return newMember;
}

/**
 * Update member details, role, status or permissions
 */
export async function updateMember(
  businessId: string,
  memberId: string,
  updates: Partial<BusinessMember>
): Promise<BusinessMember> {
  const local = getLocalMembers(businessId);
  const idx = local.findIndex((m) => m.id === memberId);
  if (idx === -1) throw new Error('Member not found');

  const updated: BusinessMember = {
    ...local[idx],
    ...updates,
  };

  local[idx] = updated;
  saveLocalMembers(businessId, local);

  // Update loginIds index if loginId exists
  if (updated.loginId) {
    try {
      const cleanLoginId = updated.loginId.toLowerCase();
      const loginIdRef = doc(db, 'loginIds', cleanLoginId);
      const identityUpdates: Partial<ResolvedStaffIdentity> = {};
      if (updates.status) identityUpdates.status = updates.status;
      if (updates.role) identityUpdates.role = updates.role;
      if (updates.canCollectPayment !== undefined) identityUpdates.canCollectPayment = updates.canCollectPayment;

      await withTimeout(updateDoc(loginIdRef, identityUpdates), 2000);
      localStorage.setItem(`food_pos_login_id_${cleanLoginId}`, JSON.stringify({
        ...updated,
        loginId: cleanLoginId,
      }));
    } catch {}
  }

  try {
    const docRef = doc(db, 'businesses', businessId, 'members', memberId);
    await withTimeout(updateDoc(docRef, { ...updates }), 2000);
  } catch (err) {
    console.warn('Could not update member in cloud:', err);
  }

  return updated;
}

/**
 * Delete a team member
 */
export async function deleteMember(businessId: string, memberId: string): Promise<void> {
  const local = getLocalMembers(businessId);
  const target = local.find(m => m.id === memberId);
  const filtered = local.filter((m) => m.id !== memberId);
  saveLocalMembers(businessId, filtered);

  if (target?.loginId) {
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
}
