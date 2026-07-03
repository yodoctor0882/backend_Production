const db = require("../config/db");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const eventBus = require("../events/eventBus");
const jwt = require("jsonwebtoken");
const puppeteer = require("puppeteer");
const QRCode = require("qrcode");
const generateQRHTML = require("../utils/qrTemplate");
const {
  APPOINTMENT_CONFIRMED,
  APPOINTMENT_REJECTED,
  APPOINTMENT_REMINDER,
} = require("../events/notification.events");

const upload = require("../middleware/upload.middleware");
const uploadDoctorDocs = require("../middleware/uploadDoctorDocs");

const { sendEmail } = require("../utils/email.service");
const { createNotification } = require("../utils/patientNotification");

// PersonalDetails createStep1

exports.createStep1 = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { fullName, email, mobile, gender, bio, password, confirmPassword } =
      req.body;

    const errors = {};

    /* ========= VALIDATIONS ========= */

    if (!fullName?.trim()) errors.fullName = "Full name is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!email || !emailRegex.test(email.trim()))
      errors.email = "Valid email is required";

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile))
      errors.mobile = "Valid Indian mobile number required";

    if (!gender) errors.gender = "Gender is required";

    if (!password || password !== confirmPassword)
      errors.password = "Passwords do not match";

    if (Object.keys(errors).length > 0) {
      await connection.rollback();
      return res.status(400).json({ errors });
    }

    /* ========= CHECK EXISTING USER ========= */

    const [existingUsers] = await connection.query(
      `SELECT u.id, u.password, d.status, d.current_step
       FROM users u
       JOIN doctors d ON u.id = d.user_id
       WHERE u.email = ? OR u.mobile = ?`,
      [email.trim().toLowerCase(), mobile],
    );

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];

      // If IN_PROGRESS → allow resume
      if (existing.status === "IN_PROGRESS") {
        const isMatch = await bcrypt.compare(password, existing.password);

        if (!isMatch) {
          await connection.rollback();
          return res.status(401).json({
            message: "Incorrect password.",
          });
        }

        // ✅ TOKEN GENERATE HERE
        const token = jwt.sign(
          { id: existing.id, role: "DOCTOR" },
          process.env.JWT_SECRET,
          { expiresIn: "7d" },
        );

        await connection.commit();

        return res.status(200).json({
          message: "Resume registration",
          resume: true,
          token,
          nextStep: existing.current_step + 1,
        });
      }

      if (existing.status === "PENDING") {
        await connection.rollback();
        return res.status(403).json({
          message: "Profile under verification",
        });
      }

      if (existing.status === "APPROVED") {
        await connection.rollback();
        return res.status(409).json({
          message: "Account already exists. Please login.",
        });
      }
    }

    /* ========= CREATE NEW ACCOUNT ========= */

    const hashedPassword = await bcrypt.hash(password, 10);

    const [userResult] = await connection.query(
      `INSERT INTO users (email, mobile, password, role, status)
       VALUES (?, ?, ?, 'DOCTOR', 'INACTIVE')`,
      [(email || "").trim(), mobile, hashedPassword],
    );

    const userId = userResult.insertId;

    await connection.query(
      `INSERT INTO doctors
       (user_id, doctorName, gender, bio, status, current_step)
       VALUES (?, ?, ?, ?, 'IN_PROGRESS', 1)`,
      [userId, (fullName || "").trim(), gender, bio?.trim() || null],
    );

    await connection.commit();

    // ✅ FIXED: notification now sent only after successful new user creation
    await db.query(
      `INSERT INTO notifications (title, message, receiver_role)
   VALUES (?, ?, ?)`,
      [
        "New Doctor Registered",
        `${fullName.trim()} has registered and is waiting for verification`,
        "ADMIN",
      ],
    );

    const token = jwt.sign(
      { id: userId, role: "DOCTOR" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(201).json({
      message: "Account created successfully",
      resume: false,
      nextStep: 2,
      token: token,
    });
  } catch (error) {
    console.error("CREATE STEP1 ERROR:", error);
    await connection.rollback();
    return res.status(500).json({
      message: "Server error",
    });
  } finally {
    connection.release();
  }
};

// PersonalDetails updateStep1

exports.updateStep1 = async (req, res) => {
  const userId = req.user.id;
  const { fullName, gender, bio } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[doctor]] = await connection.query(
      `SELECT status, current_step FROM doctors WHERE user_id = ?`,
      [userId],
    );

    if (!doctor) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Allow editing only if registration not submitted
    if (doctor.status !== "IN_PROGRESS") {
      await connection.rollback();
      return res.status(403).json({
        message: "Cannot edit after submission",
      });
    }

    await connection.query(
      `UPDATE doctors
       SET doctorName = ?, gender = ?, bio = ?, current_step = GREATEST(current_step, 1)
       WHERE user_id = ?`,
      [fullName?.trim(), gender, bio?.trim() || null, userId],
    );

    await connection.commit();

    return res.json({
      message: "Step 1 updated successfully",
      nextStep: 2,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({
      message: "Server error",
    });
  } finally {
    connection.release();
  }
};

// Professional

exports.registerStep2 = async (req, res) => {
  const userId = req.user.id;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[doctor]] = await connection.query(
      `SELECT status, current_step FROM doctors WHERE user_id = ?`,
      [userId],
    );

    if (!doctor) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctor.status !== "IN_PROGRESS") {
      await connection.rollback();
      return res.status(403).json({
        message: "Registration already submitted",
      });
    }

    if (doctor.current_step < 1) {
      await connection.rollback();
      return res.status(403).json({
        message: "Complete Step 1 first",
      });
    }

    // ✅ SAFE DATE FORMATTER
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d)) return null;
      return d.toISOString().split("T")[0];
    };

    const {
      qualification,
      specialization,
      experience,
      regNumber,
      stateCouncil,
      validTill,
    } = req.body;

    const errors = {};

    if (!qualification?.trim())
      errors.qualification = "Qualification is required";

    if (!specialization?.trim())
      errors.specialization = "Specialization is required";

    if (!experience || !/^\d+$/.test(experience))
      errors.experience = "Valid experience required";

    if (!regNumber?.trim()) errors.regNumber = "Registration number required";

    if (!stateCouncil?.trim()) errors.stateCouncil = "State council required";

    if (!validTill) errors.validTill = "Expiry date required";

    // ✅ FORMAT + VALIDATE DATE (CRITICAL FIX)
    const formattedDate = formatDate(validTill);

    if (!formattedDate) {
      errors.validTill = "Invalid date format";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const inputDate = new Date(formattedDate);

      if (inputDate <= today) {
        errors.validTill = "Date must be in the future";
      }
    }

    if (Object.keys(errors).length > 0) {
      await connection.rollback();
      return res.status(400).json({ errors });
    }

    await connection.query(
      `UPDATE doctors SET
        degree = ?,
        specialization = ?,
        experience_years = ?,
        licenseNumber = ?,
        state_council = ?,
        valid_till = ?,
        current_step = GREATEST(current_step, 2)
      WHERE user_id = ?`,
      [
        qualification.trim(),
        specialization.trim(),
        Number(experience),
        regNumber.trim(),
        stateCouncil.trim(),
        formattedDate, // ✅ SAFE
        userId,
      ],
    );

    await connection.commit();

    return res.json({
      message: "Step 2 saved",
      nextStep: 3,
    });
  } catch (error) {
    await connection.rollback();

    // ✅ PRODUCTION LOGGING
    console.error("STEP2 ERROR:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message, // helpful for debugging
    });
  } finally {
    connection.release();
  }
};
// Clinic

