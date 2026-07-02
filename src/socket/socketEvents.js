const socketAuth = require("./socketAuth");

const registerSocketEvents = (io) => {
  // JWT Authentication
  io.use(socketAuth);

  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.user.id, socket.user.role);

    socket.emit("socket-ready", {
      success: true,
      message: "Socket Connected Successfully",
    });
    
    const { id, role } = socket.user;

    console.log(
      `✅ Socket Connected : ${socket.id} | User : ${id} | Role : ${role}`,
    );

    // ================= USER ROOM =================

    socket.join(`user:${id}`);

    // ================= ROLE ROOM =================

    if (role) {
      socket.join(`role:${role}`);
    }

    // ================= DOCTOR ROOM =================

    if (role === "DOCTOR") {
      socket.join(`doctor:${id}`);
    }

    // ================= PATIENT ROOM =================

    if (role === "PATIENT") {
      socket.join(`patient:${id}`);
    }

    // ================= ADMIN ROOM =================

    if (role === "ADMIN") {
      socket.join("admins");
      socket.join("role:ADMIN");
    }

    // ================= PING =================

    socket.on("ping-server", () => {
      socket.emit("pong-server", {
        success: true,
        timestamp: Date.now(),
      });
    });

    // ================= DISCONNECT =================

    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket Disconnected : ${socket.id} | Reason : ${reason}`);
    });

    // ================= ERROR =================

    socket.on("error", (error) => {
      console.error("[SOCKET ERROR]", error);
    });
  });
};

module.exports = registerSocketEvents;
