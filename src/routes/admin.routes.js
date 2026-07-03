const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");

const { verifyToken } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roles");
const { requireActiveUser } = require("../middleware/activeUser");

const upload = require("../middleware/upload.middleware");

const uploadLabImage = require("../middleware/uploadLabImage");

// Dashboard
router.get(
  "/dashboard",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getDashboard,
);

// Doctors list
router.get(
  "/doctors",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getDoctors,
);

// Doctor details
router.get(
  "/doctors/:id",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getDoctorDetails,
);

// Doctor documents
router.get(
  "/doctors/:id/documents",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getDoctorVerification,
);

// Verify / Reject document
router.put(
  "/doctors/:id/documents/verify",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.verifyDoctorDocument,
);

// Verify doctor account
router.put(
  "/doctors/:id/verify",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.verifyDoctorAccount,
);

// Change doctor status
router.put(
  "/doctors/:id/status",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.updateDoctorStatus,
);

// Notifications
router.get(
  "/notifications",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getAdminNotifications,
);

router.get(
  "/analytics/appointments",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getAppointmentAnalytics,
);

// Admin notifications mark as read
router.put(
  "/notifications/:id/read",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.markNotificationRead,
);

router.get(
  "/contact-requests",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.getAllContactRequests,
);

router.put(
  "/contact-requests/:id",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.updateContactStatus,
);

router.delete(
  "/contact-requests/:id",
  verifyToken,
  requireActiveUser,
  allowRoles("ADMIN"),
  adminController.deleteContactRequest,
);




router.post(
  "/lab/tests",
  verifyToken,
  allowRoles("ADMIN"),
  uploadLabImage.single("image"),
  adminController.addLabTest,
);

router.get(
  "/lab/tests",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.getLabTests,
);

router.get(
  "/lab/tests/:id",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.getLabTestById,
);

router.put(
  "/lab/tests/:id",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.updateLabTest,
);



router.post(
  "/lab/packages",
  verifyToken,
  allowRoles("ADMIN"),
  uploadLabImage.single("image"),
  adminController.addLabPackage,
);

router.get(
  "/lab/packages",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.getLabPackages,
);

router.get(
  "/lab/packages/:id",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.getLabPackageById,
);

router.put(
  "/lab/packages/:id",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.updateLabPackage,
);


router.get(
  "/lab/bookings",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.getAllLabBookings,
);

router.get(
  "/lab/bookings/:bookingId",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.getAdminLabBookingDetails,
);

router.put(
  "/lab/bookings/:bookingId/status",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.updateLabBookingStatus,
);

router.post(
  "/lab/bookings/:bookingId/report",
  verifyToken,
  allowRoles("ADMIN"),
  upload.single("report"),
  adminController.uploadLabReport,
);

router.get(
  "/lab/bookings/:bookingId/report",
  verifyToken,
  adminController.getLabReport,
);

// Update Test Status
router.patch(
  "/lab/tests/:id/status",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.updateTestStatus
);

// Update Package Status
router.patch(
  "/lab/packages/:id/status",
  verifyToken,
  allowRoles("ADMIN"),
  adminController.updatePackageStatus
);
module.exports = router;
