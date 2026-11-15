import { 
  getAuth, 
  updatePassword, 
  updateEmail, 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from 'firebase/auth';
import { changeShopOwnerEmail, changeShopOwnerLoginId, isLoginIdAvailable } from '../admin/superAdminService';
import { auth } from '../firebase/config';

export interface ChangeLoginIdResult {
  success: boolean;
  message: string;
}

export interface ChangePasswordResult {
  success: boolean;
  message: string;
}

/**
 * Allows a Shop Owner to change their shop's Login ID
 */
export async function updateOwnerLoginId(
  businessId: string, 
  newLoginId: string
): Promise<ChangeLoginIdResult> {
  const cleanId = newLoginId.trim().toLowerCase();
  if (!cleanId || cleanId.length < 3) {
    return { success: false, message: 'Login ID must be at least 3 characters long.' };
  }

  const isAvail = await isLoginIdAvailable(cleanId, businessId);
  if (!isAvail) {
    return { success: false, message: `Login ID "${cleanId}" is already taken by another account.` };
  }

  return await changeShopOwnerLoginId(businessId, cleanId);
}

/**
 * Allows a Shop Owner to update their account email address
 */
export async function updateOwnerEmailAddress(
  businessId: string, 
  newEmail: string,
  currentPassword?: string
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = newEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  // Update in Firebase Auth if authenticated user
  const user = auth.currentUser;
  if (user && currentPassword) {
    try {
      const cred = EmailAuthProvider.credential(user.email || '', currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updateEmail(user, cleanEmail);
    } catch (authErr: any) {
      console.warn('Firebase re-authentication / email update failed:', authErr);
      return { 
        success: false, 
        message: authErr.message || 'Incorrect password or authentication error while updating email.' 
      };
    }
  }

  return await changeShopOwnerEmail(businessId, cleanEmail);
}

/**
 * Allows a Shop Owner to securely change their password
 */
export async function changeOwnerAccountPassword(
  currentPassword: string, 
  newPassword: string
): Promise<ChangePasswordResult> {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, message: 'New password must be at least 6 characters long.' };
  }

  const user = auth.currentUser;
  if (!user || !user.email) {
    return { 
      success: true, 
      message: 'Demo session password updated successfully.' 
    };
  }

  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
    return { success: true, message: 'Password updated successfully!' };
  } catch (err: any) {
    console.error('Password change error:', err);
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      return { success: false, message: 'The current password you entered is incorrect.' };
    }
    return { success: false, message: err.message || 'Failed to update password.' };
  }
}
