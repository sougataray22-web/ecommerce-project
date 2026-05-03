# 🛒 MultiVend — Full-Stack Multi-Vendor E-Commerce Platform

A production-ready, scalable e-commerce platform with **Owner**, **Vendor**, and **Customer** roles, built with the MERN stack.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vercel)                       │
│         React 18 · Tailwind CSS · Zustand · Axios           │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (JWT Bearer)
┌──────────────────────────▼──────────────────────────────────┐
│                      BACKEND (Render)                        │
│         Node.js · Express · Multer · Cashfree SDK            │
└─────┬────────────┬──────────────┬──────────────┬────────────┘
      │            │              │              │
  MongoDB      Cloudinary    Nodemailer      Cashfree
   Atlas        (Files)       (Email)       (Payments)
```

---

## 🔑 Role System

| Role     | Recognition                            | Access                              |
|----------|----------------------------------------|-------------------------------------|
| Owner    | `OWNER_EMAIL` or `OWNER_PHONE` env var | Master Control Panel, all routes    |
| Vendor   | Registers as vendor → KYC → Approved   | Vendor dashboard, own products/orders|
| Customer | Default registration                   | Browse, cart, checkout              |

### Post-Login Redirect Logic
```
owner          → /admin/dashboard
vendor + approved   → /vendor/dashboard
vendor + pending    → /vendor/kyc-pending
vendor + no KYC     → /vendor/kyc
customer            → /
```

---

## 📁 Project Structure

```
ecommerce/
├── backend/
│   ├── config/
│   │   ├── db.js                 # MongoDB Atlas connection
│   │   └── cloudinary.js         # Multer + Cloudinary storages
│   ├── controllers/
│   │   ├── authController.js     # OTP send/verify, profile
│   │   ├── kycController.js      # Vendor KYC CRUD + admin review
│   │   ├── productController.js  # Product CRUD + search
│   │   ├── orderController.js    # Order creation, splitting, analytics
│   │   ├── paymentController.js  # Cashfree session + webhook
│   │   └── bannerController.js   # Hero banner management
│   ├── middleware/
│   │   └── auth.js               # protect, ownerOnly, vendorOnly, RBAC
│   ├── models/
│   │   ├── User.js               # Users (owner/vendor/customer)
│   │   ├── VendorKYC.js          # KYC documents + bank details
│   │   ├── Product.js            # Products with variation SKUs
│   │   ├── Order.js              # Orders with vendor sub-orders
│   │   └── Banner.js             # Hero banners + Category + Review
│   ├── routes/
│   │   ├── auth.js
│   │   ├── kyc.js
│   │   └── index.js              # products, orders, payment, banners, admin
│   ├── utils/
│   │   ├── otp.js                # OTP generation + Nodemailer templates
│   │   ├── jwt.js                # Sign/verify JWT
│   │   └── response.js           # Standardized API responses
│   ├── server.js                 # Express app entry point
│   ├── render.yaml               # Render deployment config
│   └── .env.example
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── context/
    │   │   ├── authStore.js       # Zustand auth state + OTP flows
    │   │   └── cartStore.js       # Zustand cart (localStorage persisted)
    │   ├── components/
    │   │   └── common/
    │   │       └── ProtectedRoute.jsx  # ProtectedRoute, OwnerRoute, VendorRoute, GuestRoute
    │   ├── pages/
    │   │   ├── auth/
    │   │   │   └── LoginPage.jsx        # Email/Phone OTP + role select
    │   │   ├── customer/
    │   │   │   ├── HomePage.jsx         # Banner slider + product grid
    │   │   │   ├── ProductListPage.jsx  # Paginated product listing + search
    │   │   │   ├── ProductDetailPage.jsx# Variation selector + cart/buy
    │   │   │   ├── CartPage.jsx         # Cart with qty controls
    │   │   │   ├── CheckoutPage.jsx     # Address + Cashfree payment
    │   │   │   ├── OrderConfirmPage.jsx # Payment verify + success/fail
    │   │   │   ├── OrdersPage.jsx       # Order history list
    │   │   │   ├── OrderDetailPage.jsx  # Full order + tracking
    │   │   │   └── ProfilePage.jsx      # User profile
    │   │   ├── vendor/
    │   │   │   ├── VendorKYCForm.jsx    # 5-step KYC with webcam
    │   │   │   ├── VendorKYCPending.jsx # Waiting screen
    │   │   │   ├── VendorDashboard.jsx  # Analytics + mini bar chart
    │   │   │   ├── VendorProducts.jsx   # Product list + delete
    │   │   │   ├── VendorAddProduct.jsx # Add product + variations
    │   │   │   └── VendorOrders.jsx     # Orders + status update
    │   │   └── admin/
    │   │       ├── AdminDashboard.jsx   # Stats + pending KYCs + orders
    │   │       ├── AdminKYCList.jsx     # KYC queue
    │   │       ├── AdminKYCDetail.jsx   # Full KYC review + approve/reject
    │   │       ├── AdminBanners.jsx     # Banner CRUD with image upload
    │   │       ├── AdminVendors.jsx     # Vendor list + toggle
    │   │       ├── AdminOrders.jsx      # All orders
    │   │       └── AdminProducts.jsx    # All products
    │   ├── utils/
    │   │   └── api.js             # Axios instance + interceptors
    │   ├── styles/
    │   │   └── index.css          # Tailwind + DM Sans + global styles
    │   ├── App.jsx                # Router + lazy loading
    │   └── index.js
    ├── tailwind.config.js
    ├── vercel.json
    └── .env.example
