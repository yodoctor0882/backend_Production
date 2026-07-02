we have build a Appointment based Project
pull origin backend-dev and push code


# 🏥 Yodoctor Pro — Backend API

Express.js + Razorpay subscription management API for the MediCare Pro healthcare platform.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your Razorpay keys
cp .env.example .env

# 3. Start dev server
npm run dev      # requires nodemon: npm i -g nodemon
# OR
npm start        # production
```

Server runs on **http://localhost:5000**

---

## ⚙️ Environment Variables (.env)

| Variable                  | Description                              |
|---------------------------|------------------------------------------|
| `PORT`                    | Server port (default: 5000)              |
| `RAZORPAY_KEY_ID`         | From Razorpay Dashboard → API Keys       |
| `RAZORPAY_KEY_SECRET`     | From Razorpay Dashboard → API Keys       |
| `RAZORPAY_WEBHOOK_SECRET` | From Razorpay Dashboard → Webhooks       |
| `FRONTEND_URL`            | Your React app URL (for CORS)            |
| `JWT_SECRET`              | Secret for JWT tokens                    |

---

## 📁 Project Structure

```
medicare-backend/
├── server.js                    ← Entry point
├── .env.                 ← Env template
├── data/
│   └── store.js                 ← In-memory store (replace with MongoDB)
├── middleware/
│   └── auth.js                  ← Auth middleware (demo + JWT version)
├── utils/
│   ├── razorpay.js              ← Razorpay client + signature helpers
│   └── response.js              ← Standardised API responses
├── controllers/
    razorpayController.js
│   ├── plansController.js       ← Pricing plans logic
│   ├── subscriptionsController.js ← Core subscription logic
│   ├── paymentsController.js    ← One-time payment / retry logic
│   ├── webhooksController.js    ← Razorpay webhook events
│   ├── billingController.js     ← Invoice / billing history
│   └── usersController.js       ← User profile & dashboard
└── routes/
     razorpay.routes.js
        plans.js => this all in single route name = razorpay.routes.js
    ├── subscriptions.js => this all in single route name = razorpay.routes.js
    ├── payments.js => this all in single route name = razorpay.routes.js
    ├── webhooks.js => this all in single route name = razorpay.routes.js
    ├── billing.js => this all in single route name = razorpay.routes.js
    └── users.js => this all in single route name = razorpay.routes.js
    ├── 
```

---

## 🔑 Authentication (Demo Mode)

All protected routes read a `x-user-id` header.  
Default demo user: `user_demo_001`

```http
x-user-id: user_demo_001
```

**In production**, replace with JWT:
```http
Authorization: Bearer <your_jwt_token>
```

---

## 📋 API Reference

### Health Check
```http
GET /health
```

---

### Plans (Public)

#### Get All Plans
```http
GET /api/plans?billing=monthly
GET /api/plans?billing=yearly
```
**Response:**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "plan_basic",
        "name": "Basic",
        "price": 999,
        "monthlyPrice": 999,
        "yearlyPrice": 799,
        "savings": 0,
        "features": [...]
      }
    ],
    "billing": "monthly"
  }
}
```

#### Get Single Plan
```http
GET /api/plans/plan_premium
GET /api/plans/premium
```

---

### Subscriptions (Auth Required)

#### 1. Create Subscription ← Call on "Subscribe Now" click
```http
POST /api/subscriptions/create
x-user-id: user_demo_001
Content-Type: application/json

{
  "planId": "plan_premium",
  "billing": "monthly"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "subscription_id": "sub_Hzpz0abcXYZ",
    "local_subscription_id": "sub_abc123",
    "razorpay_key": "rzp_test_XXXXXXXX",
    "plan": {
      "id": "plan_premium",
      "name": "Premium",
      "amount": 2499,
      "currency": "INR",
      "billing": "monthly"
    },
    "prefill": {
      "name": "Dr. Rajesh Kumar",
      "email": "rajesh@medicare.pro",
      "contact": "+919876543210"
    }
  }
}
```

Use `subscription_id` + `razorpay_key` to open the Razorpay checkout popup.

#### 2. Verify Subscription ← Call on Razorpay success handler
```http
POST /api/subscriptions/verify
x-user-id: user_demo_001
Content-Type: application/json

{
  "razorpay_payment_id": "pay_XYZ123",
  "razorpay_subscription_id": "sub_Hzpz0abcXYZ",
  "razorpay_signature": "signature_from_razorpay",
  "local_subscription_id": "sub_abc123"
}
```

