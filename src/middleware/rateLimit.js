const rateLimit = require(
  "express-rate-limit",
);

// GLOBAL LIMITER

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 500,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many requests, please try again later.",
  },
});

// AUTH LIMITER

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 20,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many auth attempts. Try again later.",
  },
});

// LIVEKIT LIMITER

const livekitLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,

  max: 30,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many video consultation requests.",
  },
});

// PAYMENT LIMITER

const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,

  max: 10,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many payment requests.",
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
  livekitLimiter,
  paymentLimiter,
};