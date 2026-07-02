const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const { allowRoles } = require("../middleware/roles");
const { requireActiveUser } = require("../middleware/activeUser");

const certificateController = require("../controllers/certificateController");
const uploadCertificateDocs = require("../middleware/uploadCertificateDocs");

/* ================= PATIENT APIs ================= */

// Create request
router.post(
  "/create",
  verifyToken,
  requireActiveUser,
  certificateController.createRequest
);

// Upload documents
router.post(
  "/upload",
  verifyToken,
  requireActiveUser,
  uploadCertificateDocs.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "idProof", maxCount: 1 },
    { name: "medicalReports", maxCount: 1 },
    { name: "prescription", maxCount: 1 },
  ]),
  certificateController.uploadDocument
);

// Get all certificates of logged-in patient
router.get(
  "/my-requests",
  verifyToken,
  requireActiveUser,
  certificateController.getMyRequests
);

// Download approved certificate
router.get(
  "/download/:id",
  verifyToken,
  requireActiveUser,
  certificateController.downloadCertificate
);


/* ================= DOCTOR APIs ================= */

// Get all certificate requests for doctor
router.get(
  "/requests",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  certificateController.getDoctorRequests
);

// Get request details for doctor
router.get(
  "/requests/:id",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  certificateController.getRequestByIdForDoctor
);

// Get uploaded documents
router.get(
  "/documents/:id",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  certificateController.getDocumentsByRequestId
);

// Approve certificate
router.put(
  "/approve/:id",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  certificateController.approveRequest
);

// Reject certificate
router.put(
  "/reject/:id",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  certificateController.rejectRequest
);

// Get issued certificates
router.get(
  "/issued",
  verifyToken,
  requireActiveUser,
  allowRoles("DOCTOR"),
  certificateController.getIssuedCertificates
);


/* ================= PUBLIC API ================= */

// Verify certificate via QR code
router.get(
  "/verify/:certificateId",
  certificateController.verifyCertificate
);


/* ================= GENERIC ROUTE (ALWAYS LAST) ================= */

// Get certificate details by ID (Patient)
router.get(
  "/:id",
  verifyToken,
  requireActiveUser,
  certificateController.getRequestById
);

module.exports = router;