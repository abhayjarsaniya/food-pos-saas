import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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
};

const app = initializeApp(firebaseConfig, 'CHECK_COLLECTIONS');
const auth = getAuth(app);
const db = getFirestore(app);

async function check() {
  await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  console.log('Superadmin authenticated');

  const adminSnap = await getDocs(collection(db, 'platform', 'admins', 'users'));
  console.log('platform/admins/users count:', adminSnap.size);
  adminSnap.docs.forEach(d => console.log('  Admin user:', d.id, d.data()));

  const shopsDirSnap = await getDocs(collection(db, 'platform', 'shops', 'directory'));
  console.log('platform/shops/directory count:', shopsDirSnap.size);
  shopsDirSnap.docs.forEach(d => console.log('  Shop dir:', d.id, d.data().name, d.data().ownerEmail));

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log('users collection count:', usersSnap.size);
    usersSnap.docs.forEach(d => console.log('  User:', d.id, d.data()));
  } catch (e: any) {
    console.log('users collection error:', e.message);
  }
}

check().catch(console.error);
