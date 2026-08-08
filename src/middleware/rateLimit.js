const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Auth - IP based
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many auth attempts. Try again later.",
  },
});

// Authenticated APIs - User ID based
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    return `ip:${ipKeyGenerator(req.ip)}`;
  },

  handler: (req, res) => {
    console.log("Rate limit hit =>", req.user?.id, req.method, req.originalUrl);

    return res.status(429).json({
      success: false,
      message: "Too many requests, please try again later.",
    });
  },
});

// Payment
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many payment requests. Please try again later.",
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
  paymentLimiter,
};
