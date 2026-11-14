import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig, 'CHECK_APP');
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  console.log('Super Admin logged in');

  const snap = await getDocs(collection(db, 'businesses'));
  console.log('Total businesses found:', snap.size);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`- [${d.id}] ${data.businessName || data.name} (${data.email || data.ownerEmail})`);
  });

  // Check if princebhajipav16@gmail.com can be authenticated or if it already exists in auth
  const tempApp = initializeApp(firebaseConfig, `TEMP_${Date.now()}`);
  const tempAuth = getAuth(tempApp);
  try {
    await createUserWithEmailAndPassword(tempAuth, 'princebhajipav16@gmail.com', 'TestCheck123!');
    console.log('princebhajipav16@gmail.com did NOT exist in Auth (newly registered for check, we can use it or reconfigure)');
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('princebhajipav16@gmail.com ALREADY EXISTS in Firebase Auth!');
    } else {
      console.log('Auth check response:', err.code, err.message);
    }
  } finally {
    await deleteApp(tempApp);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
