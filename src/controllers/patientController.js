const db = require("../config/db");
const bcrypt = require("bcryptjs");
const eventBus = require("../events/eventBus");
const {
  APPOINTMENT_CANCELLED_BY_PATIENT,
} = require("../events/notification.events");

const upload = require("../middleware/upload.middleware");

// Add Family Members helpers

const ALLOWED_RELATIONS = [
  "FATHER",
  "MOTHER",
  "SPOUSE",
  "SON",
  "DAUGHTER",
  "BROTHER",
  "SISTER",
  "OTHER",
];

// Add Family Members helpers
const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

// Patient Registration

exports.register = async (req, res) => {
  let { fullName, phone, email, password, confirmPassword, gender, dob } =
    req.body;

  // -------------------------
  // 🔎 Basic Required Fields
  // -------------------------
  if (
    !fullName ||
    !phone ||
    !email ||
    !password ||
    !confirmPassword ||
    !gender ||
    !dob
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  // -------------------------
  // 📧 Normalize Email
  // -------------------------
  email = email.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  // -------------------------
  // 📱 Normalize Phone
  // -------------------------
  phone = phone.replace(/\D/g, "");

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Invalid phone number",
    });
  }

  // -------------------------
  // 🎂 Age Validation (18+)
  // -------------------------
  const dobDate = new Date(dob);
  const today = new Date();

  if (dobDate > today) {
    return res.status(400).json({
      success: false,
      message: "DOB cannot be in the future",
    });
  }

  const age =
    today.getFullYear() -
    dobDate.getFullYear() -
    (today <
    new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate())
      ? 1
      : 0);

  if (age < 18) {
    return res.status(400).json({
      success: false,
      message: "User must be at least 18 years old",
    });
  }

  // -------------------------
  // 🔐 Password Validation
  // -------------------------
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Passwords do not match",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters",
    });
  }

  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;

  if (!strongPasswordRegex.test(password)) {
    return res.status(400).json({
      success: false,
      message:
        "Password must include uppercase, lowercase, number and special character",
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // -------------------------
    // 🚫 Check Duplicate (DB protected but pre-check for UX)
    // -------------------------
    const [existingUser] = await connection.query(
      `SELECT id FROM users WHERE email = ? OR mobile = ? LIMIT 1`,
      [email, phone],
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // -------------------------
    // 🔐 Strong Hash (12 rounds)
    // -------------------------
    const hashedPassword = await bcrypt.hash(password, 12);

    // -------------------------
    // ✅ Insert into users (role fixed)
    // -------------------------
    const [userResult] = await connection.query(
      `INSERT INTO users (email, mobile, password, role, is_active)
       VALUES (?, ?, ?, 'PATIENT', 1)`,
      [email, phone, hashedPassword],
    );

    // -------------------------
    // ✅ Insert into patients
    // -------------------------
    await connection.query(
      `INSERT INTO patients
       (user_id, fullName, phone, gender, dob, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userResult.insertId, (fullName || "").trim(), phone, gender, dob, email],
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Patient registered successfully",
    });
  } catch (err) {
    await connection.rollback();

    // Handle MySQL duplicate key safety
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    connection.release();
  }
};

// Get Patient Profile

exports.getProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await db.query(
      `SELECT 
        p.id,
        p.fullName,
        p.phone,
        u.email,
        u.mobile,
        p.gender,
        p.dob
       FROM patients p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ? AND u.is_active = 1
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update Patient Profile

exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  let { fullName, phone, gender, dob } = req.body;

  const patientFields = [];
  const patientValues = [];

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // -------------------------
    // 📱 Phone Update
    // -------------------------
    if (phone) {
      phone = phone.replace(/\D/g, "");

      if (!/^[6-9]\d{9}$/.test(phone)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid phone number",
        });
      }

      const [existing] = await connection.query(
        `SELECT id FROM users WHERE mobile = ? AND id != ? LIMIT 1`,
        [phone, userId],
      );

      if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "Mobile already in use",
        });
      }

      await connection.query(`UPDATE users SET mobile = ? WHERE id = ?`, [
        phone,
        userId,
      ]);

      patientFields.push("phone = ?");
      patientValues.push(phone);
    }

    // -------------------------
    // Full Name
    // -------------------------
    if (fullName) {
      patientFields.push("fullName = ?");
      patientValues.push((fullName || "").trim());
    }

    // -------------------------
    // Gender (Optional enum check)
    // -------------------------
    if (gender) {
      const allowed = ["MALE", "FEMALE", "OTHER"];
      if (!allowed.includes(gender)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid gender value",
        });
      }

      patientFields.push("gender = ?");
      patientValues.push(gender);
    }

    // -------------------------
    // DOB Validation (18+)
    // -------------------------
    if (dob) {
      const dobDate = new Date(dob);
      const today = new Date();

      if (dobDate > today) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "DOB cannot be in the future",
        });
      }

      const age =
        today.getFullYear() -
        dobDate.getFullYear() -
        (today <
        new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate())
          ? 1
          : 0);

      if (age < 18) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "User must be at least 18 years old",
        });
      }

      patientFields.push("dob = ?");
      patientValues.push(dob);
    }

    if (patientFields.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "No fields provided to update",
      });
    }

    patientValues.push(userId);

    const [result] = await connection.query(
      `UPDATE patients 
       SET ${patientFields.join(", ")} 
       WHERE user_id = ?`,
      patientValues,
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (err) {
    await connection.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Duplicate entry",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    connection.release();
  }
};

