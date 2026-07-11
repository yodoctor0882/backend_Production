const db = require("../config/db");

// // GET /notifications/my-notifications
// exports.getMyNotifications = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const [notifications] = await db.query(
//       "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
//       [userId]
//     );

//     res.json({
//       success: true,
//       data: notifications,
//     });
//   } catch (error) {
//     console.error("Error fetching notifications:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch notifications",
//     });
//   }
// };

// GET /notifications

const getUserRole = (req) => {
  const role = (req.user.role || "").toUpperCase();

  const allowedRoles = ["PATIENT", "DOCTOR", "ADMIN"];

  if (!allowedRoles.includes(role)) {
    const error = new Error("Invalid role");
    error.status = 403;
    throw error;
  }

  return role;
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = getUserRole(req);

    let query = `
      SELECT id, title, message, appointment_id, is_read, created_at
      FROM notifications
      WHERE receiver_role = ?
    `;

    const params = [role];

    if (role !== "ADMIN") {
      query += " AND receiver_id = ?";
      params.push(userId);
    }

    query += " ORDER BY created_at DESC";

    const [notifications] = await db.query(query, params);

    return res.status(200).json({
      success: true,
      notifications,
    });
  } catch (err) {
    console.error(err);

    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

// GET /notifications/unread-count

exports.getUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = getUserRole(req);

    let query = `
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE receiver_role = ?
      AND is_read = FALSE
    `;

    const params = [role];

    if (role !== "ADMIN") {
      query += " AND receiver_id = ?";
      params.push(userId);
    }

    const [[row]] = await db.query(query, params);

    return res.status(200).json({
      success: true,
      unreadCount: row.count,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

// PUT /notifications/:id/read

exports.markNotificationRead = async (req, res) => {
  const { id } = req.params;

  try {
    const userId = req.user.id;
    const role = getUserRole(req);

    let query = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = ?
      AND receiver_role = ?
    `;

    const params = [id, role];

    if (role !== "ADMIN") {
      query += " AND receiver_id = ?";
      params.push(userId);
    }

    query += " AND is_read = FALSE";

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or already read",
      });
    }

return res.status(200).json({
  success: true,
  message: "Notification marked as read",
});
  } catch (err) {
    console.error(err);

    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

// PUT /notifications/read-all

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = getUserRole(req);

    let query = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE receiver_role = ?
      AND is_read = FALSE
    `;

    const params = [role];

    if (role !== "ADMIN") {
      query += " AND receiver_id = ?";
      params.push(userId);
    }

    await db.query(query, params);

return res.status(200).json({
  success: true,
  message: "All notifications marked as read",
});
  } catch (err) {
    console.error(err);

    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};