```

---

## 🚀 Setup & Deployment

### 1. Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Cloudinary account
- Gmail (or SMTP) for Nodemailer
- Cashfree merchant account
- Vercel account (frontend)
- Render account (backend)

---

### 2. Backend Setup (Render)

```bash
# Clone and enter backend
cd ecommerce/backend
npm install

# Copy env template
cp .env.example .env
# → Fill all values in .env
```

**Required `.env` values:**
```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=min-32-char-random-string
OWNER_EMAIL=your@email.com
OWNER_PHONE=+919999999999

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password   # Gmail App Password (not account password)
FROM_EMAIL=noreply@yourstore.com
FROM_NAME=YourStore

CASHFREE_APP_ID=...
CASHFREE_SECRET_KEY=...
CASHFREE_ENV=PROD             # or TEST for sandbox
CASHFREE_WEBHOOK_SECRET=...

FRONTEND_URL=https://your-frontend.vercel.app
BACKEND_URL=https://your-backend.onrender.com
```

```bash
# Test locally
npm run dev
# → http://localhost:5000/health
```

**Deploy to Render:**
1. Push backend folder to GitHub repo
2. Create new "Web Service" on Render
3. Connect repo, set root to `backend/`
4. Add all env vars in Render dashboard
5. Deploy — Render will detect `render.yaml`

---

### 3. Frontend Setup (Vercel)

```bash
cd ecommerce/frontend
npm install

# Copy env
cp .env.example .env
```

**.env values:**
```env
REACT_APP_API_URL=https://your-backend.onrender.com/api
REACT_APP_CASHFREE_MODE=production   # or sandbox
REACT_APP_STORE_NAME=YourStore
```

```bash
npm start   # http://localhost:3000
```

**Deploy to Vercel:**
1. Push frontend folder to GitHub repo
2. Import project on Vercel
3. Set root directory to `frontend/`
4. Add env vars in Vercel dashboard
5. Deploy

---

### 4. Cashfree Webhook Setup

In your Cashfree merchant dashboard:
- Go to **Developers → Webhooks**
- Add endpoint: `https://your-backend.onrender.com/api/payment/webhook`
- Select event: `PAYMENT_SUCCESS_WEBHOOK`
- Copy the webhook secret → set as `CASHFREE_WEBHOOK_SECRET` in backend env

---

### 5. Gmail App Password (SMTP)

1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Go to App Passwords → Create one for "Mail"
4. Use that 16-char password as `SMTP_PASS`

---

### 6. Cloudinary Setup

1. Create free account at cloudinary.com
2. Go to Dashboard → copy Cloud Name, API Key, API Secret
3. Set in backend `.env`