exports.registerStep3 = async (req, res) => {
  const userId = req.user.id;
  const { clinic } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[doctor]] = await connection.query(
      `SELECT id, status, current_step FROM doctors WHERE user_id = ?`,
      [userId],
    );

    if (!doctor) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctor.status !== "IN_PROGRESS") {
      await connection.rollback();
      return res
        .status(403)
        .json({ message: "Registration already submitted" });
    }

    if (doctor.current_step < 2) {
      await connection.rollback();
      return res.status(403).json({ message: "Complete Step 2 first" });
    }

    if (!Array.isArray(clinic) || clinic.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "At least one clinic required" });
    }

    const doctorId = doctor.id;

    // ✅ delete old
    await connection.query(`DELETE FROM doctor_clinics WHERE doctor_id = ?`, [
      doctorId,
    ]);

    // ✅ BULK INSERT 🔥
    const values = clinic.map((c) => [
      doctorId,
      (c.clinicName || "").trim(),
      (c.address || "").trim(),
      (c.city || "").trim(),
      (c.state || "").trim(),
      c.pincode,
      c.landmark || null,
      c.mapsLink || null,
      JSON.stringify(c.languages || []),
    ]);

    await connection.query(
      `INSERT INTO doctor_clinics
      (doctor_id, clinic_name, address, city, state, pincode, landmark, maps_link, languages)
      VALUES ?`,
      [values],
    );

    // ✅ update step
    await connection.query(
      `UPDATE doctors
       SET current_step = GREATEST(current_step, 3)
       WHERE user_id = ?`,
      [userId],
    );

    await connection.commit();

    return res.json({
      message: "Step 3 saved",
      nextStep: 4,
    });
  } catch (error) {
    console.error("STEP3 ERROR:", error);
    await connection.rollback();
    return res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};
// Practice

exports.registerStep4 = async (req, res) => {
  const userId = req.user.id;
  const { practiceType, hospitalName } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[doctor]] = await connection.query(
      `SELECT status, current_step FROM doctors WHERE user_id = ?`,
      [userId],
    );

    if (!doctor) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctor.status !== "IN_PROGRESS") {
      await connection.rollback();
      return res.status(403).json({
        message: "Registration already submitted",
      });
    }

    if (doctor.current_step < 3) {
      await connection.rollback();
      return res.status(403).json({
        message: "Complete Step 3 first",
      });
    }

    await connection.query(
      `UPDATE doctors
       SET practice_type = ?, hospital_name = ?,
           current_step = GREATEST(current_step, 4)
       WHERE user_id = ?`,
      [practiceType, hospitalName?.trim() || null, userId],
    );

    await connection.commit();

    return res.json({
      message: "Step 4 saved",
      nextStep: 5,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};

//consultation

exports.registerStep5 = async (req, res) => {
  const userId = req.user.id;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ doctor fetch
    const [[doctor]] = await connection.query(
      `SELECT id, status, current_step FROM doctors WHERE user_id = ?`,
      [userId],
    );

    if (!doctor) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctor.status !== "IN_PROGRESS") {
      await connection.rollback();
      return res
        .status(403)
        .json({ message: "Registration already submitted" });
    }

    if (doctor.current_step < 4) {
      await connection.rollback();
      return res.status(403).json({ message: "Complete Step 4 first" });
    }

    const {
      fee,
      duration,
      selectedDays,
      morningEnabled,
      morningStart,
      morningEnd,
      eveningEnabled,
      eveningStart,
      eveningEnd,
    } = req.body;

    const errors = {};

    // ✅ validations
    if (!fee || isNaN(fee) || Number(fee) <= 0)
      errors.fee = "Valid consultation fee required";

    const allowedDurations = ["10 mins", "15 mins", "20 mins", "30 mins"];
    if (!allowedDurations.includes(duration))
      errors.duration = "Invalid duration selected";

    if (!Array.isArray(selectedDays) || selectedDays.length === 0)
      errors.selectedDays = "Select at least one day";

    if (!morningEnabled && !eveningEnabled)
      errors.slot = "At least one shift required";

    if (Object.keys(errors).length > 0) {
      await connection.rollback();
      return res.status(400).json({ errors });
    }

    // ✅ VALID + UNIQUE DAYS 🔥
    const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const normalizedDays = [
      ...new Set((selectedDays || []).filter((day) => validDays.includes(day))),
    ];

    if (normalizedDays.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Invalid days selected" });
    }

    // ✅ update doctor
    await connection.query(
      `UPDATE doctors 
       SET consultationFee = ?, 
           consultation_duration = ?, 
           availableDays = ?, 
           current_step = GREATEST(current_step, 5)
       WHERE user_id = ?`,
      [Number(fee), duration, JSON.stringify(normalizedDays), userId],
    );

    const doctorId = doctor.id;

    // ✅ clear old safely
    await connection.query(
      `DELETE FROM doctor_availability WHERE doctor_id = ?`,
      [doctorId],
    );

    // ✅ time format
    const formatTime = (h) => {
      if (h === null || h === undefined || h === "") return null;
      return `${String(h).padStart(2, "0")}:00:00`;
    };

    // ✅ BULK INSERT (SAFE) 🔥
    const values = normalizedDays.map((day) => [
      doctorId,
      day, // ✅ DIRECT STRING
      morningEnabled ? formatTime(morningStart) : null,
      morningEnabled ? formatTime(morningEnd) : null,
      eveningEnabled ? formatTime(eveningStart) : null,
      eveningEnabled ? formatTime(eveningEnd) : null,
    ]);

    if (values.length > 0) {
      await connection.query(
        `INSERT INTO doctor_availability
        (doctor_id, day_code, morning_start, morning_end, evening_start, evening_end)
        VALUES ?`,
        [values],
      );
    }

    await connection.commit();

    return res.json({
      message: "Step 5 saved",
      nextStep: 6,
    });
  } catch (error) {
    console.error("STEP5 ERROR:", error);
    await connection.rollback();
    return res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};

// Documents

exports.registerStep6 = async (req, res) => {
  const userId = req.user.id;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[doctor]] = await connection.query(
      "SELECT id, status, current_step FROM doctors WHERE user_id = ?",
      [userId],
    );

    if (!doctor) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doctor.id;

    if (doctor.status !== "IN_PROGRESS") {
      await connection.rollback();
      return res
        .status(403)
        .json({ message: "Registration already submitted" });
    }

    if (doctor.current_step < 5) {
      await connection.rollback();
      return res.status(403).json({ message: "Complete Step 5 first" });
    }

    const requiredDocs = ["profile", "certificate", "idProof"];

    for (const field of requiredDocs) {
      if (!req.files || !req.files[field]) {
        await connection.rollback();
        return res.status(400).json({
          message: `${field} is required`,
        });
      }
    }

    for (const [docType, files] of Object.entries(req.files)) {
      const file = files[0];

      // ✅ Safety check
      if (!file || !file.location) {
        throw new Error(`S3 upload failed for ${docType}`);
      }

      const filePath = file.location;

      //       const filePath = file.location.replace(
      //   "https://yodoctor.in.s3.ap-south-1.amazonaws.com",
      //   "https://s3.ap-south-1.amazonaws.com/yodoctor.in"
      // );

      await connection.query(
        `INSERT INTO doctor_documents
     (doctor_id, doc_type, file_path, verified)
     VALUES (?, ?, ?, FALSE)
     ON DUPLICATE KEY UPDATE
       file_path = VALUES(file_path),
       verified = FALSE`,
        [doctorId, docType, filePath],
      );
    }

    await connection.query(
      `UPDATE doctors
       SET current_step = GREATEST(current_step, 6)
       WHERE user_id = ?`,
      [userId],
    );

    await connection.commit();

    return res.json({
      message: "Step 6 saved",
      nextStep: 7,
    });
  } catch (error) {
    console.error("STEP 6 ERROR:", error);
    await connection.rollback();
    return res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};

// finalSubmitRegistration

