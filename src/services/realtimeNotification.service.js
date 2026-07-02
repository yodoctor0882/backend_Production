const socketManager = require("../socket/socketManager");

const sendRealtimeNotification = ({
  userId,
  role,
  title,
  message,
  type = "notification",
  data = {},
}) => {
  try {
    const payload = {
      title,
      message,
      role,
      type,
      is_read: false,
      createdAt: new Date().toISOString(),
      ...data,
    };

    if (userId) {
      socketManager.toUser(userId, type, payload);
    }

    if (role) {
      socketManager.toRole(role.toUpperCase(), type, payload);
    }
  } catch (error) {
    console.error("[Realtime Notification Error]", error);
  }
};

module.exports = {
  sendRealtimeNotification,
};