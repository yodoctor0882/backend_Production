// const { getIO } = require("./index");

// class SocketManager {
//   /**
//    * Send event to a specific user
//    */
//   toUser(userId, event, payload) {
//     try {
//       const io = getIO();

//       io.to(`user:${userId}`).emit(event, payload);
//     } catch (err) {
//       console.error("[SocketManager][toUser]", err.message);
//     }
//   }

//   /**
//    * Send event to a specific doctor
//    */
//   toDoctor(doctorId, event, payload) {
//     try {
//       const io = getIO();

//       io.to(`doctor:${doctorId}`).emit(event, payload);
//     } catch (err) {
//       console.error("[SocketManager][toDoctor]", err.message);
//     }
//   }

//   /**
//    * Send event to all admins
//    */
//   toAdmins(event, payload) {
//     try {
//       const io = getIO();

//       io.to("role:ADMIN").emit(event, payload);
//     } catch (err) {
//       console.error("[SocketManager][toAdmins]", err.message);
//     }
//   }

//   /**
//    * Send event to a role
//    */
//   toRole(role, event, payload) {
//     try {
//       const io = getIO();

//       io.to(`role:${role}`).emit(event, payload);
//     } catch (err) {
//       console.error("[SocketManager][toRole]", err.message);
//     }
//   }

//   /**
//    * Send event to custom room
//    */
//   toRoom(room, event, payload) {
//     try {
//       const io = getIO();

//       io.to(room).emit(event, payload);
//     } catch (err) {
//       console.error("[SocketManager][toRoom]", err.message);
//     }
//   }

//   toPatient(patientId, event, payload) {
//     try {
//       const io = getIO();
//       io.to(`patient:${patientId}`).emit(event, payload);
//     } catch (err) {
//       console.error("[SocketManager][toPatient]", err.message);
//     }
//   }

//   toClinic(clinicId, event, payload) {
//     try {
//       const io = getIO();
//       io.to(`clinic:${clinicId}`).emit(event, payload);
//     } catch (err) {
//       console.error("[SocketManager][toClinic]", err.message);
//     }
//   }

//   toQueue(doctorId, event, payload) {
//     try {
//       const io = getIO();
//       io.to(`queue:${doctorId}`).emit(event, payload);
//     } catch (err) {
//       console.error("[SocketManager][toQueue]", err.message);
//     }
//   }

//   /**
//    * Broadcast to all connected users
//    */
//   broadcast(event, payload) {
//     try {
//       const io = getIO();

//       io.emit(event, payload);
//     } catch (err) {
//       console.error("[SocketManager][broadcast]", err.message);
//     }
//   }
// }

// module.exports = new SocketManager();

const toUser = (userId, eventName, payload) => {
  if (!userId) {
    console.error("[SocketManager][toUser] userId is required");
    return false;
  }

  if (!eventName) {
    console.error("[SocketManager][toUser] eventName is required");
    return false;
  }

  try {
    /*
     * Require getIO only when the function executes.
     * Do not call getIO at module-import time.
     */
    const { getIO } = require("./index");

    const io = getIO();
    const roomName = `user:${userId}`;

    io.to(roomName).emit(eventName, payload);

    console.log(
      `[SocketManager][toUser] Event "${eventName}" emitted to ${roomName}`,
    );

    return true;
  } catch (error) {
    console.error(`[SocketManager][toUser] ${error.message}`);

    return false;
  }
};

const toRoom = (roomName, eventName, payload) => {
  if (!roomName || !eventName) {
    return false;
  }

  try {
    const { getIO } = require("./index");

    const io = getIO();

    io.to(roomName).emit(eventName, payload);

    return true;
  } catch (error) {
    console.error(`[SocketManager][toRoom] ${error.message}`);

    return false;
  }
};

const broadcast = (eventName, payload) => {
  if (!eventName) {
    return false;
  }

  try {
    const { getIO } = require("./index");

    const io = getIO();

    io.emit(eventName, payload);

    return true;
  } catch (error) {
    console.error(`[SocketManager][broadcast] ${error.message}`);

    return false;
  }
};

module.exports = {
  toUser,
  toRoom,
  broadcast,
};
