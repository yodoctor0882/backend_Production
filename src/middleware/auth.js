

// // const jwt = require("jsonwebtoken");

// // exports.verifyToken = (req, res, next) => {
// //   const authHeader = req.headers.authorization;

// //   if (!authHeader) {
// //     return res.status(401).json({ message: "Authorization header missing" });
// //   }

// //   const [type, token] = authHeader.split(" ");

// //   if (type !== "Bearer" || !token) {
// //     return res.status(401).json({ message: "Invalid authorization format" });
// //   }

// //   try {
// //     const decoded = jwt.verify(token, process.env.JWT_SECRET);

// //     req.user = {
// //       id: decoded.id,
// //       role: decoded.role,
// //     };

// //     next();
// //   } catch (err) {
// //     if (err.name === "TokenExpiredError") {
// //       return res.status(401).json({ message: "Token expired" });
// //     }

// //     return res.status(401).json({ message: "Invalid token" });
// //   }
// // };

// // // ✅ FIXED: removed duplicate definition that was overwriting this one.
// // // This version correctly returns 401 when req.user is missing,
// // // and 403 when the role is not allowed.
// // exports.allowRoles = (...allowedRoles) => {
// //   return (req, res, next) => {
// //     if (!req.user) {
// //       return res.status(401).json({ message: "Unauthorized" });
// //     }

// //     if (!allowedRoles.includes(req.user.role)) {
// //       return res.status(403).json({ message: "Access denied" });
// //     }

// //     next();
// //   };
// // };




// const jwt = require("jsonwebtoken");

// const verifyToken = (
//   req,
//   res,
//   next,
// ) => {
//   try {
//     const authHeader =
//       req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({
//         success: false,
//         message:
//           "Authorization header missing",
//       });
//     }

//     const [type, token] =
//       authHeader.split(" ");

//     if (
//       type !== "Bearer" ||
//       !token
//     ) {
//       return res.status(401).json({
//         success: false,
//         message:
//           "Invalid authorization format",
//       });
//     }

//     const decoded = jwt.verify(
//       token,
//       process.env.JWT_SECRET,
//     );

//     req.user = {
//       id: decoded.id,
//       role: decoded.role,
//     };

//     next();
//   } catch (error) {
//     if (
//       error.name ===
//       "TokenExpiredError"
//     ) {
//       return res.status(401).json({
//         success: false,
//         message: "Token expired",
//       });
//     }

//     return res.status(401).json({
//       success: false,
//       message: "Invalid token",
//     });
//   }
// };

// const allowRoles = (
//   ...allowedRoles
// ) => {
//   return (
//     req,
//     res,
//     next,
//   ) => {
//     if (!req.user) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized",
//       });
//     }

//     if (
//       !allowedRoles.includes(
//         req.user.role,
//       )
//     ) {
//       return res.status(403).json({
//         success: false,
//         message: "Access denied",
//       });
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

// ================= VERIFY TOKEN =================

const verifyToken = (req, res, next) => {
  try {
    // Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return unauthorized(res, "Authorization header missing");
    }

    // Split Bearer token
    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
      return unauthorized(res, "Invalid authorization format");
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
    };

    next();
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
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, "Unauthorized");
    }

    if (!allowedRoles.includes(req.user.role)) {
      return forbidden(res, "Access denied");
    }

    next();
  };
};

module.exports = {
  verifyToken,
  allowRoles,
};