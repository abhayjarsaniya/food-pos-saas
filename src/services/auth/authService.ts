import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  User
} from 'firebase/auth';
import { auth } from '../firebase/config';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  emailVerified: boolean;
}

export function subscribeToAuth(callback: (user: AuthUser | null) => void) {
  return onAuthStateChanged(auth, (fbUser: User | null) => {
    if (fbUser) {
      callback({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        isAnonymous: fbUser.isAnonymous,
        emailVerified: fbUser.emailVerified,
      });
    } else {
      callback(null);
    }
  });
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

export async function signupWithEmail(email: string, pass: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  try {
    await sendEmailVerification(cred.user);
  } catch (err) {
    console.warn('Could not dispatch verification email immediately:', err);
  }
  return cred.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function sendVerificationEmail(user?: User): Promise<void> {
  const target = user || auth.currentUser;
  if (target) {
    await sendEmailVerification(target);
  }
}

export async function logoutUser(): Promise<void> {
  await fbSignOut(auth);
}