#### 3. Get Active Subscription
```http
GET /api/subscriptions/active
x-user-id: user_demo_001
```

#### 4. Get All Subscriptions
```http
GET /api/subscriptions
```

#### 5. Cancel Subscription
```http
POST /api/subscriptions/sub_abc123/cancel

{
  "cancel_at_period_end": true
}
```

#### 6. Upgrade Plan
```http
POST /api/subscriptions/sub_abc123/upgrade

{
  "newPlanId": "plan_enterprise"
}
```

---

### Payments (Auth Required)

#### Create Retry Order (for failed payment)
```http
POST /api/payments/create-order

{
  "amount": 2499,
  "currency": "INR"
}
```

#### Verify One-Time Payment
```http
POST /api/payments/verify

{
  "razorpay_order_id": "order_XYZ",
  "razorpay_payment_id": "pay_XYZ",
  "razorpay_signature": "sig_XYZ"
}
```

---

### Billing (Auth Required)

#### Get Billing History
```http
GET /api/billing/history?page=1&limit=10
```

#### Get Invoice
```http
GET /api/billing/invoice/INV-2025-089
```

---

### Users (Auth Required)

#### Get Profile
```http
GET /api/users/me
```

#### Update Profile
```http
PUT /api/users/me

{
  "name": "Dr. Rajesh Kumar",
  "phone": "+919876543210",
  "clinic": "City Health Clinic"
}
```

#### Dashboard Summary
```http
GET /api/users/dashboard
```

---

### Webhooks (No Auth — Razorpay calls this)

```http
POST /api/webhooks/razorpay
x-razorpay-signature: <hmac_sha256>
```

**Events handled:**
- `subscription.activated`
- `subscription.charged`
- `subscription.cancelled`
- `subscription.completed`
- `subscription.pending`
- `payment.captured`
- `payment.failed`

> Configure this URL in: **Razorpay Dashboard → Settings → Webhooks**

---

## 🖥️ Frontend Integration (React)

```javascript
// 1. Load Razorpay script
const loadRazorpay = () =>
  new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

// 2. Subscribe flow
const handleSubscribe = async (planId, billing) => {
  const loaded = await loadRazorpay();
  if (!loaded) return alert("Razorpay SDK failed to load");

  // Call your backend
  const res = await fetch("http://localhost:5000/api/subscriptions/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "user_demo_001",
    },
    body: JSON.stringify({ planId, billing }),
  });
  const { data } = await res.json();

  // Open Razorpay popup
  const rzp = new window.Razorpay({
    key:             data.razorpay_key,
    subscription_id: data.subscription_id,
    name:            "MediCare Pro",
    description:     `${data.plan.name} Plan`,
    prefill:         data.prefill,
    theme:           { color: "#0d9488" },

    handler: async (response) => {
      // Verify on backend
      const verify = await fetch("http://localhost:5000/api/subscriptions/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": "user_demo_001" },
        body: JSON.stringify({
          ...response,
          local_subscription_id: data.local_subscription_id,
        }),
      });
      const result = await verify.json();
      if (result.success) navigate("/success");
      else navigate("/failed");
    },

    modal: {
      ondismiss: () => console.log("Checkout closed"),
    },
  });

  rzp.on("payment.failed", (resp) => {
    console.error("Payment failed:", resp.error);
    navigate("/failed");
  });

  rzp.open();
};
```

---

## 🔧 Razorpay Dashboard Setup

1. Create plans at: **Dashboard → Subscriptions → Plans**
2. Copy plan IDs into `data/store.js` → `razorpay.monthly_plan_id` / `yearly_plan_id`
3. Set webhook URL: `https://yourdomain.com/api/webhooks/razorpay`
4. Enable events: `subscription.*` and `payment.*`

---

## 🛡️ Security Notes

- Signatures are verified server-side (never trust frontend)
- Webhook uses raw body for HMAC verification
- Rate limiting: 100 req / 15 min per IP
- Helmet.js for HTTP security headers
- In production: add JWT auth, use MongoDB, add HTTPS

---

## 📦 Production Checklist

- [ ] Replace in-memory store with MongoDB / PostgreSQL
- [ ] Switch to live Razorpay keys (`rzp_live_...`)
- [ ] Enable JWT authentication
- [ ] Set `NODE_ENV=production`
- [ ] Add HTTPS / SSL certificate
- [ ] Configure CORS for your production frontend URL
- [ ] Set up proper logging (Winston / Pino)
- [ ] Add database migrations