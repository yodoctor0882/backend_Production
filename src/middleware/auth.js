// const jwt = require("jsonwebtoken");
// const { unauthorized, forbidden } = require("../utils/response");
// const { apiLimiter } = require("./rateLimit");

// // ================= VERIFY TOKEN =================

// const verifyToken = (req, res, next) => {
//   try {
//     // Authorization header
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       return unauthorized(res, "Authorization header missing");
//     }

//     // Split Bearer token
//     const [type, token] = authHeader.split(" ");

//     if (type !== "Bearer" || !token) {
//       return unauthorized(res, "Invalid authorization format");
//     }

//     // Verify JWT
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // Attach user
//     req.user = {
//       id: decoded.id,
//       role: decoded.role,
//       email: decoded.email,
//       name: decoded.name,
//     };
// return apiLimiter(req, res, next);

//   } catch (err) {
//     console.error("[AUTH ERROR]", err);

//     if (err.name === "TokenExpiredError") {
//       return unauthorized(res, "Token expired");
//     }

//     return unauthorized(res, "Invalid token");
//   }
// };

// // ================= ROLE MIDDLEWARE =================

// const allowRoles = (...allowedRoles) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return unauthorized(res, "Unauthorized");
//     }

//     if (!allowedRoles.includes(req.user.role)) {
//       return forbidden(res, "Access denied");
//     }

//     next();
//   };
// };

// module.exports = {
//   verifyToken,
//   allowRoles,
// };

const jwt = require("jsonwebtoken");
const { unauthorized, forbidden } = require("../utils/response");
const { apiLimiter } = require("./rateLimit");

// ================= VERIFY TOKEN =================

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return unauthorized(res, "Authorization header missing");
    }

    const [type, token] = authHeader.trim().split(/\s+/);

    if (type !== "Bearer" || !token) {
      return unauthorized(res, "Invalid authorization format");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id) {
      return unauthorized(res, "Invalid token payload");
    }

    req.user = {
      id: decoded.id,
      role: decoded.role?.trim().toUpperCase(),
      email: decoded.email,
      name: decoded.name,
    };

    return next();
  } catch (err) {
    console.error("[AUTH ERROR]", err);

    if (err.name === "TokenExpiredError") {
      return unauthorized(res, "Token expired");
    }

    return unauthorized(res, "Invalid token");
  }
};

// ================= ROLE MIDDLEWARE =================

const allowRoles = (...allowedRoles) => {
  const normalizedRoles = allowedRoles.map((role) =>
    role.trim().toUpperCase(),
  );

  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, "Unauthorized");
    }

    const userRole = req.user.role?.trim().toUpperCase();

    if (!normalizedRoles.includes(userRole)) {
      return forbidden(res, "Access denied");
    }

    return next();
  };
};

module.exports = {
  verifyToken,
  allowRoles,
};