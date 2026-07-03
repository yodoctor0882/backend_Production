const { getIO } = require("./index");

class SocketManager {
  /**
   * Send event to a specific user
   */
  toUser(userId, event, payload) {
    try {
      const io = getIO();

      io.to(`user:${userId}`).emit(event, payload);
    } catch (err) {
      console.error("[SocketManager][toUser]", err.message);
    }
  }

  /**
   * Send event to a specific doctor
   */
  toDoctor(doctorId, event, payload) {
    try {
      const io = getIO();

      io.to(`doctor:${doctorId}`).emit(event, payload);
    } catch (err) {
      console.error("[SocketManager][toDoctor]", err.message);
    }
  }

  /**
   * Send event to all admins
   */
  toAdmins(event, payload) {
    try {
      const io = getIO();

      io.to("role:ADMIN").emit(event, payload);
    } catch (err) {
      console.error("[SocketManager][toAdmins]", err.message);
    }
  }

  /**
   * Send event to a role
   */
  toRole(role, event, payload) {
    try {
      const io = getIO();

      io.to(`role:${role}`).emit(event, payload);
    } catch (err) {
      console.error("[SocketManager][toRole]", err.message);
    }
  }

  /**
   * Send event to custom room
   */
  toRoom(room, event, payload) {
    try {
      const io = getIO();

      io.to(room).emit(event, payload);
    } catch (err) {
      console.error("[SocketManager][toRoom]", err.message);
    }
  }

  toPatient(patientId, event, payload) {
    try {
      const io = getIO();
      io.to(`patient:${patientId}`).emit(event, payload);
    } catch (err) {
      console.error("[SocketManager][toPatient]", err.message);
    }
  }

  toClinic(clinicId, event, payload) {
    try {
      const io = getIO();
      io.to(`clinic:${clinicId}`).emit(event, payload);
    } catch (err) {
      console.error("[SocketManager][toClinic]", err.message);
    }
  }

  toQueue(doctorId, event, payload) {
    try {
      const io = getIO();
      io.to(`queue:${doctorId}`).emit(event, payload);
    } catch (err) {
      console.error("[SocketManager][toQueue]", err.message);
    }
  }

  

  /**
   * Broadcast to all connected users
   */
  broadcast(event, payload) {
    try {
      const io = getIO();

      io.emit(event, payload);
    } catch (err) {
      console.error("[SocketManager][broadcast]", err.message);
    }
  }
}

module.exports = new SocketManager();
