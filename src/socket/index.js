const { Server } = require("socket.io");

let io = null;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://yodoctor.in",
            "https://www.yodoctor.in",
          ],
      credentials: true,
      methods: ["GET", "POST"],
    },

    transports: ["websocket", "polling"],

    pingTimeout: 60000,
    pingInterval: 25000,

    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO is not initialized");
  }

  return io;
};

module.exports = {
  initializeSocket,
  getIO,
};