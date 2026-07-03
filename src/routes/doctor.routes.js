console.log("✅ doctor.routes loaded");

const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");
const { verifyToken } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roles");
const { requireActiveUser } = require("../middleware/activeUser");
const upload = require("../middleware/upload.middleware");
const uploadDoctorDocs = require("../middleware/uploadDoctorDocs");

router.get("/test123", (req, res) => {
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────
router.get(
  "/dashboard",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDashboard,
);

// ─────────────────────────────────────────
// Profile
// ─────────────────────────────────────────
router.get(
  "/profile",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDoctorProfile,
);

// ✅ ADDED: PUT /doctor/profile — was missing, frontend useDoctorProfile hook calls this
router.put(
  "/profile",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.updateDoctorProfile,
);

// ─────────────────────────────────────────
// Availability
// ─────────────────────────────────────────
router.put(
  "/availability",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.updateClinicStatus,
);

// ─────────────────────────────────────────
// QR
// ─────────────────────────────────────────
router.get(
  "/my-qr",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getMyQR,
);

// ─────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────
router.get(
  "/reviews",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDoctorReviews,
);

// ─────────────────────────────────────────
// Manual Booking
// ─────────────────────────────────────────
router.post(
  "/manualbooking",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.manualVisitBooking,
);

// ─────────────────────────────────────────
// Get Doctor By ID (for PATIENT)
// ─────────────────────────────────────────
router.get(
  "/getDoctorById/:id",
  verifyToken,
  allowRoles("PATIENT"),
  doctorController.getDoctorById,
);

// ─────────────────────────────────────────
// Respond to Appointment
// ─────────────────────────────────────────
router.put(
  "/respond-appointment/:id",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.respondAppointment,
);

// ─────────────────────────────────────────
// Notifications
// ✅ FIX: Specific routes PEHLE, :id wala BAAD MEIN
// ─────────────────────────────────────────
router.get(
  "/notifications/unread-count", // ✅ specific — pehle
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDoctorUnreadCount,
);

router.put(
  "/notifications/read-all", // ✅ specific — pehle
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.markAllDoctorNotificationsRead,
);

router.get(
  "/notifications",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getDoctorNotifications,
);

router.put(
  "/notifications/:id/read", // ✅ dynamic — baad mein
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.markDoctorNotificationRead,
);

// ─────────────────────────────────────────
// Appointments
// ✅ FIX: Specific routes PEHLE, :id wala BAAD MEIN
// ─────────────────────────────────────────

// ✅ Specific GET routes — pehle
router.get(
  "/appointments/incoming",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getIncomingAppointments,
);

router.get(
  "/appointments/today-queue",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getTodayQueue,
);

router.get(
  "/appointments/current-token",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  doctorController.getCurrentAppointment,
);

router.get(
  "/appointments/next",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getNextAppointment,
);

router.get(
  "/appointments/history",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  doctorController.getDoctorAppointmentHistory,
);

router.get(
  "/appointments/carry-forward", // ✅ specific — pehle
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getCarryForwardAppointments,
);

// ✅ Specific PUT routes — pehle
router.put(
  "/appointments/auto-accept", // ✅ specific — pehle
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.autoAcceptAllAppointments,
);

router.put(
  "/appointments/noShow", // ✅ specific — pehle
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.markNoShow,
);

router.put(
  "/appointments/carry-forward", // ✅ specific — pehle
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.carryForwardRemaining,
);

router.put(
  "/appointments/cancel-remaining", // ✅ specific — pehle
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.cancelRemainingAppointments,
);

router.put(
  "/appointments/recall/:id", // ✅ specific pattern — pehle
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.recallSkippedPatient,
);

// ✅ POST specific — pehle
router.post(
  "/appointments/next-token",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  doctorController.callNextToken,
);

// ✅ Dynamic :id routes — BAAD MEIN
router.put(
  "/appointments/:id/start", // ✅ dynamic — baad mein
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.startAppointment,
);

router.put(
  "/appointments/:id/skip", // ✅ dynamic — baad mein
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.skipAppointment,
);

router.post(
  "/appointments/:id/summary", // ✅ dynamic — baad mein
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.addVisitSummary,
);

router.post(
  "/appointments/:id/prescription", // ✅ dynamic — baad mein
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.addPrescription,
);

router.get(
  "/prescription/:id",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.getPrescription,
);

// ─────────────────────────────────────────
// Doctor Registration — Stepper
// ─────────────────────────────────────────
router.post("/register", doctorController.createStep1);

router.patch(
  "/registration/step-1",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.updateStep1,
);

router.patch(
  "/registration/step-2",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.registerStep2,
);

router.patch(
  "/registration/step-3",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.registerStep3,
);

router.patch(
  "/registration/step-4",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.registerStep4,
);

router.patch(
  "/registration/step-5",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.registerStep5,
);

router.patch(
  "/registration/step-6",
  verifyToken,
  allowRoles("DOCTOR"),
  uploadDoctorDocs,
  doctorController.registerStep6,
);

router.patch(
  "/registration/submit",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.finalSubmitRegistration,
);

router.post(
  "/download-qr",
  verifyToken,
  allowRoles("DOCTOR"),
  doctorController.downloadQR,
);

router.get("/alldoctors", doctorController.getAllDoctors);

module.exports = router;
