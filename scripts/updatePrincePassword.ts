import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig, 'PASS_UPDATE_APP');
const auth = getAuth(app);

async function run() {
  console.log('Connecting to Firebase Auth...');
  try {
    const cred = await signInWithEmailAndPassword(auth, 'princebhajipav16@gmail.com', 'TestCheck123!');
    console.log('Signed in with TestCheck123!, UID:', cred.user.uid);
    await updatePassword(cred.user, 'OwnerPass@2026');
    console.log('✅ Password successfully changed to OwnerPass@2026');
  } catch (err: any) {
    console.log('Could not sign in with TestCheck123!:', err.message);
    const cred = await signInWithEmailAndPassword(auth, 'princebhajipav16@gmail.com', 'OwnerPass@2026');
    console.log('✅ Already signed in with OwnerPass@2026! UID:', cred.user.uid);
  }
}

run().then(() => process.exit(0)).catch(e => {
  console.error('Crash:', e);
  process.exit(1);
});
