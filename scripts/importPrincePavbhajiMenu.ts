import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, writeBatch } from 'firebase/firestore';
import * as fs from 'fs';
import { DEFAULT_BUSINESS_SETTINGS } from '../src/services/business/businessService';
import { DEFAULT_BUSINESS_FEATURES } from '../src/types';

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

const app = initializeApp(firebaseConfig, 'PRINCE_IMPORT');
const auth = getAuth(app);
const db = getFirestore(app);

const BUSINESS_ID = 'biz_prince_pavbhaji_01';
const OWNER_UID = 'uZ5vzv3LGwctK5o26yALxbriwDu2';
const OWNER_EMAIL = 'princebhajipav16@gmail.com';

interface RawCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

const CATEGORIES: RawCategory[] = [
  { id: 'cat_bhajipav', name: 'Bhajipav', slug: 'bhajipav', sortOrder: 1 },
  { id: 'cat_speciality', name: 'Speciality Dishes', slug: 'speciality-dishes', sortOrder: 2 },
  { id: 'cat_pulav', name: 'Pulav', slug: 'pulav', sortOrder: 3 },
  { id: 'cat_dosa', name: 'Dosa', slug: 'dosa', sortOrder: 4 },
  { id: 'cat_fancy_dosa', name: 'Fancy Dosa', slug: 'fancy-dosa', sortOrder: 5 },
  { id: 'cat_uttapam', name: 'Uttapam', slug: 'uttapam', sortOrder: 6 },
  { id: 'cat_sandwiches', name: 'Sandwiches', slug: 'sandwiches', sortOrder: 7 },
  { id: 'cat_special_sandwiches', name: 'Special Sandwiches', slug: 'special-sandwiches', sortOrder: 8 },
  { id: 'cat_icecream_sandwiches', name: 'Ice Cream Sandwiches', slug: 'ice-cream-sandwiches', sortOrder: 9 },
  { id: 'cat_pizza', name: 'Pizza', slug: 'pizza', sortOrder: 10 },
  { id: 'cat_halka_fulka', name: 'Halka Fulka', slug: 'halka-fulka', sortOrder: 11 },
  { id: 'cat_shakes_beverages', name: 'Shakes & Beverages', slug: 'shakes-beverages', sortOrder: 12 },
  { id: 'cat_anniversary_combos', name: 'Anniversary Combo Offers', slug: 'anniversary-combos', sortOrder: 13 },
];

interface RawItemDef {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  variants?: {
    variantId: string;
    name: string;
    price: number; // in paise
    isAvailable: boolean;
  }[];
  singlePrice?: number; // in rupees
  priceType: 'fixed' | 'variant' | 'mrp';
  isPromotional?: boolean;
  confirmationStatus?: 'Needs Owner Confirmation' | 'Confirmed' | 'Active';
  isActive?: boolean;
  description?: string;
}

