const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");

const { verifyToken } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roles");
const { requireActiveUser } = require("../middleware/activeUser");
const upload = require("../middleware/upload.middleware");

// Auth
router.post("/register", patientController.register);

// Profile
router.get("/getprofile", verifyToken, patientController.getProfile);
router.put("/updateProfile", verifyToken, patientController.updateProfile);
router.put("/change-password", verifyToken, patientController.changePassword);

// Dashboard
router.get(
  "/dashboard",
  verifyToken,
  requireActiveUser,
  allowRoles("PATIENT"),
  patientController.getDashboard,
);

// Search & filters
router.get("/visit/doctors", verifyToken, patientController.searchVisitDoctors);
router.get("/visit/doctors/:id", verifyToken, patientController.getDoctorById);
router.get("/cities", patientController.getCities);
router.get("/diseases", patientController.getDiseases);
router.get("/clinicname", patientController.getPlaceNames);
router.get("/doctorname", patientController.getDoctorNames);

// Booking
router.post(
  "/visit/appointments",
  verifyToken,
  patientController.bookVisitAppointment,
);
router.get(
  "/getclinicvisit/appointments",
  verifyToken,
  patientController.getClinicAppointments,
);

router.get("/current-token", verifyToken, patientController.getCurrentToken);

router.put(
  "/visit/appointments/:id/cancel",
  verifyToken,
  patientController.cancelAppointment,
);
router.get(
  "/visit/appointments/history",
  verifyToken,
  patientController.getVisitAppointmentHistory,
);

router.post("/visit/qr-book", verifyToken, patientController.qrBookVisit);
router.get(
  "/visit/token-status/:appointmentId",
  verifyToken,
  patientController.getTokenStatus,
);

router.get(
  "/appointments/upcoming",
  verifyToken,
  patientController.getUpcomingAppointments,
);

router.post(
  "/doctor-feedback",
  verifyToken,
  allowRoles("PATIENT"),
  patientController.submitDoctorReview,
);

// Notifications
router.get(
  "/notifications",
  verifyToken,
  patientController.getPatientNotifications,
);

// ✅ PEHLE specific route — unread-count
router.get(
  "/notifications/unread-count",
  verifyToken,
  patientController.getUnreadNotificationCount,
);

// ✅ BAAD MEIN dynamic :id route
router.put(
  "/notifications/:id/read",
  verifyToken,
  patientController.markNotificationRead,
);

// Family
router.post("/addfamily", verifyToken, patientController.addFamilyMember);
router.get("/getfamily", verifyToken, patientController.getFamilyMembers);

router.put(
  "/updatefamily/:id",
  verifyToken,
  patientController.updateFamilyMember,
);
router.delete(
  "/deletefamily/:id",
  verifyToken,
  patientController.deleteFamilyMember,
);

router.get(
  "/appointments/:id/summary",
  verifyToken,
  allowRoles("PATIENT"),
  patientController.getVisitSummary,
);

router.get(
  "/appointments/:appointmentId/prescription",
  verifyToken,
  allowRoles("PATIENT"),
  patientController.getPrescription,
);

// ✅ POST API
router.post("/bookhomecare", patientController.bookhomecareservices);

// ✅ GET API
router.get("/getbookhomecare", patientController.getbookhomecareservices);



// Lab Categories
router.get("/lab/categories", patientController.getCategories);

// All Tests
router.get("/lab/tests", patientController.getTests);

// Popular Tests
router.get("/lab/tests/popular", patientController.getPopularTests);

// Packages
router.get("/lab/packages", patientController.getPackages);

// Single Test Details
router.get("/lab/tests/:id", patientController.getTestDetails);

// Create Booking
router.post("/lab-bookings", verifyToken, patientController.createBooking);

// My Lab Bookings
router.get("/lab-bookings", verifyToken, patientController.getLabBookings);

// Single Booking Details
router.get(
  "/lab-bookings/:bookingId",
  verifyToken,
  patientController.getLabBookingDetails,
);

module.exports = router;
