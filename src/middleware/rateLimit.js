const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Authentication APIs
 */
const authLimiter = rateLimit({
  ...commonOptions,

  windowMs: 15 * 60 * 1000,
  max: 20,

  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});

/**
 * Razorpay APIs
 */
const paymentLimiter = rateLimit({
  ...commonOptions,

  windowMs: 5 * 60 * 1000,
  max: 10,

  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);

    return req.user?.id
      ? `payment:user:${req.user.id}:ip:${ip}`
      : `payment:ip:${ip}`;
  },

  message: {
    success: false,
    message: "Too many payment requests. Please try again later.",
  },
});

module.exports = {
  authLimiter,
  paymentLimiter,
};