const RAW_ITEMS: RawItemDef[] = [
  // 1. Bhajipav
  {
    id: 'prince_bp_01',
    name: 'Bhajipav',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 15000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_bp_02',
    name: 'Only Bhaji',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 13000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 15000, isAvailable: true },
    ],
  },
  {
    id: 'prince_bp_03',
    name: 'Boil Bhajipav',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 15000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_bp_04',
    name: 'Kaju Bhajipav',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 18000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 20000, isAvailable: true },
    ],
  },
  {
    id: 'prince_bp_05',
    name: 'Jain Bhajipav',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 15000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_bp_06',
    name: 'SP Double Masala Pav',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 13000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 15000, isAvailable: true },
    ],
  },
  {
    id: 'prince_bp_07',
    name: 'Cheese Bhajipav',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 18000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 21000, isAvailable: true },
    ],
  },
  {
    id: 'prince_bp_08',
    name: 'Extra Pav',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 2000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 3000, isAvailable: true },
    ],
  },
  {
    id: 'prince_bp_09',
    name: 'Roasted Papad',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain/Oil', price: 2000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 0, isAvailable: false },
    ],
  },
  {
    id: 'prince_bp_10',
    name: 'Butter Milk',
    categoryId: 'cat_bhajipav',
    categoryName: 'Bhajipav',
    priceType: 'variant',
    variants: [
      { variantId: 'glass', name: 'Glass', price: 2000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 0, isAvailable: false },
    ],
  },

  // 2. Speciality Dishes
  {
    id: 'prince_sp_01',
    name: 'Prince SP Bhajipav',
    categoryId: 'cat_speciality',
    categoryName: 'Speciality Dishes',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 22000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 25000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sp_02',
    name: 'SP Green Bhajipav',
    categoryId: 'cat_speciality',
    categoryName: 'Speciality Dishes',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 16000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 19000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sp_03',
    name: 'Bhaji Pulav Mix',
    categoryId: 'cat_speciality',
    categoryName: 'Speciality Dishes',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 16000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sp_04',
    name: 'Lasan Ni Chutney',
    categoryId: 'cat_speciality',
    categoryName: 'Speciality Dishes',
    priceType: 'fixed',
    singlePrice: 50,
  },
  {
    id: 'prince_sp_05',
    name: 'Fry Onion',
    categoryId: 'cat_speciality',
    categoryName: 'Speciality Dishes',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 4000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 5000, isAvailable: true },
    ],
  },

  // 3. Pulav
  {
    id: 'prince_pulav_01',
    name: 'Veg. Pulav',
    categoryId: 'cat_pulav',
    categoryName: 'Pulav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 15000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_pulav_02',
    name: 'Kaju Pulav',
    categoryId: 'cat_pulav',
    categoryName: 'Pulav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 18000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 20000, isAvailable: true },
    ],
  },
  {
    id: 'prince_pulav_03',
    name: 'Jain Pulav',
    categoryId: 'cat_pulav',
    categoryName: 'Pulav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 15000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_pulav_04',
    name: 'Cheese Pulav',
    categoryId: 'cat_pulav',
    categoryName: 'Pulav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 18000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 21000, isAvailable: true },
    ],
  },
  {
    id: 'prince_pulav_05',
    name: 'SP Hyderabadi Pulav',
    categoryId: 'cat_pulav',
    categoryName: 'Pulav',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 18000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 21000, isAvailable: true },
    ],
  },

  // 4. Dosa
  {
    id: 'prince_dosa_01',
    name: 'Sada Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 12000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 15000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_02',
    name: 'Cheese Sada Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 17000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_03',
    name: 'Masala Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 15000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_04',
    name: 'Paper Sada Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 13000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 16000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_05',
    name: 'Paper Masala Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 16000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 19000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_06',
    name: 'Rava Sada Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 13000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 16000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_07',
    name: 'Rava Masala Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 16000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 19000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_08',
    name: 'Mysore Sada Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 13000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 16000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_09',
    name: 'Mysore Masala Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 16000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 19000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_10',
    name: 'Gwalior Sada Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_11',
    name: 'Gwalior Masala Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 20000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_12',
    name: 'Tej Masala Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 16000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 19000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_13',
    name: 'Tej Gwalior Masala Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 22000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_14',
    name: 'Rava Gwalior Sada Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_dosa_15',
    name: 'Rava Gwalior Masala Dosa',
    categoryId: 'cat_dosa',
    categoryName: 'Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 22000, isAvailable: true },
    ],
  },

  // 5. Fancy Dosa
  {
    id: 'prince_fdosa_01',
    name: 'SP Open Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 18000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 20000, isAvailable: true },
    ],
  },
  {
    id: 'prince_fdosa_02',
    name: 'SP Open Cheese Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 21000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 23000, isAvailable: true },
    ],
  },
  {
    id: 'prince_fdosa_03',
    name: 'Prince SP Dryfruit Cheese Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 28000, isAvailable: true },
    ],
  },
  {
    id: 'prince_fdosa_04',
    name: 'Ginny Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 24000, isAvailable: true },
    ],
  },
  {
    id: 'prince_fdosa_05',
    name: 'Cheese Frankie Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 24000, isAvailable: true },
    ],
  },
  {
    id: 'prince_fdosa_06',
    name: 'Paneer Mysore Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 24000, isAvailable: true },
    ],
  },
  {
    id: 'prince_fdosa_07',
    name: 'Spring Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 25000, isAvailable: true },
    ],
  },
  {
    id: 'prince_fdosa_08',
    name: 'Kokani Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 26000, isAvailable: true },
    ],
  },
  {
    id: 'prince_fdosa_09',
    name: 'Cheese Paneer Mysore Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 28000, isAvailable: true },
    ],
  },
  {
    id: 'prince_fdosa_10',
    name: 'SP Ghotala Dosa',
    categoryId: 'cat_fancy_dosa',
    categoryName: 'Fancy Dosa',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 0, isAvailable: false },
      { variantId: 'butter', name: 'Butter', price: 28000, isAvailable: true },
    ],
  },

  // 6. Uttapam
  {
    id: 'prince_uttapam_01',
    name: 'Sada Uttapam',
    categoryId: 'cat_uttapam',
    categoryName: 'Uttapam',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 14000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_uttapam_02',
    name: 'Onion Uttapam',
    categoryId: 'cat_uttapam',
    categoryName: 'Uttapam',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 15000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 19000, isAvailable: true },
    ],
  },
  {
    id: 'prince_uttapam_03',
    name: 'Mix Uttapam',
    categoryId: 'cat_uttapam',
    categoryName: 'Uttapam',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 15000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 19000, isAvailable: true },
    ],
  },
  {
    id: 'prince_uttapam_04',
    name: 'Sandwich Uttapam',
    categoryId: 'cat_uttapam',
    categoryName: 'Uttapam',
    priceType: 'variant',
    variants: [
      { variantId: 'oil', name: 'Oil', price: 15000, isAvailable: true },
      { variantId: 'butter', name: 'Butter', price: 19000, isAvailable: true },
    ],
  },

  // 7. Sandwiches
  {
    id: 'prince_sand_01',
    name: 'Vegetable Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 5000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 8000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sand_02',
    name: 'Aloo Mutter Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 5000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 8000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sand_03',
    name: 'Jam Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 5000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 8000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sand_04',
    name: 'Chutney Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 5000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 8000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sand_05',
    name: 'Cheese Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 0, isAvailable: false },
      { variantId: 'cheese', name: 'Cheese', price: 9000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sand_06',
    name: 'Pineapple Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 13000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 15000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sand_07',
    name: 'Chocolate Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 10000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 15000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sand_08',
    name: 'Chocolate Pineapple Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 0, isAvailable: false },
      { variantId: 'cheese', name: 'Cheese', price: 16000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sand_09',
    name: 'Chocolate Rabdi Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 0, isAvailable: false },
      { variantId: 'cheese', name: 'Cheese', price: 18000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sand_10',
    name: 'Chocolate Pineapple Rabdi Sandwich',
    categoryId: 'cat_sandwiches',
    categoryName: 'Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 0, isAvailable: false },
      { variantId: 'cheese', name: 'Cheese', price: 20000, isAvailable: true },
    ],
  },

  // 8. Special Sandwiches
  {
    id: 'prince_sp_sand_01',
    name: 'Ghughra Sandwich',
    categoryId: 'cat_special_sandwiches',
    categoryName: 'Special Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'toast', name: 'Toast', price: 14000, isAvailable: true },
      { variantId: 'grill', name: 'Grill', price: 0, isAvailable: false },
    ],
  },
  {
    id: 'prince_sp_sand_02',
    name: 'Vegetable Special Sandwich',
    categoryId: 'cat_special_sandwiches',
    categoryName: 'Special Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'toast', name: 'Toast', price: 8000, isAvailable: true },
      { variantId: 'grill', name: 'Grill', price: 8000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sp_sand_03',
    name: 'Vegetable Cheese Special Sandwich',
    categoryId: 'cat_special_sandwiches',
    categoryName: 'Special Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'toast', name: 'Toast', price: 12000, isAvailable: true },
      { variantId: 'grill', name: 'Grill', price: 12000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sp_sand_04',
    name: 'Aloo Mutter Special Sandwich',
    categoryId: 'cat_special_sandwiches',
    categoryName: 'Special Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'toast', name: 'Toast', price: 8000, isAvailable: true },
      { variantId: 'grill', name: 'Grill', price: 8000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sp_sand_05',
    name: 'Aloo Mutter Cheese Special Sandwich',
    categoryId: 'cat_special_sandwiches',
    categoryName: 'Special Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'toast', name: 'Toast', price: 12000, isAvailable: true },
      { variantId: 'grill', name: 'Grill', price: 12000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sp_sand_06',
    name: 'Club Sandwich',
    categoryId: 'cat_special_sandwiches',
    categoryName: 'Special Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'toast', name: 'Toast', price: 14000, isAvailable: true },
      { variantId: 'grill', name: 'Grill', price: 14000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sp_sand_07',
    name: 'Cheese Chutney Sandwich',
    categoryId: 'cat_special_sandwiches',
    categoryName: 'Special Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'toast', name: 'Toast', price: 12000, isAvailable: true },
      { variantId: 'grill', name: 'Grill', price: 12000, isAvailable: true },
    ],
  },
  {
    id: 'prince_sp_sand_08',
    name: 'Cheese Special Sandwich',
    categoryId: 'cat_special_sandwiches',
    categoryName: 'Special Sandwiches',
    priceType: 'variant',
    variants: [
      { variantId: 'toast', name: 'Toast', price: 12000, isAvailable: true },
      { variantId: 'grill', name: 'Grill', price: 12000, isAvailable: true },
    ],
  },

  // 9. Ice Cream Sandwiches
  {
    id: 'prince_ice_01',
    name: 'Ice Cream Sandwich',
    categoryId: 'cat_icecream_sandwiches',
    categoryName: 'Ice Cream Sandwiches',
    priceType: 'fixed',
    singlePrice: 150,
  },
  {
    id: 'prince_ice_02',
    name: 'Pineapple Ice Cream Sandwich',
    categoryId: 'cat_icecream_sandwiches',
    categoryName: 'Ice Cream Sandwiches',
    priceType: 'fixed',
    singlePrice: 170,
  },
  {
    id: 'prince_ice_03',
    name: 'Chocolate Ice Cream Sandwich',
    categoryId: 'cat_icecream_sandwiches',
    categoryName: 'Ice Cream Sandwiches',
    priceType: 'fixed',
    singlePrice: 170,
  },
  {
    id: 'prince_ice_04',
    name: 'Chocolate Rabdi Ice Cream Sandwich',
    categoryId: 'cat_icecream_sandwiches',
    categoryName: 'Ice Cream Sandwiches',
    priceType: 'fixed',
    singlePrice: 200,
  },
  {
    id: 'prince_ice_05',
    name: 'Kulfi Sandwich',
    categoryId: 'cat_icecream_sandwiches',
    categoryName: 'Ice Cream Sandwiches',
    priceType: 'fixed',
    singlePrice: 180,
  },

  // 10. Pizza
  {
    id: 'prince_pizza_01',
    name: 'Italian Pizza',
    categoryId: 'cat_pizza',
    categoryName: 'Pizza',
    priceType: 'fixed',
    singlePrice: 150,
  },
  {
    id: 'prince_pizza_02',
    name: 'Jain Pizza',
    categoryId: 'cat_pizza',
    categoryName: 'Pizza',
    priceType: 'fixed',
    singlePrice: 150,
  },
  {
    id: 'prince_pizza_03',
    name: 'Cheese Bake Pizza',
    categoryId: 'cat_pizza',
    categoryName: 'Pizza',
    priceType: 'fixed',
    singlePrice: 160,
  },
  {
    id: 'prince_pizza_04',
    name: 'Double Cheese Pizza',
    categoryId: 'cat_pizza',
    categoryName: 'Pizza',
    priceType: 'fixed',
    singlePrice: 170,
  },
  {
    id: 'prince_pizza_05',
    name: 'Double Cheese Bake Pizza',
    categoryId: 'cat_pizza',
    categoryName: 'Pizza',
    priceType: 'fixed',
    singlePrice: 180,
  },

  // 11. Halka Fulka
  {
    id: 'prince_hf_01',
    name: 'French Fries',
    categoryId: 'cat_halka_fulka',
    categoryName: 'Halka Fulka',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 7000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 9000, isAvailable: true },
    ],
  },
  {
    id: 'prince_hf_02',
    name: 'Peri Peri French Fries',
    categoryId: 'cat_halka_fulka',
    categoryName: 'Halka Fulka',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 9000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 11000, isAvailable: true },
    ],
  },
  {
    id: 'prince_hf_03',
    name: 'Butter Maggi',
    categoryId: 'cat_halka_fulka',
    categoryName: 'Halka Fulka',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 6000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 8000, isAvailable: true },
    ],
  },
  {
    id: 'prince_hf_04',
    name: 'Veg Maggi',
    categoryId: 'cat_halka_fulka',
    categoryName: 'Halka Fulka',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 8000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 10000, isAvailable: true },
    ],
  },
  {
    id: 'prince_hf_05',
    name: 'Maska Bun',
    categoryId: 'cat_halka_fulka',
    categoryName: 'Halka Fulka',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 3000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 5000, isAvailable: true },
    ],
  },
  {
    id: 'prince_hf_06',
    name: 'Jam Maska Bun',
    categoryId: 'cat_halka_fulka',
    categoryName: 'Halka Fulka',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 4000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 6000, isAvailable: true },
    ],
  },
  {
    id: 'prince_hf_07',
    name: 'Chocolate Maska Bun',
    categoryId: 'cat_halka_fulka',
    categoryName: 'Halka Fulka',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 5000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 7000, isAvailable: true },
    ],
  },
  {
    id: 'prince_hf_08',
    name: 'Namkeen Maska Bun',
    categoryId: 'cat_halka_fulka',
    categoryName: 'Halka Fulka',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 10000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 13000, isAvailable: true },
    ],
  },
  {
    id: 'prince_hf_09',
    name: 'Schezwan Maska Bun',
    categoryId: 'cat_halka_fulka',
    categoryName: 'Halka Fulka',
    priceType: 'variant',
    variants: [
      { variantId: 'plain', name: 'Plain', price: 10000, isAvailable: true },
      { variantId: 'cheese', name: 'Cheese', price: 13000, isAvailable: true },
    ],
  },

  // 12. Shakes & Beverages
  {
    id: 'prince_bev_01',
    name: 'Chocolate Shake',
    categoryId: 'cat_shakes_beverages',
    categoryName: 'Shakes & Beverages',
    priceType: 'fixed',
    singlePrice: 100,
  },
  {
    id: 'prince_bev_02',
    name: 'Strawberry Shake',
    categoryId: 'cat_shakes_beverages',
    categoryName: 'Shakes & Beverages',
    priceType: 'fixed',
    singlePrice: 100,
  },
  {
    id: 'prince_bev_03',
    name: 'Pineapple Shake',
    categoryId: 'cat_shakes_beverages',
    categoryName: 'Shakes & Beverages',
    priceType: 'fixed',
    singlePrice: 100,
  },
  {
    id: 'prince_bev_04',
    name: 'Oreo Shake',
    categoryId: 'cat_shakes_beverages',
    categoryName: 'Shakes & Beverages',
    priceType: 'fixed',
    singlePrice: 120,
  },
  {
    id: 'prince_bev_05',
    name: 'KitKat Shake',
    categoryId: 'cat_shakes_beverages',
    categoryName: 'Shakes & Beverages',
    priceType: 'fixed',
    singlePrice: 120,
  },
  {
    id: 'prince_bev_06',
    name: 'Ferrero Rocher Shake',
    categoryId: 'cat_shakes_beverages',
    categoryName: 'Shakes & Beverages',
    priceType: 'fixed',
    singlePrice: 160,
  },
  {
    id: 'prince_bev_07',
    name: 'Cold Coffee',
    categoryId: 'cat_shakes_beverages',
    categoryName: 'Shakes & Beverages',
    priceType: 'fixed',
    singlePrice: 80,
  },
  {
    id: 'prince_bev_08',
    name: 'Cold Drink',
    categoryId: 'cat_shakes_beverages',
    categoryName: 'Shakes & Beverages',
    priceType: 'mrp',
    singlePrice: 0,
    description: 'On MRP - Configurable at billing time',
  },
  {
    id: 'prince_bev_09',
    name: 'Water',
    categoryId: 'cat_shakes_beverages',
    categoryName: 'Shakes & Beverages',
    priceType: 'mrp',
    singlePrice: 0,
    description: 'On MRP - Configurable at billing time',
  },

  // 13. Anniversary Combo Offers
  {
    id: 'prince_combo_01',
    name: 'Bhajipav Pulao Combo',
    categoryId: 'cat_anniversary_combos',
    categoryName: 'Anniversary Combo Offers',
    priceType: 'fixed',
    singlePrice: 150,
    isPromotional: true,
    confirmationStatus: 'Needs Owner Confirmation',
    isActive: false,
    description: 'Anniversary Promotion: Bhajipav + Pulao combination (Requires Owner Approval)',
  },
  {
    id: 'prince_combo_02',
    name: 'Manchurian Hakka Noodles Combo',
    categoryId: 'cat_anniversary_combos',
    categoryName: 'Anniversary Combo Offers',
    priceType: 'fixed',
    singlePrice: 150,
    isPromotional: true,
    confirmationStatus: 'Needs Owner Confirmation',
    isActive: false,
    description: 'Anniversary Promotion: Manchurian + Hakka Noodles (Requires Owner Approval)',
  },
  {
    id: 'prince_combo_03',
    name: 'Manchurian Fried Rice Combo',
    categoryId: 'cat_anniversary_combos',
    categoryName: 'Anniversary Combo Offers',
    priceType: 'fixed',
    singlePrice: 150,
    isPromotional: true,
    confirmationStatus: 'Needs Owner Confirmation',
    isActive: false,
    description: 'Anniversary Promotion: Manchurian + Fried Rice (Requires Owner Approval)',
  },
  {
    id: 'prince_combo_04',
    name: 'Sandwich and French Fries Combo',
    categoryId: 'cat_anniversary_combos',
    categoryName: 'Anniversary Combo Offers',
    priceType: 'fixed',
    singlePrice: 150,
    isPromotional: true,
    confirmationStatus: 'Needs Owner Confirmation',
    isActive: false,
    description: 'Anniversary Promotion: Sandwich + French Fries (Requires Owner Approval)',
  },
  {
    id: 'prince_combo_05',
    name: 'Dosa and Idli Combo',
    categoryId: 'cat_anniversary_combos',
    categoryName: 'Anniversary Combo Offers',
    priceType: 'fixed',
    singlePrice: 150,
    isPromotional: true,
    confirmationStatus: 'Needs Owner Confirmation',
    isActive: false,
    description: 'Anniversary Promotion: Dosa + Idli (Requires Owner Approval)',
  },
  {
    id: 'prince_combo_06',
    name: 'Uttapam and Idli Combo',
    categoryId: 'cat_anniversary_combos',
    categoryName: 'Anniversary Combo Offers',
    priceType: 'fixed',
    singlePrice: 150,
    isPromotional: true,
    confirmationStatus: 'Needs Owner Confirmation',
    isActive: false,
    description: 'Anniversary Promotion: Uttapam + Idli (Requires Owner Approval)',
  },
];

