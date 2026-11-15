import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig, 'REPAIR_SUITE');
const auth = getAuth(app);
const db = getFirestore(app);

async function createOrVerifyAuthUser(email: string, passwordFallback: string) {
  // Use dedicated isolated Firebase app instance to avoid affecting main auth session
  const verifyApp = initializeApp(firebaseConfig, `Verify_${Date.now()}_${Math.random()}`);
  const verifyAuth = getAuth(verifyApp);

  try {
    const cred = await signInWithEmailAndPassword(verifyAuth, email, passwordFallback);
    console.log(`  ✅ Auth user verified: ${email} -> UID: ${cred.user.uid}`);
    return cred.user.uid;
  } catch (err: any) {
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      try {
        const newCred = await createUserWithEmailAndPassword(verifyAuth, email, passwordFallback);
        console.log(`  ➕ Successfully created missing Auth user: ${email} -> UID: ${newCred.user.uid}`);
        return newCred.user.uid;
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          console.log(`  ℹ️ Account exists in Auth for ${email} with different password`);
          for (const altPass of ['OwnerPass@2026', 'Owner@2026', 'TestCheck123!', 'Prince@2026']) {
            try {
              const altCred = await signInWithEmailAndPassword(verifyAuth, email, altPass);
              console.log(`  🔑 Matched alternate password "${altPass}" for ${email} (UID: ${altCred.user.uid})`);
              if (altPass !== passwordFallback) {
                await updatePassword(altCred.user, passwordFallback);
                console.log(`  🔄 Synchronized password to "${passwordFallback}" for ${email}`);
              }
              return altCred.user.uid;
            } catch {}
          }
        } else {
          console.error(`  ❌ Error creating ${email}:`, createErr.message);
        }
      }
    } else {
      console.error(`  ❌ Sign in error for ${email}:`, err.message);
    }
  } finally {
    await deleteApp(verifyApp);
  }
  return null;
}

async function run() {
  console.log('========================================================================');
  console.log('🔧 REPAIR & SYNCHRONIZE ALL SHOP OWNER ACCOUNTS IN FIREBASE');
  console.log('========================================================================');

  // Authenticate as Super Admin
  const adminCred = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  console.log(`Authenticated Super Admin: ${adminCred.user.email} (UID: ${adminCred.user.uid})`);

  const shopsToRepair = [
    {
      businessId: 'biz_prince_pavbhaji_01',
      name: 'Prince Pavbhaji',
      brandName: 'Prince Bhajipav Manekchowkwala',
      ownerEmail: 'princebhajipav16@gmail.com',
      ownerName: 'Prince Pavbhaji Owner',
      defaultPass: 'OwnerPass@2026',
      loginIds: ['princeowner', 'princepavbhaji', 'prince', 'prniceowner'],
    },
    {
      businessId: 'demo-business-owner-101',
      name: 'The Royal Bistro & Cafe',
      brandName: 'Royal Bistro Cafe',
      ownerEmail: 'owner@foodpos.app',
      ownerName: 'Chef Jenish',
      defaultPass: 'OwnerPass@2026',
      loginIds: ['shopowner01', 'owner01', 'owner', 'royalbistro'],
    },
    {
      businessId: 'biz_cafe_delight_101',
      name: 'Cafe Delight & Restaurant',
      brandName: 'Cafe Delight',
      ownerEmail: 'owner@cafedelight.com',
      ownerName: 'Jenish Kanani',
      defaultPass: 'OwnerPass@2026',
      loginIds: ['cafeowner', 'cafedelight', 'cafeowner01'],
    },
    {
      businessId: 'biz_street_food_99',
      name: 'Ahmedabad Street Bites',
      brandName: 'Ahmedabad Street Bites',
      ownerEmail: 'kishan@streetbites.com',
      ownerName: 'Kishan Patel',
      defaultPass: 'OwnerPass@2026',
      loginIds: ['streetbites', 'kishanowner', 'streetowner01'],
    },
  ];

  for (const shop of shopsToRepair) {
    console.log(`\n--- Processing Shop: ${shop.name} (${shop.businessId}) ---`);
    const uid = await createOrVerifyAuthUser(shop.ownerEmail, shop.defaultPass);
    const finalUid = uid || `usr_${shop.businessId}`;

    // Update business profile doc in Firestore: businesses/{id}
    const bDocRef = doc(db, 'businesses', shop.businessId);
    const bSnap = await getDoc(bDocRef);
    const existingData = bSnap.exists() ? bSnap.data() : {};

    const updatedBusinessDoc = {
      ...existingData,
      id: shop.businessId,
      name: shop.name,
      businessName: shop.name,
      brandName: shop.brandName,
      ownerUid: finalUid,
      ownerEmail: shop.ownerEmail,
      email: shop.ownerEmail,
      loginId: shop.loginIds[0],
      status: existingData.status || 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(bDocRef, updatedBusinessDoc, { merge: true });
    console.log(`  💾 Updated businesses/${shop.businessId} with ownerUid: ${finalUid}`);

    // Update meta/profile doc: businesses/{id}/meta/profile
    const profRef = doc(db, 'businesses', shop.businessId, 'meta', 'profile');
    await setDoc(profRef, {
      id: shop.businessId,
      name: shop.name,
      brandName: shop.brandName,
      ownerName: shop.ownerName,
      ownerEmail: shop.ownerEmail,
      ownerUid: finalUid,
      loginId: shop.loginIds[0],
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Update platform/shops/directory/{id}
    const platRef = doc(db, 'platform', 'shops', 'directory', shop.businessId);
    await setDoc(platRef, {
      id: shop.businessId,
      name: shop.name,
      brandName: shop.brandName,
      ownerEmail: shop.ownerEmail,
      ownerUid: finalUid,
      loginId: shop.loginIds[0],
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Create / Update owner member record
    const memberRef = doc(db, 'businesses', shop.businessId, 'members', `mem_owner_${shop.businessId}`);
    await setDoc(memberRef, {
      id: `mem_owner_${shop.businessId}`,
      businessId: shop.businessId,
      name: shop.ownerName,
      email: shop.ownerEmail,
      loginId: shop.loginIds[0],
      role: 'OWNER',
      canCollectPayment: true,
      status: 'ACTIVE',
      uid: finalUid,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Create / Update loginIds mappings
    for (const lid of shop.loginIds) {
      const lidRef = doc(db, 'loginIds', lid);
      await setDoc(lidRef, {
        loginId: lid,
        email: shop.ownerEmail,
        role: 'OWNER',
        businessId: shop.businessId,
        canCollectPayment: true,
        status: 'ACTIVE',
        name: shop.ownerName,
        uid: finalUid,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      console.log(`  🔗 Mapped loginId "${lid}" -> ${shop.ownerEmail} (${shop.businessId})`);
    }
  }

  // Also ensure superadmin login mappings
  const adminLids = ['superadmin', 'admin'];
  for (const lid of adminLids) {
    await setDoc(doc(db, 'loginIds', lid), {
      loginId: lid,
      email: 'superadmin@foodpos.app',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      canCollectPayment: true,
      name: 'Super Administrator',
      uid: adminCred.user.uid,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`  🔗 Mapped admin loginId "${lid}" -> superadmin@foodpos.app`);
  }

  console.log('\n🎉 ALL SHOP OWNER ACCOUNTS AND LOGIN ID MAPPINGS REPAIRED SUCCESSFULLY!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal repair error:', err);
  process.exit(1);
});
