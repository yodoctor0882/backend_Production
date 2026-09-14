const db = require("../config/db");

exports.requireActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const [rows] = await db.query(
      `
      SELECT id
      FROM subscriptions
      WHERE user_id = ?
        AND status = 'active'
        AND current_period_end IS NOT NULL
        AND current_period_end > NOW()
      LIMIT 1
      `,
      [userId],
    );

    if (!rows.length) {
      return res.status(403).json({
        code: "SUBSCRIPTION_REQUIRED",
        message:
          "Your subscription has expired or is not active. Please activate a subscription to use Manual Booking.",
      });
    }

    next();
  } catch (err) {
    console.error("requireActiveSubscription error:", err);

    return res.status(500).json({
      message: "Failed to verify subscription",
    });
  }
};
