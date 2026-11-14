import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import * as fs from 'fs';
import { STARTER_TABLES } from '../src/services/tables/tableService';

// Read .env
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

const app = initializeApp(firebaseConfig, 'TABLE_SEEDER');
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  console.log('🚀 Starting Custom Table Seeding & Migration...');
  console.log(`Connecting to Firestore Project: ${firebaseConfig.projectId}`);

  // 1. Authenticate
  console.log('🔑 Authenticating as Super Admin...');
  const userCred = await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  console.log(`✅ Authenticated UID: ${userCred.user.uid}`);

  const targetBusinesses = ['demo-business-owner-101', 'biz_cafe_delight_101'];

  for (const bId of targetBusinesses) {
    console.log(`\n======================================================`);
    console.log(`🏢 Processing Business: ${bId}`);
    console.log(`======================================================`);

    const tablesColRef = collection(db, 'businesses', bId, 'tables');
    const existingTablesSnap = await getDocs(tablesColRef);
    console.log(`Found ${existingTablesSnap.size} existing tables in Firestore.`);

    const seededMap = new Map<string, string>(); // Name (lowercase) -> tableId

    if (existingTablesSnap.empty) {
      console.log('Seeding initial custom tables...');
      const now = new Date().toISOString();
      for (let i = 0; i < STARTER_TABLES.length; i++) {
        const item = STARTER_TABLES[i];
        const tableId = `tbl_${bId}_${i + 1}`;
        const tableRecord = {
          ...item,
          id: tableId,
          businessId: bId,
          createdAt: now,
          updatedAt: now,
          createdBy: userCred.user.uid,
        };
        await setDoc(doc(db, 'businesses', bId, 'tables', tableId), tableRecord);
        seededMap.set(item.name.toLowerCase().trim(), tableId);
        console.log(`  ➕ Seeded Table: ${item.name} (${tableId})`);
      }
    } else {
      existingTablesSnap.forEach(d => {
        const data = d.data();
        if (data.name) {
          seededMap.set(data.name.toLowerCase().trim(), d.id);
        }
      });
      console.log(`Loaded ${seededMap.size} existing table mappings.`);
    }

    // 2. Link historical orders to tables
    console.log('\n🔍 Auditing historical orders for table linking...');
    const ordersColRef = collection(db, 'businesses', bId, 'orders');
    const ordersSnap = await getDocs(ordersColRef);
    let linkedOrders = 0;

    for (const orderDoc of ordersSnap.docs) {
      const orderData = orderDoc.data();
      const currentTableNum = orderData.tableNumber?.trim() || '';
      const currentTableName = orderData.tableName?.trim() || '';
      const currentTableId = orderData.tableId;

      // If missing tableId or tableName but has tableNumber
      const nameKey = (currentTableNum || currentTableName).toLowerCase();
      if ((!currentTableId || !currentTableName) && nameKey && seededMap.has(nameKey)) {
        const matchedTableId = seededMap.get(nameKey);
        await updateDoc(doc(db, 'businesses', bId, 'orders', orderDoc.id), {
          tableId: matchedTableId,
          tableName: currentTableName || currentTableNum,
          updatedAt: new Date().toISOString(),
        });
        linkedOrders++;
      }
    }

    console.log(`✅ Completed for ${bId}: linked ${linkedOrders} orders to custom tables.`);
  }

  console.log('\n🎉 Table seeding and order linking completed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Table seeding failed:', err);
  process.exit(1);
});