The app auto-creates these folders in Cloudinary:
- `ecommerce/products/`
- `ecommerce/kyc/documents/`
- `ecommerce/kyc/photos/`
- `ecommerce/banners/`
- `ecommerce/categories/`

---

## 📡 API Reference

### Auth
| Method | Endpoint               | Auth | Description                    |
|--------|------------------------|------|--------------------------------|
| POST   | /api/auth/send-otp     | —    | Send OTP (email or phone)      |
| POST   | /api/auth/verify-otp   | —    | Verify OTP → JWT + redirectPath|
| GET    | /api/auth/me           | JWT  | Get logged-in user             |
| PATCH  | /api/auth/profile      | JWT  | Update name, avatar            |
| POST   | /api/auth/address      | JWT  | Add shipping address           |

### KYC
| Method | Endpoint               | Auth         | Description               |
|--------|------------------------|--------------|---------------------------|
| POST   | /api/kyc/submit        | Vendor JWT   | Submit KYC (multipart)    |
| GET    | /api/kyc/my-kyc        | Vendor JWT   | Get own KYC status        |
| GET    | /api/kyc/all           | Owner JWT    | List all KYCs (paginated) |
| PATCH  | /api/kyc/:id/review    | Owner JWT    | Approve or Reject KYC     |

### Products
| Method | Endpoint                       | Auth           | Description              |
|--------|--------------------------------|----------------|--------------------------|
| GET    | /api/products                  | —              | List (search, filter)    |
| GET    | /api/products/:slug            | —              | Product detail           |
| GET    | /api/products/vendor/mine      | Vendor JWT     | Vendor's own products    |
| POST   | /api/products/vendor           | Approved Vendor| Create product           |
| PATCH  | /api/products/vendor/:id       | Approved Vendor| Update product           |
| DELETE | /api/products/vendor/:id       | Approved Vendor| Delete product           |

### Orders
| Method | Endpoint                             | Auth       | Description                      |
|--------|--------------------------------------|------------|----------------------------------|
| POST   | /api/orders/create                   | JWT        | Create order (multi-vendor split)|
| GET    | /api/orders                          | JWT        | List orders (role-aware)         |
| GET    | /api/orders/:id                      | JWT        | Order detail                     |
| PATCH  | /api/orders/:orderId/sub/:subOrderId | Vendor JWT | Update sub-order status          |
| GET    | /api/orders/vendor/analytics         | Vendor JWT | Revenue analytics                |

### Payments
| Method | Endpoint                        | Auth | Description                    |
|--------|---------------------------------|------|--------------------------------|
| POST   | /api/payment/create-session     | JWT  | Create Cashfree session        |
| GET    | /api/payment/verify/:orderId    | JWT  | Verify payment status          |
| POST   | /api/payment/webhook            | —    | Cashfree webhook (HMAC signed) |

### Banners
| Method | Endpoint              | Auth      | Description                |
|--------|-----------------------|-----------|----------------------------|
| GET    | /api/banners          | —         | Active banners (public)    |
| GET    | /api/banners/admin    | Owner JWT | All banners                |
| POST   | /api/banners          | Owner JWT | Create banner              |
| PATCH  | /api/banners/:id      | Owner JWT | Update banner              |
| DELETE | /api/banners/:id      | Owner JWT | Delete banner              |
| PATCH  | /api/banners/reorder  | Owner JWT | Reorder banner positions   |

### Admin
| Method | Endpoint                       | Auth      | Description              |
|--------|--------------------------------|-----------|--------------------------|
| GET    | /api/admin/stats               | Owner JWT | Dashboard statistics     |
| GET    | /api/admin/vendors             | Owner JWT | List vendors             |
| PATCH  | /api/admin/vendors/:id/toggle  | Owner JWT | Activate/deactivate      |
| GET    | /api/admin/orders              | Owner JWT | All orders               |

---

## 🔒 Security Features

- **HMAC Webhook Verification** – Cashfree webhooks verified with SHA-256 HMAC
- **JWT Auth** – RS256-style expiring tokens, auto-refresh via interceptor
- **OTP Rate Limiting** – Max 5 OTP requests per 15 minutes per IP
- **Helmet.js** – Secure HTTP headers
- **CORS** – Locked to frontend URL only
- **Role Guards** – Every protected route has middleware: `protect`, `ownerOnly`, `approvedVendorOnly`
- **Input Validation** – express-validator on all write endpoints
- **File Type Validation** – Cloudinary storage restricts allowed MIME types per upload type
- **Stock Deduction Idempotency** – `stockDeducted` flag prevents double-deduction on webhook retry