async function run() {
  console.log('========================================================================');
  console.log('🚀 IMPORTING PRINCE PAVBHAJI SHOP & MENU INTO FIREBASE FIRESTORE');
  console.log('========================================================================');

  // Authenticate as Super Admin for privileged multi-tenant schema writing
  await signInWithEmailAndPassword(auth, 'superadmin@foodpos.app', 'SuperAdmin@2026');
  console.log('✅ Authenticated as Super Admin for schema provisioning');

  const now = new Date().toISOString();

  // 1. Create Business Document: businesses/{businessId}
  console.log('\n[1/5] Creating Business Profile for Prince Pavbhaji...');
  const businessData = {
    id: BUSINESS_ID,
    businessName: 'Prince Pavbhaji',
    name: 'Prince Pavbhaji',
    brandName: 'Prince Bhajipav Manekchowkwala',
    ownerName: 'Prince Owner',
    ownerEmail: OWNER_EMAIL,
    ownerUid: OWNER_UID,
    category: 'Restaurant / Fast Food',
    phone: '+91 6355 432 020',
    email: OWNER_EMAIL,
    address: 'Echelon Complex, Near Torrent Power, Makarba, Prahlad Nagar, Ahmedabad, Gujarat - 380051, India',
    deliveryRadius: '3 KM',
    currency: 'INR',
    currencySymbol: '₹',
    status: 'ACTIVE',
    plan: 'pro',
    createdAt: now,
    updatedAt: now,
  };

  // Top-level document
  await setDoc(doc(db, 'businesses', BUSINESS_ID), businessData, { merge: true });
  // Subcollection metadata
  await setDoc(doc(db, 'businesses', BUSINESS_ID, 'meta', 'profile'), businessData, { merge: true });
  await setDoc(doc(db, 'businesses', BUSINESS_ID, 'profile', 'current'), businessData, { merge: true });
  // Also pointer under owner UID so loadShopContext(ownerUid) immediately resolves
  await setDoc(doc(db, 'businesses', OWNER_UID), businessData, { merge: true });
  await setDoc(doc(db, 'businesses', OWNER_UID, 'meta', 'profile'), businessData, { merge: true });
  await setDoc(doc(db, 'businesses', OWNER_UID, 'profile', 'current'), businessData, { merge: true });
  // Directory registration for Super Admin
  await setDoc(doc(db, 'platform', 'shops', 'directory', BUSINESS_ID), businessData, { merge: true });

  // Settings & Features
  await setDoc(doc(db, 'businesses', BUSINESS_ID, 'meta', 'settings'), DEFAULT_BUSINESS_SETTINGS, { merge: true });
  await setDoc(doc(db, 'businesses', BUSINESS_ID, 'settings', 'features'), DEFAULT_BUSINESS_FEATURES, { merge: true });
  await setDoc(doc(db, 'businesses', BUSINESS_ID, 'settings', 'auth'), {
    loginMethod: 'loginId_or_email',
    allowMemberLogin: true,
    maxMembers: 15,
    updatedAt: now,
  }, { merge: true });

  console.log(`✅ Business document created at businesses/${BUSINESS_ID}`);

  // 2. Register Owner & Cashier Login IDs
  console.log('\n[2/5] Registering Login IDs for Prince Pavbhaji...');
  const loginIds = [
    {
      loginId: 'princeowner',
      email: OWNER_EMAIL,
      businessId: BUSINESS_ID,
      role: 'OWNER',
      canCollectPayment: true,
      status: 'ACTIVE',
    },
    {
      loginId: 'princepavbhaji',
      email: OWNER_EMAIL,
      businessId: BUSINESS_ID,
      role: 'OWNER',
      canCollectPayment: true,
      status: 'ACTIVE',
    },
    {
      loginId: 'princecashier',
      email: 'cashier01@royalbistro.foodpos.app', // Working cashier credentials
      businessId: BUSINESS_ID,
      memberId: 'mem_prince_cashier_01',
      role: 'CASHIER',
      canCollectPayment: true,
      status: 'ACTIVE',
    },
  ];

  for (const item of loginIds) {
    await setDoc(doc(db, 'loginIds', item.loginId), { ...item, updatedAt: now }, { merge: true });
    console.log(`  🔑 Registered Login ID: @${item.loginId} -> ${item.email}`);
  }

  // 3. Write Categories: businesses/{businessId}/categories/{categoryId}
  console.log('\n[3/5] Writing 13 Menu Categories to Firestore...');
  for (const cat of CATEGORIES) {
    const catData = {
      id: cat.id,
      businessId: BUSINESS_ID,
      name: cat.name,
      slug: cat.slug,
      sortOrder: cat.sortOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'businesses', BUSINESS_ID, 'categories', cat.id), catData, { merge: true });
    // Also duplicate to OWNER_UID path
    await setDoc(doc(db, 'businesses', OWNER_UID, 'categories', cat.id), catData, { merge: true });
    console.log(`  📁 Category [${cat.sortOrder}/13]: ${cat.name}`);
  }

  // 4. Write Menu Items: businesses/{businessId}/menuItems/{itemId}
  console.log('\n[4/5] Writing 101 Menu Items with Variants to Firestore...');
  let totalVariants = 0;
  let batch = writeBatch(db);
  let batchOwner = writeBatch(db);
  let batchCount = 0;

  for (let i = 0; i < RAW_ITEMS.length; i++) {
    const raw = RAW_ITEMS[i];
    const normalizedName = raw.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Determine basePrice and price
    let basePricePaise = 0;
    let priceRupees = 0;

    if (raw.priceType === 'variant' && raw.variants && raw.variants.length > 0) {
      const activeVariants = raw.variants.filter(v => v.isAvailable);
      basePricePaise = activeVariants.length > 0 ? activeVariants[0].price : raw.variants[0].price;
      priceRupees = basePricePaise / 100;
      totalVariants += raw.variants.length;
    } else if (raw.priceType === 'fixed') {
      priceRupees = raw.singlePrice ?? 0;
      basePricePaise = priceRupees * 100;
      totalVariants += 1;
    } else if (raw.priceType === 'mrp') {
      priceRupees = 0;
      basePricePaise = 0;
      totalVariants += 1;
    }

    const itemDoc = {
      id: raw.id,
      businessId: BUSINESS_ID,
      name: raw.name,
      normalizedName,
      categoryId: raw.categoryId,
      categoryName: raw.categoryName,
      description: raw.description || `${raw.name} - Prince Bhajipav Speciality`,
      price: priceRupees,
      basePrice: basePricePaise,
      priceType: raw.priceType,
      variants: raw.variants || [],
      isAvailable: raw.isActive ?? true,
      isActive: raw.isActive ?? true,
      isPromotional: raw.isPromotional ?? false,
      confirmationStatus: raw.confirmationStatus ?? 'Active',
      isVeg: true,
      gstRate: 5,
      sortOrder: i + 1,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = doc(db, 'businesses', BUSINESS_ID, 'menuItems', raw.id);
    const docRefOwner = doc(db, 'businesses', OWNER_UID, 'menuItems', raw.id);
    batch.set(docRef, itemDoc, { merge: true });
    batchOwner.set(docRefOwner, itemDoc, { merge: true });
    batchCount++;

    if (batchCount >= 40) {
      await batch.commit();
      await batchOwner.commit();
      batch = writeBatch(db);
      batchOwner = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    await batchOwner.commit();
  }

  // 5. Seed Custom Tables for Prince Pavbhaji
  console.log('\n[5/5] Seeding Tables for Prince Pavbhaji...');
  const tables = [
    { id: 'tbl_p_01', name: 'Table 01', capacity: 4, sortOrder: 1 },
    { id: 'tbl_p_02', name: 'Table 02', capacity: 4, sortOrder: 2 },
    { id: 'tbl_p_03', name: 'Table 03', capacity: 4, sortOrder: 3 },
    { id: 'tbl_p_04', name: 'Table 04', capacity: 6, sortOrder: 4 },
    { id: 'tbl_p_05', name: 'Family Table 01', capacity: 8, sortOrder: 5 },
    { id: 'tbl_p_06', name: 'Family Table 02', capacity: 8, sortOrder: 6 },
    { id: 'tbl_p_07', name: 'Outdoor 01', capacity: 4, sortOrder: 7 },
    { id: 'tbl_p_08', name: 'Outdoor 02', capacity: 4, sortOrder: 8 },
  ];

  for (const t of tables) {
    const tData = {
      id: t.id,
      businessId: BUSINESS_ID,
      name: t.name,
      seatingCapacity: t.capacity,
      isActive: true,
      sortOrder: t.sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'businesses', BUSINESS_ID, 'tables', t.id), tData, { merge: true });
    await setDoc(doc(db, 'businesses', OWNER_UID, 'tables', t.id), tData, { merge: true });
  }

  console.log('\n========================================================================');
  console.log('🎉 PRINCE PAVBHAJI IMPORT SUMMARY:');
  console.log('========================================================================');
  console.log(`Shop Name          : Prince Pavbhaji (${businessData.brandName})`);
  console.log(`Business ID        : ${BUSINESS_ID}`);
  console.log(`Owner Account      : ${OWNER_EMAIL} (UID: ${OWNER_UID})`);
  console.log(`Categories Created : ${CATEGORIES.length}`);
  console.log(`Menu Items Created : ${RAW_ITEMS.length}`);
  console.log(`Total Variants     : ${totalVariants}`);
  console.log(`Promotional Combos : 6 (Marked "Needs Owner Confirmation")`);
  console.log(`MRP Products       : 2 (Cold Drink, Water)`);
  console.log('========================================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
