# Food POS SaaS: Universal Mobile-First Food Billing & Management Platform

A production-ready, mobile-first Multi-Tenant Food Point of Sale (POS) and Billing Progressive Web Application (PWA). Built for restaurants, cafes, food stalls, takeaway counters, cloud kitchens, and food shops.

---

## 🌟 Key Features

### 1. Fast Mobile POS & Billing
- **Item Selection & Custom Items**: Quick category pills, instant search, instant add/edit, temporary price overrides, and custom on-the-fly items.
- **Custom Extras**: Customizable toppings, dips, and sides with real-time tax recalculation.
- **Table Management**: Unlimited custom tables with real-time status calculation (`AVAILABLE`, `OCCUPIED`, `PAYMENT_PENDING`).
- **Flexible Order Types**: Dedicated toggle chips for **Dine In**, **Takeaway**, and **Parcel** independent of table assignment.
- **Thermal Printing & WhatsApp Sharing**: Instant browser-based 80mm/58mm thermal receipt printing and digital bill dispatch via WhatsApp.

### 2. Direct Pending Payments Collection
- Direct mobile navigation destination for tracking open, unpaid, and partially paid table balances.
- Receive partial payments, record reference notes, and print or share updated balance receipts.
- Settle bills in one tap to automatically release tables and update accounting records.

### 3. Centralized Super Admin & Feature Controls
- Dedicated, secure administrative portal at `/admin/login` for platform oversight.
- **16 Modular Feature Flags**: Individual toggles for Billing, Orders, Pending Payments, Menu Management, Table Management, Suppliers, Inventory, Purchase Orders, Reports, GST, WhatsApp, Printing, Customer Directory, Staff Management, Expenses, and Offline Billing.
- Live synchronization to Firestore (`businesses/{businessId}/settings/features`), audit logs of feature modifications, and one-tap reset to platform defaults.

### 4. Custom Staff Login IDs & Permission Enforcement
- Shop owners can create staff members with alphanumeric Login IDs (e.g. `cashier01`, `counter02`, `manager01`) and temporary passwords.
- Secure backend resolution maps Login IDs directly to Firebase Authentication accounts without exposing plaintext passwords.
- Cashier payment collection permissions: cashiers can be permitted or restricted from collecting payments while retaining bill drafting and ordering capabilities.

### 5. Multi-Tenant Architecture & Offline PWA Sync
- Independent, isolated Firestore business collections (`businesses/{businessId}/*`).
- Offline-first caching with IndexedDB (`idb`) and local storage fallback.
- Background sync queue that automatically commits offline orders to Cloud Firestore upon network reconnection.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite 8
- **Styling**: Tailwind CSS v4, Lucide React
- **Backend & Database**: Google Cloud Firebase (Authentication, Cloud Firestore, Storage)
- **Offline Storage**: IndexedDB (`idb`), Service Worker PWA
- **PDF & Receipts**: jsPDF, jsPDF-AutoTable
- **Deployment**: Vercel (Frontend SPA) + Firebase (Cloud Firestore & Security Rules)

---

## 🚀 Quick Start & Local Development

### Prerequisites
- Node.js (v20+ recommended)
- npm or yarn
- Firebase account with a Firestore-enabled project

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/food-pos-saas.git
cd food-pos-saas
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Firebase project credentials:
```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Production Build & Preview
```bash
npm run build
npm run preview
```

---

## 🔒 Security & Firestore Rules

Deploy the included security rules and indexes to your Firebase project:
```bash
# Deploy Firestore security rules
npx firebase deploy --only firestore:rules --project your-firebase-project-id

# Deploy Firestore composite indexes
npx firebase deploy --only firestore:indexes --project your-firebase-project-id
```

---

## ☁️ Vercel Deployment

1. **Connect Repository**: Import the `food-pos-saas` repository into Vercel.
2. **Build Settings**:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
3. **SPA Routing**: Handled automatically via `vercel.json`:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
4. **Environment Variables**: Add your Firebase configuration keys in the Vercel Project Settings under **Environment Variables**:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

---

## 📄 License
This project is proprietary and confidential. All rights reserved.
