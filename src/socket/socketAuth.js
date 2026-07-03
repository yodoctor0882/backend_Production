const jwt = require("jsonwebtoken");

const socketAuth = (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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