---

## 💳 Payment Flow

```
Customer clicks "Pay"
    ↓
POST /api/orders/create        → Creates Order (status: pending, paymentStatus: pending)
    ↓
POST /api/payment/create-session → Calls Cashfree API → gets payment_session_id
    ↓
Cashfree JS SDK opens payment modal
    ↓
Customer pays
    ↓
Cashfree → POST /api/payment/webhook (HMAC verified)
    ↓
markOrderPaid() → paymentStatus: paid, stock deducted, sub-orders: confirmed
    ↓
Cashfree redirects → /order/confirm?order_id=...
    ↓
GET /api/payment/verify/:orderId → double-checks status
    ↓
Success page shown
```

> **Webhook is the source of truth.** Even if the user closes the browser, the webhook ensures the order is fulfilled and stock is deducted.

---

## 🗃️ Data Models

### User
```js
{ name, email, phone, role: 'owner|vendor|customer',
  isApproved, kycSubmitted, businessName,
  isEmailVerified, isPhoneVerified,
  addresses[{label,line1,city,state,pincode}],
  wishlist, avatar, isActive, lastLoginAt }
```

### VendorKYC
```js
{ vendor(ref), aadharNumber, aadharFront(url), aadharBack(url),
  livePhoto(url), bankAccountNumber, bankIfscCode, bankAccountName,
  businessName, businessAddress, gstNumber, panNumber,
  status: 'pending|approved|rejected', rejectionReason,
  reviewedBy(ref), reviewedAt, submissionCount }
```

### Product
```js
{ vendor(ref), name, slug, description, brand, category(ref),
  images[], variationAxes[], variations[{sku, attributes{}, price, mrp, stock}],
  basePrice, baseMrp, baseStock, ratingsAverage, ratingsCount,
  freeShipping, shippingCharges, isActive, isFeatured }
  // Virtuals: effectivePrice, totalStock
```

### Order
```js
{ orderNumber, customer(ref), shippingAddress{},
  subOrders[{ vendor(ref), items[], subtotal, status, trackingNumber }],
  itemsTotal, shippingTotal, taxTotal, grandTotal,
  paymentMethod, paymentStatus, cashfreeOrderId, paidAt,
  status, stockDeducted }
```

### Banner
```js
{ title, subtitle, imageUrl, targetType: 'product|category|url|none',
  targetId, targetUrl, position, isActive, startDate, endDate }
```

---

## 🧩 Adding SMS OTP

In `backend/utils/otp.js`, after `sendOtpEmail`, add your SMS provider:

```js
// Fast2SMS example
const sendSmsOtp = async (phone, otp) => {
  await axios.post('https://www.fast2sms.com/dev/bulkV2', {
    route: 'otp', variables_values: otp, numbers: phone.replace('+91', ''),
  }, { headers: { authorization: process.env.FAST2SMS_API_KEY } });
};
```

Then in `authController.js → sendOtp`, uncomment:
```js
// await sendSmsOtp(identifier, otp);
```

---

## 📦 Sprint Roadmap

| Sprint | Features |
|--------|---------|
| ✅ Sprint 1 | Models, Auth OTP, RBAC Middleware, KYC Flow, Cloudinary |
| ✅ Sprint 2 | Products with Variations, Order Splitting, Cashfree Webhook |
| ✅ Sprint 3 | Banner Management, Vendor Dashboard + Analytics, Admin Panel |
| ✅ Sprint 4 | Customer Journey (Homepage → Cart → Checkout → Confirm) |
| 🔜 Sprint 5 | Reviews & Ratings, Coupon System, Wishlist API |
| 🔜 Sprint 6 | SMS OTP Integration, Push Notifications, Refund Flow |
| 🔜 Sprint 7 | SEO, Sitemap, PWA, Performance Optimization |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — feel free to use this for commercial projects.
