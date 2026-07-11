const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const eventBus = require("../events/eventBus");
const EVENTS = require("../events/notification.events");


// GET /admin/dashboard
// ✅ FIXED: added try/catch — was crashing silently on any DB error

exports.getDashboard = async (req, res) => {
  try {
    const [[doctors]] = await db.query(
      `SELECT COUNT(*) total,
              SUM(status='PENDING') pending
       FROM doctors`,
    );

    const [[patients]] = await db.query(
      `SELECT COUNT(*) total
       FROM users WHERE role='PATIENT'`,
    );

    const [[appointments]] = await db.query(
      `SELECT COUNT(*) total
       FROM appointments WHERE appointment_date = CURDATE()`,
    );

    res.json({
      doctors,
      patients,
      todayAppointments: appointments.total,
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// getDoctors

exports.getDoctors = async (req, res) => {
  try {
    const status = req.query.status;

    let query = `
      SELECT
        d.id,
        d.user_id,
        d.doctorName,
        d.specialization,
        dc.clinic_name,
        dc.city,
        d.status,
        d.action_reason,
        d.rating,
        d.experience_years,
        u.profile_image,
         COALESCE(s.status, 'pending') AS subscription_status
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN doctor_clinics dc ON dc.doctor_id = d.id   
       LEFT JOIN subscriptions s
        ON s.user_id = d.user_id
    `;

    const params = [];

    if (status) {
      query += " WHERE d.status = ?";
      params.push(status);
    }

    query += " ORDER BY d.doctorName ASC";

    const [doctors] = await db.query(query, params);

    res.json({
      success: true,
      doctors,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch doctors",
    });
  }
};

// updateDoctorStatus
exports.updateDoctorStatus = async (req, res) => {
  const doctorId = req.params.id;
  const { status, reason } = req.body;

  const allowedStatuses = ["PENDING", "APPROVED", "REJECTED"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[doctor]] = await connection.query(
      `SELECT doctorName, status FROM doctors WHERE id = ?`,
      [doctorId],
    );

    if (!doctor) {
      await connection.rollback();
      return res.status(404).json({ message: "Doctor not found" });
    }

    await connection.query(
      `UPDATE doctors
   SET status = ?, action_reason = ?
   WHERE id = ?`,
      [status, reason || null, doctorId],
    );

    const [[doctorInfo]] = await connection.query(
  `SELECT d.user_id,
          d.doctorName,
          u.email
   FROM doctors d
   JOIN users u ON d.user_id = u.id
   WHERE d.id = ?`,
  [doctorId]
);

await connection.commit();

if (status === "APPROVED") {
  eventBus.emit(DOCTOR_APPROVED, {
    doctorId: doctorInfo.user_id,
    doctorName: doctorInfo.doctorName,
    doctorEmail: doctorInfo.email,
  });
}

if (status === "REJECTED") {
  eventBus.emit(DOCTOR_REJECTED, {
    doctorId: doctorInfo.user_id,
    doctorName: doctorInfo.doctorName,
    doctorEmail: doctorInfo.email,
    reason,
  });
}

return res.json({
  message: `Doctor marked as ${status}`,
});

  } catch (err) {
    await connection.rollback();
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

// getDoctorDetails

exports.getDoctorDetails = async (req, res) => {
  const doctorId = req.params.id;

  try {
    // ✅ 1. DOCTOR + USER
    const [[doctor]] = await db.query(
      `SELECT
        d.id,
        d.user_id,
        d.doctorName,
        d.specialization,
        d.gender,
        d.degree,
        d.bio,
        d.practice_type,
        d.consultationFee,
        d.consultation_duration,
        d.licenseNumber,
        d.experience_years,
        d.valid_till,
        d.availableDays,
        d.state_council,
        d.status,

        u.email,
        u.mobile,
        u.profile_image

      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = ?`,
      [doctorId],
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // ✅ 2. PARSE availableDays
    if (doctor.availableDays) {
      try {
        doctor.availableDays = JSON.parse(doctor.availableDays);
      } catch {
        doctor.availableDays = doctor.availableDays
          .split(",")
          .map((d) => d.trim());
      }
    } else {
      doctor.availableDays = [];
    }

    // ✅ 3. CLINICS (MULTIPLE SUPPORT 🔥)
    const [clinicRows] = await db.query(
      `SELECT 
        id AS clinic_id,
        clinic_name,
        address,
        city,
        state,
        pincode,
        landmark,
        maps_link,
        languages
      FROM doctor_clinics
      WHERE doctor_id = ?`,
      [doctorId],
    );

    const clinics = clinicRows.map((c) => ({
      clinic_id: c.clinic_id,
      clinic_name: c.clinic_name,
      address: c.address,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      landmark: c.landmark,
      maps_link: c.maps_link,
      languages:
        typeof c.languages === "string" ? JSON.parse(c.languages) : c.languages,
    }));

    // ✅ 4. AVAILABILITY
    const [availabilityRows] = await db.query(
      `SELECT 
        day_code,
        morning_start,
        morning_end,
        evening_start,
        evening_end
      FROM doctor_availability
      WHERE doctor_id = ?`,
      [doctorId],
    );

    const dayMap = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday",
    };

    const availability = availabilityRows.map((a) => ({
      day_code: a.day_code,
      day: dayMap[a.day_code],
      morning_start: a.morning_start,
      morning_end: a.morning_end,
      evening_start: a.evening_start,
      evening_end: a.evening_end,
    }));

    // ✅ 5. SHIFT CALCULATION
    const shift = {
      morning_start:
        availabilityRows.length > 0
          ? availabilityRows.reduce(
              (min, a) =>
                !min || a.morning_start < min ? a.morning_start : min,
              null,
            )
          : null,

      morning_end:
        availabilityRows.length > 0
          ? availabilityRows.reduce(
              (max, a) => (!max || a.morning_end > max ? a.morning_end : max),
              null,
            )
          : null,

      evening_start:
        availabilityRows.length > 0
          ? availabilityRows.reduce(
              (min, a) =>
                !min || a.evening_start < min ? a.evening_start : min,
              null,
            )
          : null,

      evening_end:
        availabilityRows.length > 0
          ? availabilityRows.reduce(
              (max, a) => (!max || a.evening_end > max ? a.evening_end : max),
              null,
            )
          : null,
    };

    // ✅ 6. DOCUMENTS
    const [docs] = await db.query(
      `SELECT doc_type, file_path 
   FROM doctor_documents 
   WHERE doctor_id = ?`,
      [doctorId],
    );
    console.log("📦 RAW docs from DB:", JSON.stringify(docs, null, 2));

    const documents = {
      profile_picture: null,
      certificate: null,
      id_proof: null,
    };

    console.log("🧾 Initial documents object:", documents);

    docs.forEach((doc) => {
      const url = doc.file_path;

      if (doc.doc_type === "profile") {
        documents.profile_picture = url;
      }
      if (doc.doc_type === "certificate") {
        documents.certificate = url;
      }
      if (doc.doc_type === "idProof") {
        documents.id_proof = url;
      }
    });

    //  7. FINAL RESPONSE
    return res.json({
      doctor: {
        id: doctor.id,
        doctorName: doctor.doctorName,
        profile_image: doctor.profile_image,
        gender: doctor.gender,
        bio: doctor.bio,
        degree: doctor.degree,
        specialization: doctor.specialization,
        experience_years: doctor.experience_years,
        licenseNumber: doctor.licenseNumber,
        state_council: doctor.state_council,
        valid_till: doctor.valid_till,
        consultationFee: doctor.consultationFee,
        consultation_duration: doctor.consultation_duration,
        availableDays: doctor.availableDays,
        practice_type: doctor.practice_type,
        hospital_name: doctor.hospital_name,
        status: doctor.status,
        email: doctor.email,
        mobile: doctor.mobile,
        rating: 0,
        total_reviews: 0,
        documents,
        clinics,
        availability,
        shift,
      },
    });
  } catch (err) {
    console.error("Doctor details error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// verifyDoctorDocument
exports.verifyDoctorDocument = async (req, res) => {
  const doctorId = req.params.id; // ✅ doctor.id
  const { docType, verified, reason } = req.body;

  try {
    // ✅ 1. Validate input
    if (!docType) {
      return res.status(400).json({ message: "docType is required" });
    }

    if (verified === false && !reason) {
      return res.status(400).json({
        message: "Rejection reason is required when rejecting document",
      });
    }

    // ✅ 2. Check doctor exists
    const [[doctor]] = await db.query(`SELECT id FROM doctors WHERE id = ?`, [
      doctorId,
    ]);

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // ✅ 3. Check document exists
    const [[doc]] = await db.query(
      `SELECT id FROM doctor_documents 
       WHERE doctor_id = ? AND doc_type = ?`,
      [doctorId, docType],
    );

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // ✅ 4. Set verified value
    // 0 = pending, 1 = approved, 2 = rejected
    const verifiedValue = verified ? 1 : 2;

    // ✅ 5. Update document
    await db.query(
      `UPDATE doctor_documents
       SET verified = ?, rejection_reason = ?
       WHERE doctor_id = ? AND doc_type = ?`,
      [
        verifiedValue,
        verifiedValue === 2 ? reason : null, // ✅ correct logic
        doctorId,
        docType,
      ],
    );

    // ✅ 6. Success response
    return res.json({
      success: true,
      message:
        verifiedValue === 1
          ? "Document approved successfully"
          : "Document rejected successfully",
      data: {
        doctor_id: doctorId,
        docType,
        verified: verifiedValue,
        reason: verifiedValue === 2 ? reason : null,
      },
    });
  } catch (err) {
    console.error("Verify document error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// getDoctorVerification
exports.getDoctorVerification = async (req, res) => {
  const doctorId = req.params.id; // ✅ FIX

  try {
    // ✅ doctor by doctor.id
    const [[doctor]] = await db.query(
      `SELECT 
        d.id AS doctor_id,
        d.user_id,
        d.doctorName,
        d.specialization,
        u.profile_image
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`, // ✅ FIX
      [doctorId],
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const [documents] = await db.query(
      `SELECT 
        id, 
        doc_type, 
        file_path, 
        uploaded_at, 
        verified,
        rejection_reason
       FROM doctor_documents
       WHERE doctor_id = ?`, // ✅ correct
      [doctorId],
    );

    res.json({
      doctor,
      documents,
    });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// verifyDoctorAccount
exports.verifyDoctorAccount = async (req, res) => {
  const doctorId = req.params.id;

  try {
    const [docs] = await db.query(
      `SELECT COUNT(*) as pending
       FROM doctor_documents
       WHERE doctor_id = ? AND verified != 1`,
      [doctorId],
    );

    if (docs[0].pending > 0) {
      return res.status(400).json({
        message: "All documents must be verified first",
      });
    }

    await db.query(
      `UPDATE doctors
       SET status = 'APPROVED'
       WHERE id = ?`,
      [doctorId],
    );

    res.json({ message: "Doctor verified successfully" });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// GET /admin/analytics/appointments
exports.getAppointmentAnalytics = async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ message: "from and to dates required" });
  }

  try {
    const [[data]] = await db.query(
      `SELECT
        COUNT(*) AS total,
        SUM(status='COMPLETED') AS completed,
        SUM(status='CANCELLED') AS cancelled,
        SUM(status='PENDING') AS pending
       FROM appointments
       WHERE appointment_date BETWEEN ? AND ?`,
      [from, to],
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// toggleDoctorActive
exports.toggleDoctorActive = async (req, res) => {
  const doctorId = req.params.id;
  const { is_active } = req.body;

  if (typeof is_active !== "boolean") {
    return res.status(400).json({ message: "is_active must be true or false" });
  }

  try {
    const [result] = await db.query(
      `UPDATE doctors SET is_available = ? WHERE user_id = ?`,
      [is_active, doctorId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.json({
      message: `Doctor ${is_active ? "activated" : "deactivated"} successfully`,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



// getPatients
// ✅ FIXED: added try/catch
exports.getPatients = async (req, res) => {
  try {
    const [patients] = await db.query(`
      SELECT
        p.id,
        p.user_id,
        p.fullName,
        p.phone AS mobile,
        p.email,
        p.gender,
        p.dob,
        u.profile_image,
        u.is_active
      FROM patients p
      INNER JOIN users u
        ON p.user_id = u.id
      ORDER BY p.id DESC
    `);

    res.json({
      success: true,
      patients,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// blockUser
// ✅ FIXED: added try/catch
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "UPDATE users SET is_active = FALSE WHERE id = ? AND role='PATIENT'",
      [id]
    );

    res.json({
      success: true,
      message: "Patient blocked successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// unblockUser
// ✅ FIXED: added try/catch
exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "UPDATE users SET is_active = TRUE WHERE id = ? AND role='PATIENT'",
      [id]
    );

    res.json({
      success: true,
      message: "Patient unblocked successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// getAllAppointments
// ✅ FIXED: appointment_shift → appointment_slot + added try/catch
exports.getAllAppointments = async (req, res) => {
  try {
    const { doctorId, date, status } = req.query;

    let query = `
      SELECT
        a.id,
        a.appointment_date,
        a.appointment_slot,
        a.token_number,
        a.status,
        a.created_by,
        a.created_at,
        d.user_id AS doctorId,
        d.doctorName,
        GROUP_CONCAT(DISTINCT u.email) AS patientEmails
      FROM appointments a
      LEFT JOIN doctors d ON d.user_id = a.doctor_id
      LEFT JOIN appointment_patients ap ON ap.appointment_id = a.id
      LEFT JOIN users u ON u.id = ap.patient_id
      WHERE 1 = 1
    `;

    const params = [];

    if (doctorId) {
      query += " AND a.doctor_id = ?";
      params.push(doctorId);
    }

    if (date) {
      query += " AND a.appointment_date = ?";
      params.push(date);
    }

    if (status) {
      query += " AND a.status = ?";
      params.push(status);
    }

    query += `
      GROUP BY a.id
      ORDER BY a.appointment_date DESC, a.token_number ASC
    `;

    const [rows] = await db.query(query, params);

    res.json({ appointments: rows });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// forceCancelAppointment
// ✅ FIXED: added try/catch
exports.forceCancelAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;

    const [result] = await db.query(
      `UPDATE appointments
       SET status = 'CANCELLED_BY_ADMIN'
       WHERE id = ?
       AND status NOT IN ('COMPLETED','CANCELLED','CANCELLED_BY_ADMIN')`,
      [appointmentId],
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Cannot cancel appointment" });
    }

    eventBus.emit(APPOINTMENT_CANCELLED_BY_ADMIN, {
      eventType: APPOINTMENT_CANCELLED_BY_ADMIN,
      appointmentId,
    });

    res.json({ message: "Appointment cancelled by admin" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// getAdminAnalytics
// ✅ FIXED: status='verified' → status='APPROVED' + added try/catch
exports.getAdminAnalytics = async (req, res) => {
  try {
    const [[data]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM appointments) totalAppointments,
        (SELECT COUNT(*) FROM doctors WHERE status='APPROVED') activeDoctors,
        (SELECT COUNT(*) FROM users WHERE role='PATIENT') patients
    `);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



exports.getAllContactRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const offset = (page - 1) * limit;

    let query = `SELECT * FROM contact_requests`;
    let countQuery = `SELECT COUNT(*) as total FROM contact_requests`;
    let values = [];

    // ✅ filter by status (optional)
    if (status) {
      query += ` WHERE status = ?`;
      countQuery += ` WHERE status = ?`;
      values.push(status);
    }

    query += ` ORDER BY id ASC LIMIT ? OFFSET ?`;
    values.push(Number(limit), Number(offset));

    // ✅ execute queries
    const [rows] = await db.query(query, values);

    const [[countResult]] = await db.query(countQuery, status ? [status] : []);

    res.status(200).json({
      success: true,
      data: rows,
      total: countResult.total,
      page: Number(page),
      totalPages: Math.ceil(countResult.total / limit),
    });
  } catch (error) {
    console.error("GET CONTACT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `UPDATE contact_requests SET status = 'resolved' WHERE id = ?`,
      [id],
    );

    res.json({
      success: true,
      message: "Marked as resolved",
    });
  } catch (error) {
    console.error("UPDATE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.deleteContactRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM contact_requests WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Contact request not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact request deleted successfully",
    });
  } catch (error) {
    console.error("Delete Contact Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.addLabTest = async (req, res) => {
  try {
    const {
      category_id,
      name,
      tagline,
      price,
      mrp,
      parameters,
      report_time,
      fasting,
      tier,
      type,
      description,
      is_popular,
      includes = [],
    } = req.body;

    // Uploaded image path

    const image = `/uploads/lab-tests/${req.file.filename}`;

    const [result] = await db.query(
      `
      INSERT INTO lab_tests
      (
        category_id,
        name,
        tagline,
        price,
        mrp,
        parameters,
        report_time,
        fasting,
        tier,
        type,
        description,
        image,
        is_popular
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        category_id,
        name,
        tagline,
        price,
        mrp,
        parameters,
        report_time,
        fasting,
        tier,
        type,
        description,
        image,
        is_popular ? 1 : 0,
      ],
    );

    const testId = result.insertId;

    if (includes?.length) {
      for (const item of includes) {
        await db.query(
          `
          INSERT INTO lab_test_includes
          (
            test_id,
            include_name
          )
          VALUES (?,?)
          `,
          [testId, item],
        );
      }
    }

    res.json({
      success: true,
      message: "Lab Test Added Successfully",
      testId,
      image,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getLabTests = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        lt.*,
        lc.name AS category_name
      FROM lab_tests lt
      LEFT JOIN lab_categories lc
      ON lt.category_id = lc.id
      ORDER BY lt.id DESC
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

exports.getLabTestById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT *
      FROM lab_tests
      WHERE id = ?
      `,
      [id],
    );

    if (!rows.length) {
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
        ...rows[0],
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

exports.updateLabTest = async (req, res) => {
  try {
    console.log("FILE:", req.file);
    console.log("BODY:", req.body);
    const { id } = req.params;

    const {
      category_id,
      name,
      tagline,
      price,
      mrp,
      parameters,
      report_time,
      fasting,
      tier,
      type,
      description,
      badge,
      is_popular,
      is_active,
      includes = [],
    } = req.body;

    // Purani image nikalo
    const [rows] = await db.query("SELECT image FROM lab_tests WHERE id=?", [
      id,
    ]);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Lab Test not found",
      });
    }

    const image = `/uploads/lab-tests/${req.file.filename}`;

    await db.query(
      `
      UPDATE lab_tests
      SET
        category_id=?,
        name=?,
        tagline=?,
        price=?,
        mrp=?,
        parameters=?,
        report_time=?,
        fasting=?,
        tier=?,
        type=?,
        description=?,
        image=?,
        badge=?,
        is_popular=?,
        is_active=?
      WHERE id=?
      `,
      [
        category_id,
        name,
        tagline,
        price,
        mrp,
        parameters,
        report_time,
        fasting,
        tier,
        type,
        description,
        image,
        badge || null,
        is_popular ? 1 : 0,
        is_active ? 1 : 0,
        id,
      ],
    );

    // Purane includes delete karo
    await db.query(
      `
      DELETE FROM lab_test_includes
      WHERE test_id=?
      `,
      [id],
    );

    // Naye includes add karo
    if (includes && includes.length > 0) {
      for (const item of includes) {
        await db.query(
          `
          INSERT INTO lab_test_includes
          (
            test_id,
            include_name
          )
          VALUES (?,?)
          `,
          [id, item],
        );
      }
    }

    res.json({
      success: true,
      message: "Test Updated Successfully",
      image,
    });
  } catch (error) {
    console.error("UPDATE LAB TEST ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addLabPackage = async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const {
      category_id,
      name,
      tagline,
      description,
      price,
      mrp,
      tier,
      badge,
      is_popular,
      tests,
      parameters,
      report_time,
      fasting,
    } = req.body;

    // Get uploaded image URL/path

    const image = `/uploads/lab-tests/${req.file.filename}`;

    const [result] = await conn.query(
      `
      INSERT INTO lab_tests
      (
        category_id,
        name,
        type,
        tagline,
        description,
        image,
        price,
        mrp,
        tier,
        badge,
        is_popular,
        parameters,
        report_time,
        fasting
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        category_id,
        name,
        "package",
        tagline,
        description,
        image,
        price,
        mrp,
        tier,
        badge || null,
        is_popular ? 1 : 0,
        parameters || null,
        report_time || null,
        fasting || null,
      ],
    );

    const packageId = result.insertId;

    if (tests?.length) {
      for (const testId of tests) {
        await conn.query(
          `
          INSERT INTO lab_package_tests
          (
            package_id,
            test_id
          )
          VALUES (?,?)
          `,
          [packageId, testId],
        );
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: "Package Added Successfully",
      packageId,
      image,
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

exports.getLabPackages = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        lt.*,
        lc.name AS category_name
      FROM lab_tests lt
      LEFT JOIN lab_categories lc
      ON lt.category_id = lc.id
      WHERE lt.type='package'
      ORDER BY lt.id DESC
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

exports.getLabPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const [pkg] = await db.query(
      `
      SELECT *
      FROM lab_tests
      WHERE id=?
      AND type='package'
      `,
      [id],
    );

    if (!pkg.length) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    const [tests] = await db.query(
      `
      SELECT
        lt.id,
        lt.name
      FROM lab_package_tests lpt
      JOIN lab_tests lt
      ON lpt.test_id = lt.id
      WHERE lpt.package_id=?
      `,
      [id],
    );

    res.json({
      success: true,
      data: {
        ...pkg[0],
        tests,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateLabPackage = async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const { id } = req.params;

    const {
      category_id,
      name,
      tagline,
      description,
      price,
      mrp,
      tier,
      badge,
      is_popular,
      is_active,
      tests,
      parameters,
      report_time,
      fasting,
    } = req.body;

    // Purani image nikalo
    const [oldPackage] = await conn.query(
      "SELECT image FROM lab_tests WHERE id=?",
      [id],
    );

    // Agar nayi image upload hui hai to use karo, warna purani image rakho
    const image = `/uploads/lab-tests/${req.file.filename}`;

    await conn.query(
      `
      UPDATE lab_tests
      SET
        category_id=?,
        name=?,
        tagline=?,
        description=?,
        image=?,
        price=?,
        mrp=?,
        tier=?,
        badge=?,
        is_popular=?,
        is_active=?,
        parameters=?,
        report_time=?,
        fasting=?
      WHERE id=?
      `,
      [
        category_id,
        name,
        tagline,
        description,
        image,
        price,
        mrp,
        tier,
        badge || null,
        is_popular ? 1 : 0,
        is_active ? 1 : 0,
        parameters || null,
        report_time || null,
        fasting || null,
        id,
      ],
    );

    await conn.query(`DELETE FROM lab_package_tests WHERE package_id=?`, [id]);

    if (tests?.length) {
      for (const testId of tests) {
        await conn.query(
          `INSERT INTO lab_package_tests (package_id, test_id) VALUES (?, ?)`,
          [id, testId],
        );
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: "Package Updated Successfully",
      image,
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

exports.getAllLabBookings = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        lb.*,
        COUNT(lbi.id) AS tests
      FROM lab_bookings lb
      LEFT JOIN lab_booking_items lbi
      ON lb.id = lbi.booking_id
      GROUP BY lb.id
      ORDER BY lb.id DESC
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

exports.getAdminLabBookingDetails = async (req, res) => {
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
        message: "Booking not found",
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

    const [reports] = await db.query(
      `
      SELECT *
      FROM lab_reports
      WHERE booking_id=?
      ORDER BY id DESC
      `,
      [booking[0].id],
    );

    res.json({
      success: true,
      data: {
        booking: booking[0],
        tests,
        timeline,
        reports,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateLabBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const { status, remarks } = req.body;

    const [booking] = await db.query(
      `
      SELECT id
      FROM lab_bookings
      WHERE booking_id=?
      `,
      [bookingId],
    );

    if (!booking.length) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    await db.query(
      `
      UPDATE lab_bookings
      SET status=?
      WHERE booking_id=?
      `,
      [status, bookingId],
    );

    await db.query(
      `
      INSERT INTO lab_booking_tracking
      (
        booking_id,
        status,
        remarks
      )
      VALUES (?,?,?)
      `,
      [booking[0].id, status, remarks || null],
    );

    res.json({
      success: true,
      message: "Status Updated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.uploadLabReport = async (req, res) => {
  try {
    console.log("FILE =", req.file);
    const { bookingId } = req.params;

    const [booking] = await db.query(
      `
      SELECT id
      FROM lab_bookings
      WHERE booking_id=?
      `,
      [bookingId],
    );

    if (!booking.length) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Report file required",
      });
    }

    await db.query(
      `
      INSERT INTO lab_reports
      (
        booking_id,
        report_file,
        uploaded_by
      )
      VALUES (?,?,?)
      `,
      [booking[0].id, req.file.path, req.user.id],
    );

    await db.query(
      `
      UPDATE lab_bookings
      SET status='Completed'
      WHERE booking_id=?
      `,
      [bookingId],
    );

    await db.query(
      `
      INSERT INTO lab_booking_tracking
      (
        booking_id,
        status,
        remarks
      )
      VALUES (?,?,?)
      `,
      [booking[0].id, "Completed", "Report Uploaded"],
    );

    res.json({
      success: true,
      message: "Report Uploaded",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getLabReport = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [rows] = await db.query(
      `
      SELECT lr.*
      FROM lab_reports lr
      JOIN lab_bookings lb
      ON lb.id = lr.booking_id
      WHERE lb.booking_id=?
      ORDER BY lr.id DESC
      LIMIT 1
      `,
      [bookingId],
    );

    res.json({
      success: true,
      data: rows[0] || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updatePackageStatus = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `
      UPDATE lab_tests
      SET is_active =
      CASE
        WHEN is_active = 1 THEN 0
        ELSE 1
      END
      WHERE id = ?
      AND type = 'package'
      `,
      [id],
    );

    res.json({
      success: true,
      message: "Status updated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateTestStatus = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `
      UPDATE lab_tests
      SET is_active =
      CASE
        WHEN is_active = 1 THEN 0
        ELSE 1
      END
      WHERE id = ?
      AND type = 'test'
      `,
      [id],
    );

    res.json({
      success: true,
      message: "Status updated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
