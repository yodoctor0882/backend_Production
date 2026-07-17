const { Server } = require("socket.io");

let io = null;

const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "https://yodoctor.in",
    "https://www.yodoctor.in",
  ];
};

const initializeSocket = (httpServer) => {
  if (!httpServer) {
    throw new Error("HTTP server is required to initialize Socket.IO");
  }

  if (io) {
    return io;
  }

  const allowedOrigins = getAllowedOrigins();

  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        // Mobile app, Postman or server-to-server request
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.error(`[Socket.IO CORS] Blocked origin: ${origin}`);

        return callback(new Error("Socket.IO origin is not allowed"));
      },

      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Authorization", "Content-Type"],
    },

    transports: ["websocket", "polling"],

    pingTimeout: 60000,
    pingInterval: 25000,

    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Connected: ${socket.id}`);

    /*
     * Temporary room joining method.
     * Later replace this with JWT-authenticated room joining.
     */
    socket.on("join-user-room", (userId) => {
      if (!userId) {
        console.warn(`[Socket.IO] Missing userId from socket ${socket.id}`);
        return;
      }

      const normalizedUserId = String(userId).trim();

      if (!normalizedUserId) {
        return;
      }

      const roomName = `user:${normalizedUserId}`;

      socket.join(roomName);

      console.log(`[Socket.IO] Socket ${socket.id} joined ${roomName}`);

      socket.emit("user-room-joined", {
        success: true,
        room: roomName,
      });
    });

    socket.on("leave-user-room", (userId) => {
      if (!userId) {
        return;
      }

      const roomName = `user:${String(userId).trim()}`;

      socket.leave(roomName);

      console.log(`[Socket.IO] Socket ${socket.id} left ${roomName}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`[Socket.IO] Error for ${socket.id}:`, error);
    });
  });

  console.log("✅ Socket.IO server initialized with origins:", allowedOrigins);

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO is not initialized");
  }

  return io;
};

const isSocketInitialized = () => {
  return io !== null;
};

module.exports = {
  initializeSocket,
  getIO,
  isSocketInitialized,
};