exports.finalSubmitRegistration = async (req, res) => {
  const userId = req.user.id;
  const { accurate, display, privacy, terms } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[doctor]] = await connection.query(
      `SELECT status, current_step FROM doctors WHERE user_id = ?`,
      [userId],
    );

    if (!doctor) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctor.status !== "IN_PROGRESS") {
      await connection.rollback();
      return res.status(400).json({
        message: "Registration already submitted",
      });
    }

    if (doctor.current_step < 6) {
      await connection.rollback();
      return res.status(403).json({
        message: "Complete all steps before submitting",
      });
    }

    const errors = {};
    if (!accurate) errors.accurate = "Confirm accuracy";
    if (!display) errors.display = "Authorize display";
    if (!privacy) errors.privacy = "Accept privacy policy";
    if (!terms) errors.terms = "Accept terms";

    if (Object.keys(errors).length > 0) {
      await connection.rollback();
      return res.status(400).json({ errors });
    }

    await connection.query(
      `UPDATE doctors
       SET status = 'PENDING',
           current_step = 7,
           declarations_accepted = TRUE,
           submitted_at = NOW()
       WHERE user_id = ?`,
      [userId],
    );

    // ✅ FIXED: was using `fullName` (undefined variable) → ReferenceError crash.
    // Now fetches doctorName from DB using the available userId.
    const [[doctorRow]] = await connection.query(
      `SELECT doctorName FROM doctors WHERE user_id = ?`,
      [userId],
    );

    await connection.query(
      `INSERT INTO notifications (title, message, receiver_role)
       VALUES (?, ?, ?)`,
      [
        "New Doctor Registration",
        `${doctorRow?.doctorName || "A doctor"} has submitted registration and is waiting for approval.`,
        "ADMIN",
      ],
    );

    await connection.commit();

    return res.json({
      message: "Registration submitted successfully",
      redirect: "waiting-approval",
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};

// doctor  respondAppointment------------------------------

exports.respondAppointment = async (req, res) => {
  const userId = req.user.id;
  const { id: appointmentId } = req.params;
  const { action } = req.body;

  if (!["ACCEPT", "REJECT"].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }

  const newStatus = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ FIX: get correct doctorId
    const [[doc]] = await connection.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [userId],
    );

    if (!doc) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    // ✅ Now correct query
    const [[appointment]] = await connection.query(
      `SELECT patient_id, appointment_date
       FROM appointments
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'PENDING'
       FOR UPDATE`,
      [appointmentId, doctorId],
    );

    if (!appointment) {
      await connection.rollback();
      return res.status(400).json({
        message: "Appointment not found or already processed",
      });
    }

    // ✅ Date validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointmentDate = new Date(appointment.appointment_date);
    appointmentDate.setHours(0, 0, 0, 0);

    if (appointmentDate < today) {
      await connection.rollback();
      return res.status(400).json({
        message: "Cannot respond to past appointment",
      });
    }

    // ✅ Update status
    await connection.query(
      `UPDATE appointments
       SET status = ?
       WHERE id = ?`,
      [newStatus, appointmentId],
    );

    // ✅ Notification
    await connection.query(
      `INSERT INTO notifications
       (receiver_id, receiver_role, title, message, appointment_id)
       VALUES (?, 'PATIENT', ?, ?, ?)`,
      [
        appointment.patient_id,
        newStatus === "ACCEPTED"
          ? "Appointment Accepted"
          : "Appointment Rejected",
        newStatus === "ACCEPTED"
          ? "Doctor has accepted your appointment."
          : "Doctor has rejected your appointment.",
        appointmentId,
      ],
    );

    await connection.commit();

    eventBus.emit("APPOINTMENT_STATUS_UPDATED", {
      appointmentId,
      patientId: appointment.patient_id,
      doctorId,
      status: newStatus,
    });

    return res.json({
      message: `Appointment ${newStatus.toLowerCase()}`,
    });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

exports.getDashboard = async (req, res) => {
  const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
    req.user.id,
  ]);

  if (!doc) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const doctorId = doc.id;

  try {
    // doctor name
    const [[doctor]] = await db.query(
      `SELECT doctorName FROM doctors WHERE user_id = ?`,
      [req.user.id],
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // dashboard stats
    const [stats] = await db.query(
      `SELECT
  COUNT(CASE WHEN status='PENDING' THEN 1 END) AS pendingRequests,

  COUNT(CASE
        WHEN appointment_date = CURDATE()
        AND status IN ('ACCEPTED','IN_PROGRESS')
       THEN 1 END) AS todayQueue,

  COUNT(CASE
        WHEN appointment_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       THEN 1 END) AS tomorrow,

  COUNT(CASE
        WHEN appointment_date = DATE_ADD(CURDATE(), INTERVAL 2 DAY)
       THEN 1 END) AS nextDay,

  COUNT(CASE
        WHEN status='COMPLETED'
        AND appointment_date = CURDATE()
       THEN 1 END) AS completedToday,

    COUNT(
    DISTINCT COALESCE(patient_id, family_member_id, CONCAT('W', id))
  ) AS totalPatients

FROM appointments
WHERE doctor_id = ?`,
      [doctorId],
    );

    res.json({
      ...stats[0],
      doctorName: doctor?.doctorName || "",
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getIncomingAppointments = async (req, res) => {
  const userId = req.user.id;

  try {
    // ✅ FIX
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    const [appointments] = await db.query(
      `SELECT
        a.id,
        a.appointment_date,
        a.appointment_slot,
        a.token_number,
        a.status,
        a.created_by,
        p.fullName AS patientName,
        fm.full_name AS familyMemberName,
        wp.name AS walk_in_patient_name,
        u.profile_image
       FROM appointments a
       LEFT JOIN patients p
         ON a.patient_id = p.user_id
       LEFT JOIN users u
         ON a.patient_id = u.id
       LEFT JOIN family_members fm
         ON a.family_member_id = fm.id
       LEFT JOIN walkin_patients wp
         ON a.walkin_patient_id = wp.id
       WHERE a.doctor_id = ?
       AND a.status IN ('PENDING','ACCEPTED')
       AND a.appointment_date >= CURDATE()
       ORDER BY a.appointment_date, a.appointment_slot, a.token_number`,
      [doctorId],
    );

    res.json({ appointments });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};

// doctor  getTodayQueue------------------------------
exports.getTodayQueue = async (req, res) => {
  const userId = req.user.id;
  const slot = req.query.slot;

  if (!["MORNING", "EVENING"].includes(slot)) {
    return res.status(400).json({ message: "Invalid slot" });
  }

  try {
    // ✅ STEP 1: get correct doctorId
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    // ✅ STEP 2: fetch queue
    const [queue] = await db.query(
      `SELECT
        a.id,
        a.token_number,
        a.status,
        p.fullName AS patientName,
        fm.full_name AS familyMemberName,
        wp.name AS walk_in_patient_name,
        u.profile_image AS patientImage,
        vs.prescription
      FROM appointments a
      LEFT JOIN patients p 
        ON a.patient_id = p.user_id
      LEFT JOIN users u
        ON p.user_id = u.id
      LEFT JOIN family_members fm 
        ON a.family_member_id = fm.id
      LEFT JOIN walkin_patients wp
        ON a.walkin_patient_id = wp.id
      LEFT JOIN visit_summaries vs
        ON vs.appointment_id = a.id
      WHERE a.doctor_id = ?
      AND a.appointment_date = CURDATE()
      AND a.appointment_slot = ?
      AND a.status IN ('ACCEPTED','IN_PROGRESS','COMPLETED','SKIPPED')
      ORDER BY a.token_number`,
      [doctorId, slot],
    );

    const formattedQueue = queue.map((q) => ({
      ...q,
      hasPrescription: !!q.prescription,
    }));

    res.json({ queue: formattedQueue });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ===============================
// START APPOINTMENT
// ===============================
exports.startAppointment = async (req, res) => {
  const userId = req.user.id;
  const { id: appointmentId } = req.params;
  const { slot } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ STEP 1: get doctorId
    const [[doc]] = await connection.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [userId],
    );

    if (!doc) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    // ===============================
    // ✅ TIME VALIDATION (ONLY START)
    // ===============================

    const daysMap = {
      0: "Sun",
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
    };

    const dayCode = daysMap[new Date().getDay()];

    const [[availability]] = await connection.query(
      `SELECT morning_start, evening_start
       FROM doctor_availability
       WHERE doctor_id = ?
       AND day_code = ?
       AND is_active = 1`,
      [doctorId, dayCode],
    );

    if (!availability) {
      await connection.rollback();
      return res.status(400).json({
        message: "Doctor not available today",
      });
    }

    const getTodayTime = (timeStr) => {
      if (!timeStr) return null;
      const [h, m, s] = timeStr.split(":");
      const t = new Date();
      t.setHours(h, m, s, 0);
      return t;
    };

    const now = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
      }),
    );

    let startTime;

    if (slot === "MORNING") {
      startTime = getTodayTime(availability.morning_start);
    } else {
      startTime = getTodayTime(availability.evening_start);
    }

    // ❌ BEFORE START BLOCK
    if (startTime && now < startTime) {
      await connection.rollback();
      return res.status(400).json({
        message: `Appointments start from ${startTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      });
    }

    // ===============================
    // EXISTING LOGIC
    // ===============================

    // check already running
    const [[existing]] = await connection.query(
      `SELECT id FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot = ?
       AND status = 'IN_PROGRESS'
       FOR UPDATE`,
      [doctorId, slot],
    );

    if (existing) {
      await connection.rollback();
      return res.status(400).json({
        message: "Appointment already in progress",
      });
    }

    // check valid appointment
    const [[appointment]] = await connection.query(
      `SELECT id FROM appointments
       WHERE id = ?
       AND doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot = ?
       AND status = 'ACCEPTED'
       FOR UPDATE`,
      [appointmentId, doctorId, slot],
    );

    if (!appointment) {
      await connection.rollback();
      return res.status(400).json({
        message: "Appointment cannot be started",
      });
    }

    // ✅ START APPOINTMENT
    await connection.query(
      `UPDATE appointments SET status = 'IN_PROGRESS' WHERE id = ?`,
      [appointmentId],
    );

    await connection.commit();

    res.json({ message: "Appointment started" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
// CALL NEXT TOKEN
// ===============================
exports.callNextToken = async (req, res) => {
  const userId = req.user.id;
  const { slot } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ FIX
    const [[doc]] = await connection.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [userId],
    );

    if (!doc) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    // complete current
    const [[current]] = await connection.query(
      `SELECT id FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot = ?
       AND status = 'IN_PROGRESS'
       FOR UPDATE`,
      [doctorId, slot],
    );

    if (current) {
      await connection.query(
        `UPDATE appointments SET status = 'COMPLETED' WHERE id = ?`,
        [current.id],
      );
    }

    // get next
    const [[next]] = await connection.query(
      `SELECT id, token_number FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot = ?
       AND status = 'ACCEPTED'
       ORDER BY token_number ASC
       LIMIT 1 FOR UPDATE`,
      [doctorId, slot],
    );

    if (next) {
      await connection.query(
        `UPDATE appointments SET status = 'IN_PROGRESS' WHERE id = ?`,
        [next.id],
      );

      await connection.commit();

      return res.json({
        message: "Next token called",
        token: next.token_number,
      });
    }

    await connection.commit();

    return res.json({ message: "No Appointment" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
// GET CURRENT APPOINTMENT
// ===============================
exports.getCurrentAppointment = async (req, res) => {
  const userId = req.user.id;
  const { slot } = req.query;

  if (!slot) {
    return res.status(400).json({ message: "Slot is required" });
  }

  try {
    // ✅ FIX
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    const [[current]] = await db.query(
      `SELECT 
        a.id,
        a.token_number,
        a.status,
        u.profile_image,
        p.fullName AS patientName,
        fm.full_name AS familyMemberName,
        wp.name AS walk_in_patient_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.user_id
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN family_members fm ON a.family_member_id = fm.id
           LEFT JOIN walkin_patients wp
      ON a.walkin_patient_id = wp.id
       WHERE a.doctor_id = ?
       AND a.appointment_date = CURDATE()
       AND a.appointment_slot = ?
       AND a.status = 'IN_PROGRESS'
       LIMIT 1`,
      [doctorId, slot],
    );

    if (!current) {
      return res.json({
        active: false,
        message: "No active appointment",
      });
    }

    return res.json({
      active: true,
      appointment: current,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===============================

// GET NEXT APPOINTMENT
// ===============================
exports.getNextAppointment = async (req, res) => {
  const userId = req.user.id;
  const { slot } = req.query;

  if (!slot) {
    return res.status(400).json({ message: "Slot is required" });
  }

  try {
    // ✅ FIX
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    const [[next]] = await db.query(
      `SELECT 
      a.id,
      a.token_number,
      a.status,
      u.profile_image,
      p.fullName AS patientName,
      fm.full_name AS familyMemberName,
      wp.name AS walk_in_patient_name

    FROM appointments a

    LEFT JOIN patients p
      ON a.patient_id = p.user_id

    LEFT JOIN users u
      ON p.user_id = u.id

    LEFT JOIN family_members fm
      ON a.family_member_id = fm.id

    LEFT JOIN walkin_patients wp
      ON a.walkin_patient_id = wp.id

    WHERE a.doctor_id = ?
    AND a.appointment_date = CURDATE()
    AND a.appointment_slot = ?
    AND a.status = 'ACCEPTED'

    ORDER BY a.token_number ASC
    LIMIT 1`,
      [doctorId, slot],
    );

    if (!next) {
      return res.json({
        next: false,
        message: "No next patient",
      });
    }

    return res.json({
      next: true,
      appointment: next,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateClinicStatus = async (req, res) => {
  const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
    req.user.id,
  ]);

  if (!doc) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const doctorId = doc.id;
  const { isAvailable } = req.body;

  if (typeof isAvailable !== "boolean") {
    return res.status(400).json({
      message: "isAvailable must be true or false",
    });
  }

  try {
    await db.query(
      `UPDATE doctors
       SET is_available = ?
       WHERE id = ?`,
      [isAvailable, doctorId],
    );

    res.json({
      message: `Doctor is now ${isAvailable ? "AVAILABLE" : "UNAVAILABLE"}`,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getDoctorReviews = async (req, res) => {
  const userId = req.user.id; // 🔥 this is users.id
  const page = Number(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  try {
    // ✅ STEP 1: get correct doctor.id
    const [[doctor]] = await db.query(
      `SELECT id FROM doctors WHERE user_id = ?`,
      [userId],
    );

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    const doctorId = doctor.id;

    // ✅ STEP 2: total count
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM doctor_feedback
       WHERE doctor_id = ?`,
      [doctorId],
    );

    // ✅ STEP 3: fetch reviews (🔥 added r.id)
    const [reviews] = await db.query(
      `SELECT
    r.id,
    r.rating,
    r.comment,
    r.created_at,

    p.fullName AS patientName,   
    u.profile_image AS patientImage 

   FROM doctor_feedback r

   JOIN patients p ON r.patient_id = p.id
   JOIN users u ON p.user_id = u.id

   WHERE r.doctor_id = ?
   ORDER BY r.created_at DESC
   LIMIT ? OFFSET ?`,
      [doctorId, limit, offset],
    );

    const [[stats]] = await db.query(
      `SELECT 
        AVG(rating) as avgRating,
        COUNT(*) as totalReviews
      FROM doctor_feedback
      WHERE doctor_id = ?`,
      [doctorId],
    );

    // ✅ STEP 4: response (🔥 added hasMore)
    res.json({
      reviews,
      page,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
      avgRating: Number(stats.avgRating || 0).toFixed(1),
      totalReviews: stats.totalReviews,
    });
  } catch (err) {
    console.error("getDoctorReviews error:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// addVisitSummary

exports.addVisitSummary = async (req, res) => {
  const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
    req.user.id,
  ]);

  if (!doc) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const doctorId = doc.id;
  const { id: appointmentId } = req.params;
  const { notes, prescription, followUpAfterDays } = req.body;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 1️⃣ Validate appointment (must belong to doctor & completed)
    const [[appt]] = await connection.query(
      `SELECT id
       FROM appointments
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'COMPLETED'`,
      [appointmentId, doctorId],
    );

    if (!appt) {
      await connection.rollback();
      return res.status(400).json({
        message: "Visit summary allowed only after completion",
      });
    }

    // 2️⃣ Get patient
    const [[patientLink]] = await connection.query(
      `SELECT patient_id
       FROM appointment_patients
       WHERE appointment_id = ?
       AND patient_id IS NOT NULL
       LIMIT 1`,
      [appointmentId],
    );

    if (!patientLink) {
      await connection.rollback();
      return res.status(400).json({
        message: "No linked patient found",
      });
    }

    const patientId = patientLink.patient_id;

    // 3️⃣ Validate follow-up days
    let followUpDate = null;
    const days = parseInt(followUpAfterDays, 10);
    if (!isNaN(days) && days > 0) {
      followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + days);
    }

    // 4️⃣ Insert or update summary
    const [[existing]] = await connection.query(
      `SELECT id FROM visit_summaries WHERE appointment_id = ?`,
      [appointmentId],
    );

    if (existing) {
      await connection.query(
        `UPDATE visit_summaries
         SET notes = ?, prescription = ?, follow_up_date = ?
         WHERE appointment_id = ?`,
        [notes || null, prescription || null, followUpDate, appointmentId],
      );
    } else {
      await connection.query(
        `INSERT INTO visit_summaries
         (appointment_id, patient_id, notes, prescription, follow_up_date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          appointmentId,
          patientId,
          notes || null,
          prescription || null,
          followUpDate,
        ],
      );
    }

    // 5️⃣ Optional Notification
    await createNotification({
      receiverId: patientId,
      receiverRole: "PATIENT",
      title: "Visit Summary Available",
      message: "Your visit summary has been added.",
      appointmentId,
    });

    await connection.commit();

    return res.json({
      message: existing ? "Visit summary updated" : "Visit summary added",
      followUpDate,
    });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

// getDoctorById

exports.getDoctorById = async (req, res) => {
  const { id } = req.params;

  try {
    const [[doctor]] = await db.query(
      `SELECT 
        d.id AS doctorId,
        d.doctorName,
        d.specialization,
        d.degree,
        d.experience_years,
        d.consultationFee,
        d.city,
        d.rating,
        d.rating_count
       FROM doctors d
       WHERE d.id = ?
       AND d.status = 'APPROVED'`,
      [id],
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json({ doctor });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// DOCTOR – Appointment History

exports.getDoctorAppointmentHistory = async (req, res) => {
  const userId = req.user.id;
  const filter = req.query.filter;
  const page = Number(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    // ✅ FIX: get correct doctorId
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    let dateCondition = "";
    let params = [doctorId];

    if (filter === "today") {
      dateCondition = "AND a.appointment_date = CURDATE()";
    } else if (filter === "last7") {
      dateCondition =
        "AND a.appointment_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND CURDATE()";
    }

    // ✅ COUNT
    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT a.id) AS total
       FROM appointments a
       WHERE a.doctor_id = ?
       ${dateCondition}
       AND a.status IN ('COMPLETED','CANCELLED','REJECTED')`,
      params,
    );

    // ✅ DATA
    const [appointments] = await db.query(
      `SELECT
        a.id,
        DATE_FORMAT(
        CONVERT_TZ(a.appointment_date, '+00:00', '+05:30'),
        '%d %b %Y, %h:%i %p'
        ) AS appointment_date,
        a.appointment_slot,
        a.token_number,
        a.status,

        p.fullName AS patientName,
        fm.full_name AS familyMemberName,
        wp.name AS walk_in_patient_name,

        u.profile_image AS patientImage,
        vs.id IS NOT NULL AS hasPrescription

      FROM appointments a

      LEFT JOIN patients p
        ON a.patient_id = p.user_id

      LEFT JOIN users u
        ON p.user_id = u.id

      LEFT JOIN family_members fm
        ON a.family_member_id = fm.id
      LEFT JOIN walkin_patients wp
        ON a.walkin_patient_id = wp.id

      LEFT JOIN visit_summaries vs 
        ON vs.appointment_id = a.id

      WHERE a.doctor_id = ?
      ${dateCondition}
      AND a.status IN ('COMPLETED','CANCELLED','REJECTED')

      ORDER BY a.appointment_date DESC, a.token_number DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    res.json({
      appointments,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// DOCTOR – getDoctorNotifications
exports.getDoctorNotifications = async (req, res) => {
  const userId = req.user.id;
  const page = Number(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE receiver_id = ?
       AND receiver_role = 'DOCTOR'`,
      [userId],
    );

    const [notifications] = await db.query(
      `SELECT id, title, message, appointment_id, is_read, created_at
       FROM notifications
       WHERE receiver_id = ?
       AND receiver_role = 'DOCTOR'
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );

    res.json({
      notifications,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// DOCTOR – getDoctorUnreadCount
exports.getDoctorUnreadCount = async (req, res) => {
  const userId = req.user.id;

  try {
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE receiver_id = ?
       AND receiver_role = 'DOCTOR'
       AND is_read = FALSE`,
      [userId],
    );

    return res.json({
      unreadCount: row?.count || 0,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// DOCTOR – downloadQR
exports.downloadQR = async (req, res) => {
  const path = require("path");
  const fs = require("fs");

  let browser;

  // ✅ SAFE LOGO LOAD
  let logo;
  try {
    const logoPath = path.join(process.cwd(), "src/assets/logo.webp");
    const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
    logo = `data:image/webp;base64,${logoBase64}`;
  } catch (e) {
    console.warn("Logo not found, fallback used");
    logo = "https://via.placeholder.com/100";
  }

  try {
    const userId = req.user.id;
    const { doctorName, specialization, qrValue } = req.body;

    // ✅ GET DOCTOR ID
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    const doctorId = doc.id;

    // ✅ GET CLINIC NAME
    const [clinicRows] = await db.query(
      `SELECT clinic_name 
   FROM doctor_clinics 
   WHERE doctor_id = ? 
   ORDER BY created_at DESC 
   LIMIT 1`,
      [doctorId],
    );

    const clinicName = clinicRows[0]?.clinic_name || "YoDoctor Clinic";

    // ✅ DB IMAGE
    const [[user]] = await db.query(
      "SELECT profile_image FROM users WHERE id = ?",
      [userId],
    );

    let doctorImage = user?.profile_image || "https://via.placeholder.com/60";

    // ✅ QR
    const qrImage = await QRCode.toDataURL(qrValue);

    // ✅ HTML
    const html = generateQRHTML({
      doctorName,
      specialization,
      qr: qrImage,
      doctorImage,
      logo,
      clinic: clinicName,
    });

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setViewport({ width: 1200, height: 1600 });

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=qr.pdf",
    });

    return res.send(pdf);
  } catch (err) {
    console.error("QR PDF Error:", err);
    return res.status(500).json({ message: "QR PDF failed" });
  } finally {
    if (browser) await browser.close();
  }
};

// DOCTOR – markDoctorNotificationRead

exports.markDoctorNotificationRead = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = ?
       AND receiver_id = ?
       AND receiver_role = 'DOCTOR'
       AND is_read = FALSE`,
      [id, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Notification not found or already read",
      });
    }

    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
// DOCTOR – markAllDoctorNotificationsRead
exports.markAllDoctorNotificationsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    await db.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE receiver_id = ?
       AND receiver_role = 'DOCTOR'
       AND is_read = FALSE`,
      [userId],
    );

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// DOCTOR – getMyQRRedirect

exports.getMyQRRedirect = async (req, res) => {
  try {
    const { doctorId } = req.query;

    if (!doctorId) {
      return res.status(400).send("Invalid QR");
    }

    const [[doctor]] = await db.query(
      `SELECT user_id, status 
       FROM doctors 
      WHERE id = ?`,
      [doctorId],
    );

    if (!doctor) {
      return res.status(404).send("Doctor not found");
    }

    if (doctor.status !== "APPROVED") {
      return res.status(403).send("Doctor not approved");
    }

    // ✅ Optional tracking
    await db.query(
      `INSERT INTO qr_scans (doctor_id, scanned_at) VALUES (?, NOW())`,
      [doctorId],
    );

    const frontendUrl = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",")[0].trim()
      : "https://yodoctor.in";

    return res.redirect(
      `${frontendUrl}/client/book-appointment?doctorId=${doctorId}`,
    );
  } catch (error) {
    console.error("QR Redirect Error:", error);
    res.status(500).send("Server error");
  }
};

// DOCTOR – getMyQR

exports.getMyQR = async (req, res) => {
  // const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const frontendUrl = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",")[0].trim()
    : "https://yodoctor.in";

  const userId = req.user.id;

  // ✅ FIX: get doctor.id
  const [[doctor]] = await db.query(
    `SELECT id 
     FROM doctors 
     WHERE user_id = ? 
     AND status = 'APPROVED'`,
    [userId],
  );

  if (!doctor) {
    return res.status(403).json({
      message: "Doctor not approved",
    });
  }

  const doctorId = doctor.id;

  const qrUrl = `${frontendUrl}/qr-redirect?doctorId=${doctorId}`;

  res.json({ doctorId, qrUrl });
};

// STAFF / NURSE – Manual (Walk-in) Visit Booking

exports.manualVisitBooking = async (req, res) => {
  const staffId = req.user.id;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[doc]] = await connection.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [staffId],
    );

    if (!doc) {
      throw new Error("Doctor not found");
    }

    const doctorId = doc.id;

    const { appointmentType, slot, patientName, patientMobile, patientAge } =
      req.body;

    if (
      !patientName ||
      !patientMobile ||
      !["MORNING", "EVENING"].includes(slot)
    ) {
      await connection.rollback();
      return res.status(400).json({
        message: "Invalid request data",
      });
    }

    const getTodayDate = () => {
      const now = new Date();
      return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0];
    };

    const appointmentDate = getTodayDate();

    const MAX_TOKENS_PER_SHIFT = 50;

    // -------------------------
    // 1️⃣ Doctor check (FIXED)
    // -------------------------
    const [[doctor]] = await connection.query(
      `SELECT id
       FROM doctors
       WHERE id = ?
       AND status = 'APPROVED'
       AND is_available = TRUE
       FOR UPDATE`,
      [doctorId],
    );

    if (!doctor) {
      throw new Error("Doctor is not available for booking");
    }

    // -------------------------
    // 2️⃣ Availability
    // -------------------------
    const daysMap = {
      0: "Sun",
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
    };

    const todayDayCode = daysMap[new Date().getDay()];

    const [availabilityRows] = await connection.query(
      `SELECT morning_start, morning_end, evening_start, evening_end
       FROM doctor_availability
       WHERE doctor_id = ? AND day_code = ?`,
      [doctorId, todayDayCode],
    );

    if (!availabilityRows.length) {
      throw new Error("Doctor not available today");
    }

    const avail = availabilityRows[0];

    const toMinutes = (t) => {
      if (!t || typeof t !== "string") return null;

      const parts = t.split(":");
      if (parts.length < 2) return null;

      const h = Number(parts[0]);
      const m = Number(parts[1]);

      if (isNaN(h) || isNaN(m)) return null;

      return h * 60 + m;
    };

    const morningStart = toMinutes(avail.morning_start);
    const morningEnd = toMinutes(avail.morning_end);
    const eveningStart = toMinutes(avail.evening_start);
    const eveningEnd = toMinutes(avail.evening_end);

    const now = new Date();
    const currentHHMM = now.getHours() * 60 + now.getMinutes();

    // -------------------------
    // Slot validation
    // -------------------------
    if (slot === "MORNING" && (!morningStart || !morningEnd)) {
      throw new Error("Doctor not available in morning");
    }

    if (slot === "EVENING" && (!eveningStart || !eveningEnd)) {
      throw new Error("Doctor not available in evening");
    }

    // -------------------------
    // Cutoff
    // -------------------------
    if (slot === "MORNING") {
      if (currentHHMM >= morningEnd - 10) {
        throw new Error("Morning booking closed");
      }
    }

    if (slot === "EVENING") {
      if (currentHHMM >= eveningEnd - 10) {
        throw new Error("Evening booking closed");
      }
    }

    // -------------------------
    // Token check
    // -------------------------
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS totalTokens,
              MAX(token_number) AS lastToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?
       FOR UPDATE`,
      [doctorId, appointmentDate, slot],
    );

    if (row.totalTokens >= MAX_TOKENS_PER_SHIFT) {
      throw new Error(`${slot} shift full`);
    }

    const nextToken = (row.lastToken || 0) + 1;

    // -------------------------
    // Insert walk-in
    // -------------------------
    const [walkinResult] = await connection.query(
      `INSERT INTO walkin_patients (name, mobile, age)
       VALUES (?, ?, ?)`,
      [patientName, patientMobile, patientAge || null],
    );

    const walkinPatientId = walkinResult.insertId;

    // -------------------------
    // Insert appointment
    // -------------------------
    const [appointmentResult] = await connection.query(
      `INSERT INTO appointments
       (appointment_type, doctor_id, walkin_patient_id,
        appointment_date, appointment_slot,
        token_number, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'ACCEPTED', 'STAFF')`,
      [
        appointmentType || "CLINIC",
        doctorId,
        walkinPatientId,
        appointmentDate,
        slot,
        nextToken,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      message: "Booked",
      token: nextToken,
      slot,
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    return res.status(400).json({
      message: err.message,
    });
  } finally {
    connection.release();
  }
};

//addPrescription

exports.addPrescription = async (req, res) => {
  const userId = req.user.id;
  const { id: appointmentId } = req.params;
  const { medicines, instructions } = req.body;

  try {
    // ✅ FIX: get correct doctorId
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    // 1️⃣ Validate appointment (SECURE)
    const [[appt]] = await db.query(
      `SELECT id, patient_id, family_member_id
       FROM appointments
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'COMPLETED'`,
      [appointmentId, doctorId],
    );

    if (!appt) {
      return res.status(400).json({
        message: "Prescription allowed only after appointment completion",
      });
    }

    const patientId = appt.patient_id || appt.family_member_id;

    if (!patientId) {
      return res.status(400).json({
        message: "No linked patient found",
      });
    }

    // 2️⃣ Check existing summary
    const [[existing]] = await db.query(
      `SELECT id FROM visit_summaries WHERE appointment_id = ?`,
      [appointmentId],
    );

    if (existing) {
      await db.query(
        `UPDATE visit_summaries
         SET prescription = ?, notes = ?
         WHERE appointment_id = ?`,
        [medicines || null, instructions || null, appointmentId],
      );
    } else {
      await db.query(
        `INSERT INTO visit_summaries
         (appointment_id, prescription, notes)
         VALUES (?, ?, ?)`,
        [appointmentId, medicines || null, instructions || null],
      );
    }

    return res.json({
      message: existing
        ? "Prescription updated"
        : "Prescription added successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

exports.getPrescription = async (req, res) => {
  const userId = req.user.id;
  const { id: appointmentId } = req.params;

  try {
    // ✅ doctor check (optional but safe)
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    const [[data]] = await db.query(
      `SELECT 
        vs.prescription AS medicines,
        vs.notes AS instructions
       FROM visit_summaries vs
       JOIN appointments a ON a.id = vs.appointment_id
       WHERE vs.appointment_id = ?
       AND a.doctor_id = ?`,
      [appointmentId, doctorId],
    );

    if (!data) {
      return res.status(404).json({
        message: "Prescription not found",
      });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error",
    });
  }
};

//autoAcceptAllAppointments
exports.autoAcceptAllAppointments = async (req, res) => {
  const userId = req.user.id;

  try {
    // ✅ FIX: correct doctorId
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'ACCEPTED'
       WHERE doctor_id = ?
       AND status = 'PENDING'
       AND appointment_date >= CURDATE()`,
      [doctorId],
    );

    if (result.affectedRows === 0) {
      return res.json({
        message: "No pending appointments to accept",
        affectedRows: 0,
      });
    }

    return res.json({
      message: "All pending appointments accepted",
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

//skipAppointment

exports.skipAppointment = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    // ✅ FIX
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'SKIPPED'
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'IN_PROGRESS'`,
      [id, doctorId],
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Cannot skip appointment" });
    }

    res.json({ message: "Appointment skipped" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.recallSkippedPatient = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    // ✅ FIX
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'ACCEPTED'
       WHERE id = ?
       AND doctor_id = ?
       AND status = 'SKIPPED'`,
      [id, doctorId],
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Cannot recall patient" });
    }

    res.json({ message: "Patient added back to queue" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

//markNoShow

exports.markNoShow = async (req, res) => {
  const userId = req.user.id;
  const { slot } = req.body;

  if (!slot) {
    return res.status(400).json({ message: "Slot is required" });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ FIX
    const [[doc]] = await connection.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [userId],
    );

    if (!doc) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    const [result] = await connection.query(
      `UPDATE appointments
       SET status = 'CANCELLED',
           cancelled_by = 'SYSTEM',
           cancel_reason = 'No show',
           cancelled_at = NOW()
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot = ?
       AND status = 'SKIPPED'`,
      [doctorId, slot],
    );

    await connection.commit();

    return res.json({
      message: "No show marked successfully",
      affected: result.affectedRows,
    });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

//carryForwardRemaining

exports.carryForwardRemaining = async (req, res) => {
  const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
    req.user.id,
  ]);

  if (!doc) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const doctorId = doc.id;
  const { slot } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'CARRY_FORWARD'
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot= ?
       AND status IN ('PENDING','ACCEPTED','SKIPPED')`,
      [doctorId, slot],
    );

    return res.json({
      message: "Remaining appointments carried forward",
      affected: result.affectedRows,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

//getCarryForwardAppointments

exports.getCarryForwardAppointments = async (req, res) => {
  const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
    req.user.id,
  ]);

  if (!doc) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const doctorId = doc.id;

  try {
    const [appointments] = await db.query(
      `SELECT id,
              appointment_date,
              token_number,
              appointment_slot,
              status
       FROM appointments
       WHERE doctor_id = ?
       AND status = 'CARRY_FORWARD'
       ORDER BY appointment_date ASC, token_number ASC`,
      [doctorId],
    );

    return res.json({ appointments });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

//cancelRemainingAppointments

exports.cancelRemainingAppointments = async (req, res) => {
  const userId = req.user.id;
  const { slot, reason } = req.body;

  if (!slot) {
    return res.status(400).json({ message: "Slot is required" });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ FIX: get correct doctorId
    const [[doc]] = await connection.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [userId],
    );

    if (!doc) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    // 1️⃣ Fetch affected patients
    const [appointments] = await connection.query(
      `SELECT 
        a.id,
        a.patient_id,
        a.family_member_id,
        u.email
       FROM appointments a
       LEFT JOIN users u 
         ON u.id = a.patient_id
       WHERE a.doctor_id = ?
       AND a.appointment_date = CURDATE()
       AND a.appointment_slot = ?
       AND a.status IN ('PENDING','ACCEPTED','SKIPPED')
       FOR UPDATE`,
      [doctorId, slot],
    );

    if (appointments.length === 0) {
      await connection.rollback();
      return res.json({ message: "No remaining appointments found" });
    }

    // 2️⃣ Update appointments
    await connection.query(
      `UPDATE appointments
       SET status = 'CANCELLED',
           cancelled_by = 'DOCTOR',
           cancel_reason = ?,
           cancelled_at = NOW()
       WHERE doctor_id = ?
       AND appointment_date = CURDATE()
       AND appointment_slot = ?
       AND status IN ('PENDING','ACCEPTED','SKIPPED')`,
      [reason || "Doctor unavailable", doctorId, slot],
    );

    await connection.commit();

    // 3️⃣ Notifications
    for (const appt of appointments) {
      if (appt.email) {
        await sendEmail({
          to: appt.email,
          subject: "Appointment Cancelled",
          text: `Your appointment has been cancelled. Reason: ${
            reason || "Doctor unavailable"
          }`,
        });
      }

      const receiverId = appt.patient_id || appt.family_member_id;

      if (receiverId) {
        await createNotification({
          receiverId,
          receiverRole: "PATIENT",
          title: "Appointment Cancelled",
          message: "Your appointment has been cancelled.",
          appointmentId: appt.id,
        });
      }
    }

    return res.json({
      message: "Remaining appointments cancelled and patients notified",
      affected: appointments.length,
    });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

// update doctor profile
const formatDate = (date) => {
  try {
    if (!date) return null;
    return new Date(date).toISOString().split("T")[0];
  } catch {
    return null;
  }
};

exports.updateDoctorProfile = async (req, res) => {
  const userId = req.user.id;
  const body = req.body || {};

  const {
    doctorName,
    degree,
    specialization,
    bio,
    consultationFee,
    consultation_duration,
    experience_years,
    licenseNumber,
    state_council,
    valid_till,
    practice_type,
    hospital_name,
    availableDays,
    languages,
    clinic_name,
    city,
    address,
    state,
    pincode,
    landmark,
    mapsLink,
    mobile,
  } = body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    /* ✅ STEP 1: doctorId */
    const [[doc]] = await connection.query(
      `SELECT id FROM doctors WHERE user_id = ?`,
      [userId],
    );

    if (!doc) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    /* ================= DOCTOR TABLE ================= */
    const doctorFields = [];
    const doctorValues = [];

    if (doctorName !== undefined) {
      doctorFields.push("doctorName = ?");
      doctorValues.push(doctorName || null);
    }

    if (degree !== undefined) {
      doctorFields.push("degree = ?");
      doctorValues.push(degree || null);
    }

    if (specialization !== undefined) {
      doctorFields.push("specialization = ?");
      doctorValues.push(specialization || null);
    }

    if (bio !== undefined) {
      doctorFields.push("bio = ?");
      doctorValues.push(bio || null);
    }

    if (consultationFee !== undefined) {
      doctorFields.push("consultationFee = ?");
      doctorValues.push(Number(consultationFee) || null);
    }

    if (consultation_duration !== undefined) {
      doctorFields.push("consultation_duration = ?");
      doctorValues.push(consultation_duration || null);
    }

    if (experience_years !== undefined) {
      doctorFields.push("experience_years = ?");
      doctorValues.push(Number(experience_years) || null);
    }

    if (licenseNumber !== undefined) {
      doctorFields.push("licenseNumber = ?");
      doctorValues.push(licenseNumber || null);
    }

    if (state_council !== undefined) {
      doctorFields.push("state_council = ?");
      doctorValues.push(state_council || null);
    }

    if (valid_till !== undefined) {
      doctorFields.push("valid_till = ?");
      doctorValues.push(formatDate(valid_till));
    }

    if (practice_type !== undefined) {
      doctorFields.push("practice_type = ?");
      doctorValues.push(practice_type || null);
    }

    if (hospital_name !== undefined) {
      doctorFields.push("hospital_name = ?");
      doctorValues.push(hospital_name || null);
    }

    if (availableDays !== undefined) {
      doctorFields.push("availableDays = ?");
      doctorValues.push(JSON.stringify(availableDays || []));
    }

    if (doctorFields.length > 0) {
      doctorValues.push(userId);
      await connection.query(
        `UPDATE doctors SET ${doctorFields.join(", ")} WHERE user_id = ?`,
        doctorValues,
      );
    }

    // ✅ Normalize input (only valid values)
    const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const selectedDays = (availableDays || []).filter((d) =>
      validDays.includes(d),
    );

    // ❗ If no days → delete all
    if (availableDays !== undefined) {
      if (selectedDays.length === 0) {
        await connection.query(
          `DELETE FROM doctor_availability WHERE doctor_id = ?`,
          [doctorId],
        );
      } else {
        // 1️⃣ DELETE unwanted days
        await connection.query(
          `DELETE FROM doctor_availability 
       WHERE doctor_id = ? AND day_code NOT IN (${selectedDays.map(() => "?").join(",")})`,
          [doctorId, ...selectedDays],
        );

        // 2️⃣ INSERT missing days (bulk safe)
        const values = [];

        for (const day of selectedDays) {
          values.push([
            doctorId,
            day,
            "05:00:00",
            "12:00:00",
            "12:00:00",
            "20:00:00",
          ]);
        }

        await connection.query(
          `INSERT IGNORE INTO doctor_availability 
      (doctor_id, day_code, morning_start, morning_end, evening_start, evening_end)
      VALUES ?`,
          [values],
        );
      }
    }

    /* ================= USERS TABLE ================= */

    if (mobile !== undefined) {
      const [[current]] = await connection.query(
        `SELECT mobile FROM users WHERE id = ?`,
        [userId],
      );

      if (current.mobile !== mobile) {
        const [[existing]] = await connection.query(
          `SELECT id FROM users WHERE mobile = ?`,
          [mobile],
        );

        if (existing) {
          await connection.rollback();
          return res.status(400).json({
            message: "Mobile number already in use",
          });
        }

        await connection.query(`UPDATE users SET mobile = ? WHERE id = ?`, [
          mobile,
          userId,
        ]);
      }
    }

    /* ================= CLINIC TABLE ================= */

    const [[clinic]] = await connection.query(
      `SELECT id FROM doctor_clinics WHERE doctor_id = ? LIMIT 1`,
      [doctorId],
    );

    const clinicFields = [];
    const clinicValues = [];

    if (typeof clinic_name === "string" && clinic_name.trim() !== "") {
      clinicFields.push("clinic_name = ?");
      clinicValues.push(clinic_name.trim());
    }

    if (typeof city === "string" && city.trim() !== "") {
      clinicFields.push("city = ?");
      clinicValues.push(city.trim());
    }

    if (typeof address === "string" && address.trim() !== "") {
      clinicFields.push("address = ?");
      clinicValues.push(address.trim());
    }

    if (typeof state === "string" && state.trim() !== "") {
      clinicFields.push("state = ?");
      clinicValues.push(state.trim());
    }

    if (typeof pincode === "string" && pincode.trim() !== "") {
      clinicFields.push("pincode = ?");
      clinicValues.push(pincode.trim());
    }

    if (typeof landmark === "string" && landmark.trim() !== "") {
      clinicFields.push("landmark = ?");
      clinicValues.push(landmark.trim());
    }

    if (typeof mapsLink === "string" && mapsLink.trim() !== "") {
      clinicFields.push("maps_link = ?");
      clinicValues.push(mapsLink.trim());
    }

    if (languages !== undefined && languages.length > 0) {
      clinicFields.push("languages = ?");
      clinicValues.push(JSON.stringify(languages));
    }

    if (clinic) {
      if (clinicFields.length > 0) {
        clinicValues.push(doctorId);
        await connection.query(
          `UPDATE doctor_clinics SET ${clinicFields.join(", ")} WHERE doctor_id = ?`,
          clinicValues,
        );
      }
    } else {
      await connection.query(
        `INSERT INTO doctor_clinics 
        (doctor_id, clinic_name, city, address, state, pincode, landmark, maps_link, languages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doctorId,
          clinic_name || null,
          city || null,
          address || null,
          state || null,
          pincode || null,
          landmark || null,
          mapsLink || null,
          JSON.stringify(languages || []),
        ],
      );
    }

    await connection.commit();

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    await connection.rollback();
    console.error("updateDoctorProfile error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

// getDoctorProfile

exports.getDoctorProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    /* ✅ STEP 1: Get doctor.id */
    const [[doc]] = await db.query("SELECT id FROM doctors WHERE user_id = ?", [
      userId,
    ]);

    if (!doc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doc.id;

    /* ✅ STEP 2: Main profile query (WITHOUT clinic JOIN) */
    const [[doctor]] = await db.query(
      `SELECT 
        d.id,
        d.doctorName,
        d.gender,
        d.bio,
        d.degree,
        d.specialization,
        d.experience_years,
        d.licenseNumber,
        d.state_council,
        d.valid_till,
        d.consultationFee,
        d.consultation_duration,
        d.availableDays,
        d.practice_type,
        d.hospital_name,
        d.status,

        u.email,
        u.mobile,

        f.rating,
        f.total_reviews,

        /* documents */
        (
          SELECT MAX(file_path)
          FROM doctor_documents 
          WHERE doctor_id = d.id AND doc_type = 'profile'
        ) AS profile_picture,

        (
          SELECT MAX(file_path)
          FROM doctor_documents 
          WHERE doctor_id = d.id AND doc_type = 'certificate'
        ) AS certificate,

        (
          SELECT MAX(file_path)
          FROM doctor_documents 
          WHERE doctor_id = d.id AND doc_type = 'idProof'
        ) AS id_proof

      FROM doctors d
      LEFT JOIN users u ON u.id = d.user_id

      LEFT JOIN (
        SELECT
          doctor_id,
          ROUND(AVG(rating), 1) AS rating,
          COUNT(*) AS total_reviews
        FROM doctor_feedback
        GROUP BY doctor_id
      ) f ON f.doctor_id = d.id

      WHERE d.id = ?
      LIMIT 1`,
      [doctorId],
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    /* ── JSON parse ── */
    if (doctor.availableDays && typeof doctor.availableDays === "string") {
      try {
        doctor.availableDays = JSON.parse(doctor.availableDays);
      } catch {
        doctor.availableDays = [];
      }
    }

    /* ✅ FIX 1: Rating number */
    doctor.rating = doctor.rating ? Number(doctor.rating) : 0;

    doctor.documents = {
      profile_picture: doctor.profile_picture || null,
      certificate: doctor.certificate || null,
      id_proof: doctor.id_proof || null,
    };
    console.log("✅ Final documents object:", doctor.documents);

    delete doctor.profile_picture;
    delete doctor.certificate;
    delete doctor.id_proof;

    /* ✅ FIX 2: Clinics as array */
    const [clinics] = await db.query(
      `SELECT clinic_name, address, city, state, pincode, landmark, maps_link, languages
       FROM doctor_clinics
       WHERE doctor_id = ?`,
      [doctorId],
    );

    // parse languages JSON
    doctor.clinic =
      clinics.length > 0
        ? {
            clinic_name: clinics[0].clinic_name,
            address: clinics[0].address,
            city: clinics[0].city,
            state: clinics[0].state,
            pincode: clinics[0].pincode,
            landmark: clinics[0].landmark,
            mapsLink: clinics[0].maps_link,
            languages:
              typeof clinics[0].languages === "string"
                ? JSON.parse(clinics[0].languages)
                : clinics[0].languages,
          }
        : null;

    /* ✅ FIX 3: Availability + day mapping (FINAL CLEAN) */

    const [availability] = await db.query(
      `SELECT day_code, morning_start, morning_end, evening_start, evening_end
   FROM doctor_availability
   WHERE doctor_id = ?`,
      [doctorId],
    );

    // ✅ Normalize + remove invalid rows
    const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    doctor.availability = availability
      .filter((a) => a.day_code && validDays.includes(a.day_code))
      .map((a) => ({
        ...a,
        day: a.day_code,
      }));

    // ✅ Only send selected days
    doctor.availableDays = doctor.availability.map((a) => a.day);

    res.json({ doctor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllDoctors = async (req, res) => {
  try {
    const [doctors] = await db.query(`
  SELECT
    d.id AS _id,
    d.doctorName,
    d.specialization,
    d.experience_years,
    d.rating,
    dd.file_path AS profile_image
  FROM doctors d
  LEFT JOIN doctor_documents dd
    ON dd.doctor_id = d.id
    AND dd.doc_type = 'profile'
  WHERE d.status = 'APPROVED'
  ORDER BY d.rating DESC
  LIMIT 5
`);

    return res.status(200).json({
      success: true,
      doctors,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
