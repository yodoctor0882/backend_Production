const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const razorpayController = require("../controllers/razorpayController");

// ===================== CONTROLLERS ======================

const {
  // Subscriptions
  createSubscription,
  verifySubscription,
  getActiveSubscription,
  getAllSubscriptions,
  getSubscriptionById,
  cancelSubscription,
  upgradeSubscription,

  // Plans
  getAllPlans,
  getPlanById,

  // Payments
  createOrder,
  verifyPayment,
  getPayment,

  // Webhook
  razorpayWebhook,

  // Billing
  getBillingHistory,
  getInvoice,

  // Users
  getMe,
  updateMe,
  getDashboard,
} = require("../controllers/razorpayController");

// ====================== PLAN ROUTES ======================
// Public Routes

router.get("/plans", razorpayController.getAllPlans);

router.get("/plans/:planId", razorpayController.getPlanById);

// ================= SUBSCRIPTION ROUTES ===================

router.post(
  "/subscriptions/create",
  verifyToken,
  razorpayController.createSubscription,
);

router.post(
  "/subscriptions/verify",
  verifyToken,
  razorpayController.verifySubscription,
);

router.get(
  "/subscriptions/active",
  verifyToken,
  razorpayController.getActiveSubscription,
);

router.get("/subscriptions", verifyToken, getAllSubscriptions);

router.get(
  "/subscriptions/:id",
  verifyToken,
  razorpayController.getSubscriptionById,
);

router.post(
  "/subscriptions/:id/cancel",
  verifyToken,
  razorpayController.cancelSubscription,
);

router.post(
  "/subscriptions/:id/upgrade",
  verifyToken,
  razorpayController.upgradeSubscription,
);

// ==================== PAYMENT ROUTES =====================

router.post(
  "/payments/create-order",
  verifyToken,
  razorpayController.createOrder,
);

router.post("/payments/verify", verifyToken, razorpayController.verifyPayment);

router.get("/payments/:paymentId", verifyToken, razorpayController.getPayment);

// ==================== BILLING ROUTES =====================

router.get(
  "/billing/history",
  verifyToken,
  razorpayController.getBillingHistory,
);

router.get(
  "/billing/invoice/:invoiceId",
  verifyToken,
  razorpayController.getInvoice,
);

// ===================== USER ROUTES =======================

router.get("/users/me", verifyToken, razorpayController.getMe);

router.put("/users/me", verifyToken, razorpayController.updateMe);

router.get("/users/dashboard", verifyToken, razorpayController.getDashboard);

// ==================== WEBHOOK ROUTES =====================
// No verifyToken required

router.post("/webhooks/razorpay", razorpayController.razorpayWebhook);

// ======================= EXPORT ==========================
router.post(
  "/lab/payments/create-order",
  verifyToken,
  razorpayController.createLabPaymentOrder,
);

router.post(
  "/lab/payments/verify",
  verifyToken,
  razorpayController.verifyLabPayment,
);

module.exports = router;