// Update changePassword

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const [users] = await db.query(`SELECT password FROM users WHERE id = ?`, [
      userId,
    ]);

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[0].password);

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(`UPDATE users SET password = ? WHERE id = ?`, [
      hashedPassword,
      userId,
    ]);

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Patient getDashboard

exports.getDashboard = async (req, res) => {
  const patientId = req.user.id;

  try {
    // ✅ 0️⃣ Patient name (ADD THIS)
    const [[patient]] = await db.query(
      `SELECT fullName FROM patients WHERE user_id = ?`,
      [patientId],
    );

    // 1️⃣ Upcoming appointments count
    const [[upcoming]] = await db.query(
      `SELECT COUNT(*) AS count
FROM appointments a
WHERE a.patient_id = ?
AND a.appointment_date >= CURDATE()
AND a.status IN ('PENDING','ACCEPTED')`,
      [patientId],
    );

    // 2️⃣ Today's active token
    const [[todayToken]] = await db.query(
      `SELECT 
   a.id,
   a.appointment_type,
   a.appointment_slot,
   a.token_number
FROM appointments a
WHERE a.patient_id = ?
AND a.appointment_date = CURDATE()
AND a.appointment_type IN ('CLINIC','HOSPITAL')
AND a.status IN ('PENDING','ACCEPTED','IN_PROGRESS')
ORDER BY a.appointment_slot, a.token_number
LIMIT 1`,
      [patientId],
    );

    // 3️⃣ Upcoming appointments list
    const [appointments] = await db.query(
      `SELECT
  a.id,
  a.family_member_id, 
  d.doctorName,
  d.degree AS qualification,
  d.specialization,
d.consultationFee AS consultationFee,
  dc.city,
  d.experience_years AS experience,
  d.rating,
  dc.clinic_name,
  dc.languages,
  dc.address,
  u.profile_image,
  a.appointment_type,
  a.appointment_date,
  a.appointment_slot,
  a.token_number,
  a.status,
  fm.full_name AS familyName,
  fm.relation
FROM appointments a
JOIN doctors d ON a.doctor_id = d.id
JOIN doctor_clinics dc ON a.doctor_id = dc.doctor_id
JOIN users u
  ON u.id = d.user_id
LEFT JOIN family_members fm
  ON a.family_member_id = fm.id
WHERE a.patient_id = ?
AND a.appointment_date >= CURDATE()
AND a.status IN ('PENDING','ACCEPTED')
ORDER BY a.appointment_date ASC, a.appointment_slot, a.token_number`,
      [patientId],
    );

    // ✅ FINAL RESPONSE (YEH WAHI JAGAH HAI)
    return res.status(200).json({
      patientName: patient?.fullName || "Patient", // 👈 YAHAN

      upcomingCount: upcoming.count,
      todayToken: todayToken
        ? {
            appointmentId: todayToken.id,
            type: todayToken.appointment_type,
            slot: todayToken.appointment_slot,
            token: todayToken.token_number,
          }
        : null,
      appointments,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// PATIENT searchVisitDoctors

exports.searchVisitDoctors = async (req, res) => {
  let search = req.query.search?.trim().trim() || "";
  let city = req.query.city?.trim().trim() || "";

  let page = parseInt(req.query.page, 10) || 1;
  let limit = parseInt(req.query.limit, 10) || 10;

  // -------------------------
  // 🔐 Pagination Safety
  // -------------------------
  if (page < 1) page = 1;
  if (limit < 1) limit = 10;
  if (limit > 50) limit = 50; // prevent heavy load abuse

  const offset = (page - 1) * limit;

  try {
    const [doctors] = await db.query(
      `SELECT 
          d.id AS doctorId,
          d.doctorName,
          d.specialization,
          dc.clinic_name AS clinicName,
          dc.city,
          d.rating,
          d.consultationFee,
          d.experience_years AS experience,
          u.profile_image
        FROM doctors d
        LEFT JOIN users u ON u.id = d.user_id
        LEFT JOIN doctor_clinics dc ON dc.doctor_id = d.id
        WHERE d.status = 'APPROVED'
        AND (
          ? = '' OR
          d.doctorName LIKE ? OR
          d.specialization LIKE ? OR
          dc.clinic_name LIKE ?
        )
        AND (? = '' OR dc.city LIKE ?)
        ORDER BY d.rating DESC
        LIMIT ? OFFSET ?`,
      [
        search,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        city,
        `%${city}%`,
        limit,
        offset,
      ],
    );

    return res.status(200).json({
      success: true,
      data: {
        page,
        limit,
        count: doctors.length,
        doctors,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getDoctorById = async (req, res) => {
  const doctorId = req.params.id;

  try {
    // ✅ FIXED: removed d.qualification (column doesn't exist — use d.degree instead)
    // ✅ FIXED: removed d.available_days (column doesn't exist — availability is in
    //           doctor_availability table, joined below as a JSON-aggregated field)
    const [rows] = await db.query(
      `SELECT
  d.id AS doctorId,
  d.doctorName,
  d.specialization,
  d.degree,
  d.degree AS qualification,
  dc.clinic_name AS clinicName,
  dc.address,
  dc.city,
  d.licenseNumber,
  d.consultationFee,
  d.experience_years,
  d.rating,
  dc.languages,
  d.bio AS description,
  d.consultation_duration AS timings,
  u.profile_image,
  (
    SELECT JSON_ARRAYAGG(da.day_code)
    FROM doctor_availability da
    WHERE da.doctor_id = d.id
  ) AS availableDays
FROM doctors d
LEFT JOIN users u ON u.id = d.user_id
LEFT JOIN doctor_clinics dc ON dc.doctor_id = d.id
WHERE d.id = ?`,
      [doctorId],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.json({
      success: true,
      doctor: rows[0],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// getCurrentToken controller
exports.getCurrentToken = async (req, res) => {
  const { doctorId, appointmentDate, appointmentSlot } = req.query;

  try {
    console.log(req.query);

    const [[result]] = await db.query(
      `SELECT COUNT(*) AS currentToken
       FROM appointments
       WHERE doctor_id = ?
       AND DATE(appointment_date) = DATE(?)
       AND UPPER(appointment_slot) = UPPER(?)`,
      [doctorId, appointmentDate, appointmentSlot],
    );

    console.log("DB Result:", result);

    return res.json({
      success: true,
      currentToken: result.currentToken || 0,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message,
    });
  }
};

// getdoctorname controller

exports.getDoctorNames = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT doctorName AS name
       FROM doctors
       WHERE status = 'APPROVED'
       AND doctorName IS NOT NULL
       ORDER BY doctorName`,
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// getCities controller
// ✅ FIXED: was querying 'city' from 'doctors' table — column doesn't exist there.
// City is stored in doctor_clinics table.
// exports.getCities = async (req, res) => {
//   try {
//     const [rows] = await db.query(`
//       SELECT DISTINCT
//         dc.city,
//         dc.address,
//         dc.landmark,
//         CONCAT(
//           dc.city,
//           IF(dc.landmark IS NOT NULL, CONCAT(', ', dc.landmark), ''),
//           IF(dc.address IS NOT NULL, CONCAT(', ', dc.address), '')
//         ) AS label
//       FROM doctor_clinics dc
//       JOIN doctors d ON d.id = dc.doctor_id
//       WHERE d.status = 'APPROVED'
//         AND dc.city IS NOT NULL
//       ORDER BY dc.city
//     `);

//     return res.status(200).json({
//       success: true,
//       data: rows,
//     });
//   } catch (err) {
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };

exports.getCities = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";

    const [rows] = await db.query(
      `
      SELECT 
        dc.city,
        dc.address,
        dc.landmark,

        CASE 
          WHEN dc.landmark IS NOT NULL THEN 'landmark'
          ELSE 'city'
        END AS type,

        CONCAT(
          dc.city,
          IF(dc.landmark IS NOT NULL, CONCAT(', ', dc.landmark), ''),
          IF(dc.address IS NOT NULL, CONCAT(', ', dc.address), '')
        ) AS label

      FROM doctor_clinics dc
      JOIN doctors d ON d.id = dc.doctor_id
      WHERE d.status = 'APPROVED'
        AND dc.city IS NOT NULL

        AND (
          ? = '' OR
          dc.city LIKE ? OR
          dc.landmark LIKE ? OR
          dc.address LIKE ?
        )

      ORDER BY 
        CASE 
          WHEN dc.city LIKE ? THEN 1
          WHEN dc.landmark LIKE ? THEN 2
          ELSE 3
        END,
        dc.city ASC

      LIMIT 20
      `,
      [
        search,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `${search}%`,
        `${search}%`,
      ],
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// disease controller

exports.getDiseases = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT specialization AS name
       FROM doctors
       WHERE status = 'APPROVED'
       AND specialization IS NOT NULL
       ORDER BY specialization`,
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// returns both clinic & hospital names controller
// ✅ FIXED: was querying 'clinicName' from 'doctors' table — column doesn't exist there.
// Clinic names are stored in doctor_clinics table.
exports.getPlaceNames = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT dc.clinic_name AS name
       FROM doctor_clinics dc
       JOIN doctors d ON d.id = dc.doctor_id
       WHERE d.status = 'APPROVED'
       AND dc.clinic_name IS NOT NULL
       ORDER BY dc.clinic_name`,
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PATIENT bookVisitAppointment

exports.bookVisitAppointment = async (req, res) => {
  const patientId = req.user.id;

  const {
    doctorId,
    appointmentType,
    appointmentDate,
    slot,
    familyMemberIds = [],
  } = req.body;

  if (!doctorId || appointmentType !== "CLINIC") {
    return res.status(400).json({ message: "Invalid request" });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const getTodayDate = () => {
      const now = new Date();
      return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0];
    };

    const today = getTodayDate();

    const isToday = appointmentDate === today;

    // ✅ ADD THIS
    const [year, month, day] = appointmentDate.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);

    const daysMap = {
      0: "Sun",
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
    };

    const dayCode = daysMap[localDate.getDay()];

    // ✅ THEN query
    const [availabilityRows] = await connection.query(
      `SELECT morning_start, morning_end, evening_start, evening_end
   FROM doctor_availability
   WHERE doctor_id = ? AND day_code = ?`,
      [doctorId, dayCode],
    );

    if (
      !availabilityRows ||
      availabilityRows.length === 0 ||
      !availabilityRows[0]
    ) {
      throw new Error("Doctor not available this day");
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

    // ❌ Edge Case 2: Slot not available
    if (slot === "MORNING" && (!morningStart || !morningEnd)) {
      throw new Error("Doctor not available in morning");
    }

    if (slot === "EVENING" && (!eveningStart || !eveningEnd)) {
      throw new Error("Doctor not available in evening");
    }

    // ❌ Edge Case 1 & 6: Today cutoff (boundary handled)
    if (isToday) {
      if (slot === "MORNING") {
        const cutoff = morningEnd - 10;
        if (currentHHMM >= cutoff) {
          throw new Error("Morning booking closed");
        }
      }

      if (slot === "EVENING") {
        const cutoff = eveningEnd - 10;
        if (currentHHMM >= cutoff) {
          throw new Error("Evening booking closed");
        }
      }
    }

    // ❌ Edge Case 3 & 4: Duplicate active token (same slot)
    const [[existing]] = await connection.query(
      `SELECT id FROM appointments
       WHERE patient_id = ?
       AND doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?
       AND status IN ('PENDING','ACCEPTED','IN_PROGRESS')`,
      [patientId, doctorId, appointmentDate, slot],
    );

    if (existing && familyMemberIds.length === 0) {
      throw new Error("You already have active token");
    }

    // ❌ Edge Case 5: Max 50 tokens per shift
    const [[countRow]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?`,
      [doctorId, appointmentDate, slot],
    );

    const MAX_TOKENS = 50;

    if (countRow.total >= MAX_TOKENS) {
      throw new Error(`${slot} shift full`);
    }

    // 🔢 Token generation (safe)
    const [[row]] = await connection.query(
      `SELECT MAX(token_number) AS lastToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?
       FOR UPDATE`,
      [doctorId, appointmentDate, slot],
    );

    const nextToken = (row.lastToken || 0) + 1;

    const familyMemberId =
      familyMemberIds.length > 0 ? familyMemberIds[0] : null;

    const [result] = await connection.query(
      `INSERT INTO appointments
      (appointment_type, patient_id, family_member_id, doctor_id,
       appointment_date, appointment_slot, token_number, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PATIENT')`,
      [
        appointmentType,
        patientId,
        familyMemberId,
        doctorId,
        appointmentDate,
        slot,
        nextToken,
      ],
    );

    // ✅ STEP: get doctor user_id
    const [[doctor]] = await connection.query(
      `SELECT user_id FROM doctors WHERE id = ?`,
      [doctorId],
    );

    // ✅ Notification insert for doctor
    await connection.query(
      `INSERT INTO notifications
   (receiver_id, receiver_role, title, message, appointment_id)
   VALUES (?, 'DOCTOR', ?, ?, ?)`,
      [
        doctor.user_id,
        "New Appointment Request",
        "You have a new appointment request from patient.",
        result.insertId,
      ],
    );

    await connection.commit();

    res.status(201).json({
      message: "Clinic appointment booked",
      data: {
        appointmentId: result.insertId,
        token: nextToken,
        slot: slot,
      },
    });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ message: err.message });
  } finally {
    connection.release();
  }
};

// PATIENT getClinicAppointments

exports.getClinicAppointments = async (req, res) => {
  const userId = req.user.id;

  try {
    const [appointments] = await db.query(
      `SELECT
        a.id,
        a.doctor_id AS doctorId,
        d.doctorName,
        a.appointment_date,
        a.appointment_slot,
        a.token_number,
        a.status
       FROM appointments a
       JOIN appointment_patients ap
         ON a.id = ap.appointment_id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE ap.patient_id = ?
       AND a.appointment_date >= CURDATE()
       AND a.status IN ('PENDING','ACCEPTED')
       ORDER BY a.appointment_date ASC,
                a.appointment_slot,
                a.token_number
       LIMIT 50`,
      [userId],
    );

    return res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PATIENT cancelClinicAppointment

exports.cancelAppointment = async (req, res) => {
  const userId = req.user.id;

  const appointmentId = parseInt(req.params.id, 10);

  if (!appointmentId || appointmentId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid appointment id",
    });
  }

  try {
    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'CANCELLED'
       WHERE id = ?
       AND patient_id = ?
       AND status IN ('PENDING','ACCEPTED')
       AND appointment_date >= CURDATE()`,
      [appointmentId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Only pending or accepted future appointments can be cancelled",
      });
    }

    eventBus.emit(APPOINTMENT_CANCELLED_BY_PATIENT, {
      eventType: APPOINTMENT_CANCELLED_BY_PATIENT,
      appointmentId,
      patient: { id: userId },
    });

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PATIENT getVisitAppointmentHistory

exports.getVisitAppointmentHistory = async (req, res) => {
  const userId = req.user.id;

  let limit = parseInt(req.query.limit, 10) || 10;
  if (limit <= 0) limit = 10;
  if (limit > 50) limit = 50;

  const cursor = req.query.cursor;

  let cursorCondition = "";
  let queryParams = [userId, userId]; // patient + family member

  if (cursor) {
    const [cursorDateRaw, cursorId] = cursor.split("_");

    const cursorDate = new Date(cursorDateRaw).toISOString().split("T")[0];

    cursorCondition = `
    AND (
      a.appointment_date < ?
      OR (a.appointment_date = ? AND a.id < ?)
    )
  `;

    queryParams.push(cursorDate, cursorDate, cursorId);
  }

  queryParams.push(limit);

  try {
    const [appointments] = await db.query(
      `SELECT
        a.id,
        a.doctor_id AS doctorId,
        d.doctorName,
        d.specialization,
        u.profile_image,
        DATE_FORMAT(a.appointment_date, '%d %b %Y') AS appointment_date,
        a.appointment_slot,
        a.token_number,
        a.status,
      CASE 
  WHEN a.family_member_id IS NOT NULL THEN fm.full_name
  ELSE p.fullName
END AS patientName,

CASE 
  WHEN a.family_member_id IS NOT NULL THEN 1
  ELSE 0
END AS isFamily,
        a.created_by
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN users u
         ON u.id = d.user_id

       LEFT JOIN patients p
          ON a.patient_id = p.user_id

       
        LEFT JOIN family_members fm
          ON a.family_member_id = fm.id
       WHERE
       (
         a.patient_id = ?
         OR a.family_member_id IN (
             SELECT fm.id FROM family_members fm WHERE fm.patient_id = ?


         )
       )
       AND a.status IN ('COMPLETED','CANCELLED','REJECTED')
       ${cursorCondition}
       ORDER BY a.appointment_date DESC,
                a.id DESC
       LIMIT ?`,
      queryParams,
    );

    let nextCursor = null;

    if (appointments.length === limit) {
      const last = appointments[appointments.length - 1];
      nextCursor = `${last.appointment_date}_${last.id}`;
    }

    return res.status(200).json({
      success: true,
      count: appointments.length,
      nextCursor,
      data: appointments,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//getUpcomingAppointments

exports.getUpcomingAppointments = async (req, res) => {
  const userId = req.user.id;
  const filter = req.query.filter;

  const allowedFilters = ["today", "next7"];
  let dateCondition = "a.appointment_date >= CURDATE()";

  if (filter && !allowedFilters.includes(filter)) {
    return res.status(400).json({
      success: false,
      message: "Invalid filter",
    });
  }

  if (filter === "today") {
    dateCondition = "a.appointment_date = CURDATE()";
  }

  if (filter === "next7") {
    dateCondition =
      "a.appointment_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";
  }

  try {
    const [appointments] = await db.query(
      `SELECT
        a.id,
        d.doctorName,
        a.appointment_date,
        a.appointment_slot,
        a.token_number,
        a.status
       FROM appointments a
       JOIN appointment_patients ap
         ON a.id = ap.appointment_id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE ap.patient_id = ?
       AND ${dateCondition}
       AND a.status IN ('PENDING','ACCEPTED')
       ORDER BY a.appointment_date,
                a.appointment_slot,
                a.token_number
       LIMIT 50`,
      [userId],
    );

    return res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PATIENT qrBookVisit

exports.qrBookVisit = async (req, res) => {
  const patientId = req.user.id;
  const { doctorId, familyMemberIds = [] } = req.body;

  if (!doctorId) {
    return res.status(400).json({ message: "Doctor ID required" });
  }

  const getTodayDate = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
  };
  const appointmentDate = getTodayDate();

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[doctor]] = await connection.query(
      `SELECT id FROM doctors WHERE id = ? AND status = 'APPROVED'`,
      [doctorId],
    );

    if (!doctor) throw new Error("Doctor not available");

    const now = new Date();
    const currentHHMM = now.getHours() * 60 + now.getMinutes();
    const daysMap = {
      0: "Sun",
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
    };

    const todayDayCode = daysMap[now.getDay()];

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

    let selectedShift = null;

    // ✅ Only END TIME check (no start time, no cutoff)
    if (
      morningStart !== null &&
      morningEnd !== null &&
      currentHHMM < morningEnd
    ) {
      selectedShift = "MORNING";
    } else if (
      eveningStart !== null &&
      eveningEnd !== null &&
      currentHHMM < eveningEnd
    ) {
      selectedShift = "EVENING";
    }

    if (!selectedShift) {
      throw new Error("Booking closed for today");
    }

    // ❌ Duplicate same doctor + same slot
    const [[existing]] = await connection.query(
      `SELECT a.id
       FROM appointments a
       JOIN appointment_patients ap
         ON a.id = ap.appointment_id
       WHERE ap.patient_id = ?
       AND a.doctor_id = ?
       AND a.appointment_date = ?
       AND a.appointment_slot = ?
       AND a.status IN ('PENDING','ACCEPTED','IN_PROGRESS')`,
      [patientId, doctorId, appointmentDate, selectedShift],
    );

    if (existing && familyMemberIds.length === 0) {
      throw new Error("You already have active token");
    }

    // ❌ Max 50 tokens
    const [[countRow]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?`,
      [doctorId, appointmentDate, selectedShift],
    );

    const MAX_TOKENS = 50;

    if (countRow.total >= MAX_TOKENS) {
      throw new Error(`${selectedShift} shift full`);
    }

    // 🔢 Token generation (safe)
    const [[row]] = await connection.query(
      `SELECT MAX(token_number) AS lastToken
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?
       FOR UPDATE`,
      [doctorId, appointmentDate, selectedShift],
    );

    const nextToken = (row.lastToken || 0) + 1;

    const familyMemberId =
      familyMemberIds.length > 0 ? familyMemberIds[0] : null;
    const [result] = await connection.query(
      `INSERT INTO appointments
  (appointment_type, patient_id, family_member_id, doctor_id,
   appointment_date, appointment_slot,
   token_number, status, created_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'QR')`,
      [
        "CLINIC",
        patientId,
        familyMemberId,
        doctorId,
        appointmentDate,
        selectedShift,
        nextToken,
      ],
    );

    const appointmentId = result.insertId;

    await connection.query(
      `INSERT INTO appointment_patients (appointment_id, patient_id)
       VALUES (?, ?)`,
      [appointmentId, patientId],
    );

    for (const memberId of familyMemberIds) {
      await connection.query(
        `INSERT INTO appointment_patients (appointment_id, family_member_id)
         VALUES (?, ?)`,
        [appointmentId, memberId],
      );
    }

    await connection.commit();

    return res.status(201).json({
      data: {
        message: "QR appointment booked",
        appointmentId,
        token: nextToken,
        slot: selectedShift,
      },
    });
  } catch (err) {
    await connection.rollback();
    return res.status(400).json({ message: err.message });
  } finally {
    connection.release();
  }
};
// getTokenStatus

exports.getTokenStatus = async (req, res) => {
  const patientId = req.user.id;
  const { appointmentId } = req.params;

  try {
    // ✅ FIXED APPOINTMENT QUERY
    const [[appointment]] = await db.query(
      `SELECT 
        a.id,
        a.doctor_id,
        a.token_number,
        a.appointment_date,
        a.appointment_slot,
        a.status,
        d.consultation_duration
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = ?
       AND (
         a.patient_id = ?
         OR a.id IN (
           SELECT appointment_id 
           FROM appointment_patients 
           WHERE patient_id = ?
         )
       )`,
      [appointmentId, patientId, patientId],
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // ✅ SLOT BASED IN_PROGRESS
    const [[inProgress]] = await db.query(
      `SELECT token_number
       FROM appointments
       WHERE doctor_id = ?
       AND appointment_date = ?
       AND appointment_slot = ?
       AND status = 'IN_PROGRESS'
       ORDER BY token_number
       LIMIT 1`,
      [
        appointment.doctor_id,
        appointment.appointment_date,
        appointment.appointment_slot,
      ],
    );

    let nowServing = null;
    if (inProgress) {
      nowServing = inProgress.token_number;
    }

    // ✅ WAIT TIME
    const durationMins = parseInt(appointment.consultation_duration, 10) || 5;

    const estimatedWaitMinutes =
      nowServing !== null
        ? Math.max(appointment.token_number - nowServing, 0) * durationMins
        : 0;

    return res.json({
      yourToken: appointment.token_number,
      nowServing,
      status: appointment.status,
      estimatedWaitMinutes,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
//addFamilyMember

exports.addFamilyMember = async (req, res) => {
  const patientId = req.user.id;
  const { fullName, gender, dob, bloodGroup, heightCm, weightKg, relation } =
    req.body;

  if (!fullName || !relation) {
    return res.status(400).json({
      message: "fullName and relation are required",
    });
  }

  if (!ALLOWED_RELATIONS.includes(relation)) {
    return res.status(400).json({ message: "Invalid relation type" });
  }

  if (dob && isFutureDate(dob)) {
    return res.status(400).json({ message: "DOB cannot be in the future" });
  }

  if (heightCm && isNaN(heightCm)) {
    return res.status(400).json({ message: "Invalid height value" });
  }

  if (weightKg && isNaN(weightKg)) {
    return res.status(400).json({ message: "Invalid weight value" });
  }

  try {
    // 🚫 Duplicate check
    const [[exists]] = await db.query(
      `SELECT id FROM family_members
       WHERE patient_id = ? AND full_name = ? AND relation = ?`,
      [patientId, fullName, relation],
    );

    if (exists) {
      return res.status(409).json({
        message: "Family member already exists",
      });
    }

    await db.query(
      `INSERT INTO family_members
       (patient_id, full_name, gender, dob, blood_group, height_cm, weight_kg, relation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        fullName,
        gender || null,
        dob || null,
        bloodGroup || null,
        heightCm || null,
        weightKg || null,
        relation,
      ],
    );

    return res.status(201).json({
      message: "Family member added successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
//getFamilyMembers

exports.getFamilyMembers = async (req, res) => {
  const patientId = req.user.id;

  try {
    const [members] = await db.query(
      `SELECT
        id,
        full_name,
        gender,
        dob,
        TIMESTAMPDIFF(YEAR, dob, CURDATE()) AS age,
        blood_group,
        height_cm,
        weight_kg,
        relation,
        created_at
      FROM family_members
      WHERE patient_id = ?
      ORDER BY created_at DESC`,
      [patientId],
    );

    return res.json({ members });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

//updateFamilyMember

exports.updateFamilyMember = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params;

  const { fullName, gender, dob, bloodGroup, heightCm, weightKg, relation } =
    req.body;

  try {
    // ---------------------------------
    // 1️⃣ Check member exists
    // ---------------------------------
    const [[existingMember]] = await db.query(
      `SELECT full_name, relation
       FROM family_members
       WHERE id = ? AND patient_id = ?`,
      [id, patientId],
    );

    if (!existingMember) {
      return res.status(404).json({
        message: "Family member not found",
      });
    }

    // ---------------------------------
    // 2️⃣ Validations
    // ---------------------------------
    if (dob && isFutureDate(dob)) {
      return res.status(400).json({
        message: "DOB cannot be in the future",
      });
    }

    if (relation && !ALLOWED_RELATIONS.includes(relation)) {
      return res.status(400).json({
        message: "Invalid relation type",
      });
    }

    if (heightCm && isNaN(heightCm)) {
      return res.status(400).json({
        message: "Invalid height value",
      });
    }

    if (weightKg && isNaN(weightKg)) {
      return res.status(400).json({
        message: "Invalid weight value",
      });
    }

    // ---------------------------------
    // 3️⃣ Duplicate prevention
    // ---------------------------------
    const newName = fullName || existingMember.full_name;
    const newRelation = relation || existingMember.relation;

    const [[duplicate]] = await db.query(
      `SELECT id FROM family_members
       WHERE patient_id = ?
       AND full_name = ?
       AND relation = ?
       AND id != ?`,
      [patientId, newName, newRelation, id],
    );

    if (duplicate) {
      return res.status(409).json({
        message: "Family member already exists",
      });
    }

    // ---------------------------------
    // 4️⃣ Build dynamic update
    // ---------------------------------
    const fields = [];
    const values = [];

    if (fullName) {
      fields.push("full_name = ?");
      values.push(fullName);
    }

    if (gender) {
      fields.push("gender = ?");
      values.push(gender);
    }

    if (dob) {
      fields.push("dob = ?");
      values.push(dob);
    }

    if (bloodGroup) {
      fields.push("blood_group = ?");
      values.push(bloodGroup);
    }

    if (heightCm) {
      fields.push("height_cm = ?");
      values.push(heightCm);
    }

    if (weightKg) {
      fields.push("weight_kg = ?");
      values.push(weightKg);
    }

    if (relation) {
      fields.push("relation = ?");
      values.push(relation);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        message: "No fields provided to update",
      });
    }

    values.push(id, patientId);

    await db.query(
      `UPDATE family_members
       SET ${fields.join(", ")}
       WHERE id = ? AND patient_id = ?`,
      values,
    );

    return res.status(200).json({
      message: "Family member updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

//deleteFamilyMember
exports.deleteFamilyMember = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `DELETE FROM family_members
       WHERE id = ? AND patient_id = ?`,
      [id, patientId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Family member not found",
      });
    }

    return res.json({
      message: "Family member deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// getPatientNotifications

exports.getPatientNotifications = async (req, res) => {
  const patientId = req.user.id;

  try {
    const [notifications] = await db.query(
      `SELECT id, title, message, appointment_id, is_read, created_at
       FROM notifications
       WHERE receiver_id = ?
       AND receiver_role = 'PATIENT'
       ORDER BY created_at DESC`,
      [patientId],
    );

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// markNotificationRead

exports.markNotificationRead = async (req, res) => {
  const patientId = req.user.id;
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = ?
       AND receiver_id = ?
       AND receiver_role = 'PATIENT'
       AND is_read = FALSE`,
      [id, patientId],
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

//getUnreadNotificationCount

exports.getUnreadNotificationCount = async (req, res) => {
  const patientId = req.user.id;

  const [[row]] = await db.query(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE receiver_id = ?
     AND receiver_role = 'PATIENT'
     AND is_read = FALSE`,
    [patientId],
  );

  res.json({ unreadCount: row.count });
};

// Patient submitDoctorReview

exports.submitDoctorReview = async (req, res) => {
  const patientId = req.user.id;
  const { appointmentId, rating, comment } = req.body;

  if (!appointmentId || !rating) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be 1 to 5" });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 1️⃣ Validate appointment
    const [[appointment]] = await connection.query(
      `SELECT doctor_id
       FROM appointments
       WHERE id = ?
       AND patient_id = ?
       AND status = 'COMPLETED'`,
      [appointmentId, patientId],
    );

    if (!appointment) {
      await connection.rollback();
      return res.status(400).json({
        message: "Invalid or incomplete appointment",
      });
    }

    const doctorId = appointment.doctor_id;

    // 2️⃣ Check duplicate feedback
    const [[existing]] = await connection.query(
      `SELECT id FROM doctor_feedback
       WHERE appointment_id = ?
       AND patient_id = ?`,
      [appointmentId, patientId],
    );

    if (existing) {
      await connection.rollback();
      return res.status(409).json({
        message: "Feedback already submitted",
      });
    }

    // 3️⃣ Insert feedback
    await connection.query(
      `INSERT INTO doctor_feedback
       (appointment_id, doctor_id, patient_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [appointmentId, doctorId, patientId, rating, comment || null],
    );

    // 4️⃣ Update doctor rating
    await connection.query(
      `UPDATE doctors
       SET rating =
         ((rating * rating_count) + ?) / (rating_count + 1),
           rating_count = rating_count + 1
       WHERE id = ?`,
      [rating, doctorId],
    );

    await connection.commit();

    res.json({ message: "Feedback submitted successfully" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};

// Patient getVisitSummary

exports.getVisitSummary = async (req, res) => {
  const patientId = req.user.id;
  const { id: appointmentId } = req.params;

  try {
    const [[summary]] = await db.query(
      `SELECT
         vs.notes,
         vs.prescription,
         vs.follow_up_date,
         a.appointment_date,
         a.token_number,
         d.doctorName,
         d.specialization
       FROM visit_summaries vs
       JOIN appointments a ON a.id = vs.appointment_id
       JOIN appointment_patients ap
         ON ap.appointment_id = a.id
         AND ap.patient_id = ?
       JOIN doctors d ON d.id = a.doctor_id
       WHERE vs.appointment_id = ?
       AND a.status = 'COMPLETED'`,
      [patientId, appointmentId],
    );

    if (!summary) {
      return res.status(404).json({
        message: "Visit summary not available",
      });
    }

    res.json(summary);
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getPrescription = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT 
        prescription AS medicines,
        notes AS instructions
       FROM visit_summaries
       WHERE appointment_id = ?`,
      [appointmentId],
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Prescription not found",
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Prescription error:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// ✅ POST → Create Booking
exports.bookhomecareservices = async (req, res) => {
  try {
    const {
      full_name,
      patient_age,
      patient_gender,

      patient_latitude,
      patient_longitude,

      gender_preference,
      emergency_booking,

      address,
      contact_number,

      service_type,
      medical_condition,

      duration_type,
      number_of_days,

      preferred_date,
      time_slot,

      notes,
    } = req.body;

    const query = `
INSERT INTO homecareservice
(
  full_name,
  patient_latitude,
  patient_longitude,
  address,
  contact_number,
  service_type,
  medical_condition,
  duration_type,
  number_of_days,
  preferred_date,
  time_slot,
  notes
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

    const [result] = await db.execute(query, [
      full_name,
      patient_latitude,
      patient_longitude,
      address,
      contact_number,
      service_type,
      medical_condition,
      duration_type,
      number_of_days,
      preferred_date,
      time_slot,
      notes,
    ]);

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      bookingId: result.insertId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ✅ GET → Get All Bookings
exports.getbookhomecareservices = async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM homecareservice ORDER BY created_at DESC",
    );

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// =========================
// GET CATEGORIES
// =========================

exports.getCategories = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM lab_categories
      WHERE is_active = 1
      ORDER BY name ASC
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// GET ALL TESTS
// =========================

exports.getTests = async (req, res) => {
  try {
    const { search, category, tier } = req.query;

    let sql = `
      SELECT *
      FROM lab_tests
      WHERE is_active = 1
    `;

    const params = [];

    if (search) {
      sql += `
        AND (
          name LIKE ?
          OR tagline LIKE ?
        )
      `;
      params.push(`%${search}%`);
      params.push(`%${search}%`);
    }

    if (category) {
      sql += ` AND category_id = ? `;
      params.push(category);
    }

    if (tier) {
      sql += ` AND tier = ? `;
      params.push(tier);
    }

    sql += ` ORDER BY id DESC`;

    const [rows] = await db.query(sql, params);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// POPULAR TESTS
// =========================

exports.getPopularTests = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM lab_tests
      WHERE
      is_popular = 1
      AND is_active = 1
      LIMIT 8
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// PACKAGES
// =========================

exports.getPackages = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM lab_tests
      WHERE
      type='package'
      AND is_active=1
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// TEST DETAILS
// =========================

exports.getTestDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [test] = await db.query(
      `
      SELECT *
      FROM lab_tests
      WHERE id=?
      `,
      [id],
    );

    if (!test.length) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    const [includes] = await db.query(
      `
      SELECT include_name
      FROM lab_test_includes
      WHERE test_id=?
      `,
      [id],
    );

    res.json({
      success: true,
      data: {
        ...test[0],
        includes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// CREATE BOOKING
// =========================

exports.createBooking = async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const {
      patientName,
      age,
      gender,
      phone,
      address,
      latitude,
      longitude,
      bookingDate,
      bookingTime,
      tests,
    } = req.body;

    const bookingId = "YDLAB" + Date.now();

    const [selectedTests] = await conn.query(
      `
        SELECT
        id,
        name,
        price
        FROM lab_tests
        WHERE id IN (?)
        `,
      [tests],
    );

    const totalAmount = selectedTests.reduce(
      (sum, item) => sum + Number(item.price),
      0,
    );

    const [booking] = await conn.query(
      `
        INSERT INTO lab_bookings
        (
          booking_id,
          user_id,
          patient_name,
          age,
          gender,
          phone,
          address,
          latitude,
          longitude,
          booking_date,
          booking_time,
          total_amount
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `,
      [
        bookingId,
        req.user.id,
        patientName,
        age,
        gender,
        phone,
        address,
        latitude,
        longitude,
        bookingDate,
        bookingTime,
        totalAmount,
      ],
    );

    for (const item of selectedTests) {
      await conn.query(
        `
        INSERT INTO
        lab_booking_items
        (
          booking_id,
          test_id,
          test_name,
          price
        )
        VALUES (?,?,?,?)
        `,
        [booking.insertId, item.id, item.name, item.price],
      );
    }

    await conn.query(
      `
      INSERT INTO
      lab_booking_tracking
      (
        booking_id,
        status,
        remarks
      )
      VALUES (?,?,?)
      `,
      [booking.insertId, "Confirmed", "Booking Created"],
    );

    await conn.commit();

    return res.json({
      success: true,
      bookingId,
      bookingDbId: booking.insertId,
      amount: totalAmount,
    });
  } catch (error) {
    await conn.rollback();

    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    conn.release();
  }
};

// =========================
// MY BOOKINGS
// =========================

exports.getLabBookings = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
       SELECT
lb.*,
COUNT(lbi.id) AS tests
FROM lab_bookings lb
LEFT JOIN lab_booking_items lbi
ON lb.id = lbi.booking_id
WHERE lb.user_id = ?
GROUP BY lb.id
ORDER BY lb.id DESC
        `,
      [req.user.id],
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// BOOKING DETAILS
// =========================

exports.getLabBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [booking] = await db.query(
      `
        SELECT *
        FROM lab_bookings
        WHERE booking_id=?
        `,
      [bookingId],
    );

    if (!booking.length) {
      return res.status(404).json({
        success: false,
      });
    }

    const [tests] = await db.query(
      `
        SELECT *
        FROM lab_booking_items
        WHERE booking_id=?
        `,
      [booking[0].id],
    );

    const [timeline] = await db.query(
      `
        SELECT *
        FROM lab_booking_tracking
        WHERE booking_id=?
        ORDER BY id ASC
        `,
      [booking[0].id],
    );

    res.json({
      success: true,
      data: {
        booking: booking[0],
        tests,
        timeline,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
