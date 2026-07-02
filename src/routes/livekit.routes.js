const express = require("express");

const router = express.Router();

const { verifyToken, allowRoles } = require("../middleware/auth");

const {
  getLiveKitToken,
  createConsultation,
  endConsultation,
  getConsultationById,
  saveMessage,
  getMessages,
} = require("../controllers/livekit.controller");

// GET LIVEKIT TOKEN

router.post(
  "/get-token",
  verifyToken,
  allowRoles("DOCTOR", "PATIENT", "ADMIN"),
  getLiveKitToken,
);

// CREATE CONSULTATION

router.post(
  "/create-consultation",
  verifyToken,
  allowRoles("PATIENT"),
  createConsultation,
);

// END CONSULTATION

router.put(
  "/end-consultation/:consultationId",
  verifyToken,
  allowRoles("DOCTOR", "PATIENT"),
  endConsultation,
);

// GET CONSULTATION

router.get("/consultation/:consultationId", verifyToken, getConsultationById);

// SAVE MESSAGE

router.post("/save-message", verifyToken, saveMessage);

// GET MESSAGES

router.get("/messages/:consultationId", verifyToken, getMessages);

module.exports = router;
