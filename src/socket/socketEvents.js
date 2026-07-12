// const socketAuth = require("./socketAuth");

// const registerSocketEvents = (io) => {
//   // JWT Authentication
//   io.use(socketAuth);

//   io.on("connection", (socket) => {
//     console.log("✅ Connected:", socket.user.id, socket.user.role);

//     socket.emit("socket-ready", {
//       success: true,
//       message: "Socket Connected Successfully",
//     });

//     const { id, role } = socket.user;

//     console.log(
//       `✅ Socket Connected : ${socket.id} | User : ${id} | Role : ${role}`,
//     );

//     // ================= USER ROOM =================

//     socket.join(`user:${id}`);

//     // ================= ROLE ROOM =================

//     if (role) {
//       socket.join(`role:${role}`);
//     }

//     // ================= DOCTOR ROOM =================

//     if (role === "DOCTOR") {
//       socket.join(`doctor:${id}`);
//     }

//     // ================= PATIENT ROOM =================

//     if (role === "PATIENT") {
//       socket.join(`patient:${id}`);
//     }

//     // ================= ADMIN ROOM =================

//     if (role === "ADMIN") {
//       socket.join("admins");
//       socket.join("role:ADMIN");
//     }

//     // ================= PING =================

//     socket.on("ping-server", () => {
//       socket.emit("pong-server", {
//         success: true,
//         timestamp: Date.now(),
//       });
//     });

//     // ================= DISCONNECT =================

//     socket.on("disconnect", (reason) => {
//       console.log(`❌ Socket Disconnected : ${socket.id} | Reason : ${reason}`);
//     });

//     // ================= ERROR =================

//     socket.on("error", (error) => {
//       console.error("[SOCKET ERROR]", error);
//     });
//   });
// };

// module.exports = registerSocketEvents;

const socketAuth = require("./socketAuth");

const registerSocketEvents = (io) => {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const { id, role } = socket.user;

    console.log(
      `✅ Socket connected: ${socket.id} | User: ${id} | Role: ${role}`,
    );

    socket.join(`user:${id}`);

    if (role) {
      socket.join(`role:${role}`);
    }

    if (role === "DOCTOR") {
      socket.join(`doctor:${id}`);
      socket.join(`queue:${id}`);
    }

    if (role === "PATIENT") {
      socket.join(`patient:${id}`);
    }

    if (role === "ADMIN") {
      socket.join("admins");
    }

    socket.emit("socket-ready", {
      success: true,
      message: "Socket connected successfully",
      socketId: socket.id,
    });

    socket.on("join-clinic", (clinicId) => {
      if (!clinicId) {
        return;
      }

      /*
       * Important:
       * Validate from the database that this user is allowed
       * to join the requested clinic before joining.
       */
      socket.join(`clinic:${clinicId}`);

      console.log(`User ${id} joined clinic room clinic:${clinicId}`);
    });

    socket.on("ping-server", () => {
      socket.emit("pong-server", {
        success: true,
        timestamp: Date.now(),
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error("[SOCKET ERROR]", error);
    });
  });
};

module.exports = registerSocketEvents;
