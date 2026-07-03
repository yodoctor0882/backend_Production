const db = require("../config/db");

const createNotification = async ({
  receiverId,
  receiverRole,
  title,
  message,
  appointmentId = null,
}) => {
  try {
    await db.query(
      `INSERT INTO notifications
       (receiver_id, receiver_role, title, message, appointment_id)
       VALUES (?, ?, ?, ?, ?)`,
      [receiverId, receiverRole, title, message, appointmentId]
    );

    console.log("🔔 Notification inserted");
  } catch (err) {
    console.error("❌ Notification insert failed:", err.message);
    // ❗ DO NOT throw → API should never fail because of notification
  }
};

module.exports = { createNotification };
