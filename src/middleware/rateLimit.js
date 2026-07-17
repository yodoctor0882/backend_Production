// const rateLimit = require(
//   "express-rate-limit",
// );

// // GLOBAL LIMITER

// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,

//   max: 500,

//   standardHeaders: true,

//   legacyHeaders: false,


  

//   message: {
//     success: false,
//     message:
//       "Too many requests, please try again later.",
//   },
// });



// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 1000,

//   handler: (req, res) => {
//     console.log(
//       "Rate limit hit =>",
//       req.method,
//       req.originalUrl,
//       req.ip
//     );

//     return res.status(429).json({
//       success: false,
//       message: "Too many requests, please try again later.",
//     });
//   },
// });

// // AUTH LIMITER

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,

//   max: 20,

//   standardHeaders: true,

//   legacyHeaders: false,

//   message: {
//     success: false,
//     message:
//       "Too many auth attempts. Try again later.",
//   },
// });

// // LIVEKIT LIMITER

// const livekitLimiter = rateLimit({
//   windowMs: 1 * 60 * 1000,

//   max: 30,

//   standardHeaders: true,

//   legacyHeaders: false,

//   message: {
//     success: false,
//     message:
//       "Too many video consultation requests.",
//   },
// });

// // PAYMENT LIMITER

// const paymentLimiter = rateLimit({
//   windowMs: 5 * 60 * 1000,

//   max: 10,

//   standardHeaders: true,

//   legacyHeaders: false,

//   message: {
//     success: false,
//     message:
//       "Too many payment requests.",
//   },
// });

// module.exports = {
//   globalLimiter,
//   authLimiter,
//   livekitLimiter,
//   paymentLimiter,
// };

const rateLimit = require("express-rate-limit");

// Auth (IP based)
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

// Authenticated APIs (User ID based)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,

  // keyGenerator: (req) => String(req.user?.id),
  keyGenerator: (req) => String(req.user.id),

  handler: (req, res) => {
    console.log(
      "Rate limit hit =>",
      req.user?.id,
      req.method,
      req.originalUrl
    );

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
});

module.exports = {
  authLimiter,
  apiLimiter,
  paymentLimiter,
};