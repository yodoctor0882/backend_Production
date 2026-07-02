const db = require("../config/db");

// GET /notifications/my-notifications
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id; // verifyToken middleware se aata hai

    const [notifications] = await db.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};