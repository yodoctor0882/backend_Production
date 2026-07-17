const router = require("express").Router();
const { verifyToken } = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");


router.get(
  "/",
  verifyToken,
  notificationController.getNotifications,
);

router.get(
  "/unread-count",
  verifyToken,
  notificationController.getUnreadNotificationCount,
);

router.put(
  "/:id/read",
  verifyToken,
  notificationController.markNotificationRead,
);

router.put(
  "/read-all",
  verifyToken,
  notificationController.markAllNotificationsRead,
);

module.exports = router;
