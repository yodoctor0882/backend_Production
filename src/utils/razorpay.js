const Razorpay = require("razorpay");
const crypto = require("crypto");

// ==================== RAZORPAY CLIENT ====================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ================= PAYMENT SIGNATURE =====================

const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const body = `${orderId}|${paymentId}`;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
};

// ============== SUBSCRIPTION SIGNATURE ===================

const verifySubscriptionSignature = (subscriptionId, paymentId, signature) => {
  const body = `${paymentId}|${subscriptionId}`;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  console.log("BODY:", body);
  console.log("EXPECTED:", expectedSignature);
  console.log("RECEIVED:", signature);

  return expectedSignature === signature;
};

// ================= WEBHOOK SIGNATURE =====================

const verifyWebhookSignature = (rawBody, signature) => {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
};

// ======================= EXPORTS =========================

module.exports = {
  razorpay,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
};
