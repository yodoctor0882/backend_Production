const jwt = require("jsonwebtoken");

const socketAuth = (socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;

    const authorizationHeader = socket.handshake.headers?.authorization;

    const bearerToken = authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice(7)
      : null;

    const token = authToken || bearerToken;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id || !decoded.role) {
      return next(new Error("Invalid token payload"));
    }

    socket.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
    };

    return next();
  } catch (error) {
    console.error("[SOCKET AUTH ERROR]", error.message);

    return next(new Error("Invalid or expired token"));
  }
};

module.exports = socketAuth;
