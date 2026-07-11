const db = require("../config/db");
const eventBus = require("../events/eventBus");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const EVENTS = require("../events/notification.events");
const generateHTML = require("../utils/certificateTemplate");

const QRCode = require("qrcode");
const { generateCertificateId } = require("../utils/generateCertId");

const { calculateExpiry } = require("../utils/calculateExpiry");
const generatePDF = require("../services/pdfService");

// createRequest Api

exports.createRequest = async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const user_id = req.user.id;

    const {
      doctor_id,
      certificate_type,
      purpose,
      notes,
      full_name,
      dob,
      gender,
      blood_group,
      height,
      weight,
      medical_conditions,
      medications,
    } = req.body;

    const query = `
      INSERT INTO certificate_requests
      (user_id, doctor_id, certificate_type, purpose, notes,
       full_name, dob, gender, blood_group, height, weight,
       medical_conditions, medications, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const [result] = await connection.query(query, [
      user_id,
      doctor_id,
      certificate_type,
      purpose,
      notes,
      full_name,
      dob,
      gender,
      blood_group,
      height,
      weight,
      medical_conditions,
      medications,
    ]);

    const requestId = result.insertId;

    const timelineQuery = `
      INSERT INTO certificate_request_timeline (request_id, label, state)
      VALUES
      (?, 'Request submitted', 'done'),
      (?, 'Under Verification', 'waiting')
    `;

    const [doctorRows] = await connection.query(
      "SELECT user_id FROM doctors WHERE id = ?",
      [doctor_id],
    );

    const doctorUserId = doctorRows[0]?.user_id;

    // 🔥 EVENT FIRE
    eventBus.emit(EVENTS.CERTIFICATE_REQUEST_CREATED, {
      doctorId: doctorUserId,
      patientName: full_name,
      certificateType: certificate_type,
    });

    await connection.query(timelineQuery, [requestId, requestId]);

    await connection.commit();

    res.status(201).json({
      message: "Request created successfully",
      requestId,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ Transaction Error:", error);

    res.status(500).json({
      message: "Failed to create request",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// ================= Upload Documents =================

exports.uploadDocument = async (req, res) => {
  try {
    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({
        message: "Request ID is required",
      });
    }

    // ✅ CORRECT CHECK
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        message: "No files uploaded",
      });
    }

    // ✅ REQUIRED FILE VALIDATION
    if (!req.files.profilePhoto) {
      return res.status(400).json({
        message: "Profile photo is required",
      });
    }

    if (!req.files.idProof) {
      return res.status(400).json({
        message: "ID proof is required",
      });
    }

    // ✅ SAVE FILES
    const allFiles = [
      ...(req.files.profilePhoto || []).map((f) => ({
        ...f,
        type: "profilePhoto",
      })),
      ...(req.files.idProof || []).map((f) => ({ ...f, type: "idProof" })),
      ...(req.files.medicalReports || []).map((f) => ({
        ...f,
        type: "medicalReports",
      })),
      ...(req.files.prescription || []).map((f) => ({
        ...f,
        type: "prescription",
      })),
    ];

    const values = allFiles.map((file) => [request_id, file.path, file.type]);

    const query = `
  INSERT INTO certificate_documents (request_id, file_url, doc_type)
  VALUES ?
`;

    await db.query(query, [values]);

    res.status(201).json({
      message: "Documents uploaded successfully",
    });
  } catch (error) {
    console.error("❌ Upload Error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// getMyRequests Api

exports.getMyRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT
        cr.id,
        cr.certificate_id,
        cr.certificate_type,
        cr.purpose,
        cr.status,
        cr.created_at,
        cr.issued_at,
        cr.expiry_date,
        cr.full_name,
        d.doctorName AS doctor_name,

        CASE
          WHEN cr.status = 'approved'
               AND cr.expiry_date IS NOT NULL
               AND cr.expiry_date < NOW()
          THEN 'Expired'
          ELSE cr.status
        END AS computed_status

      FROM certificate_requests cr
      LEFT JOIN doctors d ON cr.doctor_id = d.id
      WHERE cr.user_id = ?
      ORDER BY cr.created_at DESC
    `;

    const [rows] = await db.query(query, [userId]);

    const formattedData = rows.map((row) => ({
      ...row,
      status: row.computed_status,
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("❌ Error fetching certificates:", error);
    res.status(500).json({
      message: "Failed to fetch certificate requests",
    });
  }
};

// getRequestById Api

exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const requestQuery = `
      SELECT
        cr.*,
        d.doctorName AS doctor_name
      FROM certificate_requests cr
      LEFT JOIN doctors d ON cr.doctor_id = d.id
      WHERE cr.id = ? AND cr.user_id = ?
    `;

    const [requestRows] = await db.query(requestQuery, [id, userId]);

    if (requestRows.length === 0) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    const timelineQuery = `
      SELECT id, label, state, note, created_at
      FROM certificate_request_timeline
      WHERE request_id = ?
      ORDER BY created_at ASC
    `;

    const [timelineRows] = await db.query(timelineQuery, [id]);

    res.status(200).json({
      request: requestRows[0],
      timeline: timelineRows,
    });
  } catch (error) {
    console.error("❌ Error fetching request details:", error);
    res.status(500).json({
      message: "Failed to fetch request details",
    });
  }
};

// downloadCertificate Api

exports.downloadCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT certificate_file FROM certificate_requests WHERE id = ?",
      [id],
    );

    if (!rows.length || !rows[0].certificate_file) {
      return res.status(404).json({ message: "Certificate not found in DB" });
    }

    const filePath = path.join(process.cwd(), rows[0].certificate_file);

    console.log("📥 Downloading:", filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.download(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Download failed" });
  }
};
// Doctors  Side All Api

exports.getDoctorRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT
          cr.id,
          cr.full_name,
          cr.certificate_type,
          cr.created_at,
          cr.status
       FROM certificate_requests cr
       JOIN doctors d ON cr.doctor_id = d.id
       WHERE d.user_id = ?
       ORDER BY cr.created_at DESC`,
      [userId],
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching doctor requests:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getRequestByIdForDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT * FROM certificate_requests WHERE id = ?`,
      [id],
    );

    await db.query(
      `UPDATE certificate_requests
   SET status = 'verification'
   WHERE id = ?`,
      [id],
    );

    await db.query(
      `UPDATE certificate_request_timeline
   SET state = 'done'
   WHERE request_id = ?`,
      [id],
    );

    //   await db.query(
    //     `INSERT INTO certificate_request_timeline
    //  (request_id, label, state)
    //  VALUES (?, 'Under Verification', 'active')`,
    //     [id],
    //   );

    if (!rows.length) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching request details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// getDocuments Api

exports.getDocumentsByRequestId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT id, file_url, created_at
       FROM certificate_documents
       WHERE request_id = ?`,
      [id],
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// approveRequest Api

exports.approveRequest = async (req, res) => {
  console.log("API HIT");
  const logoPath = path.join(process.cwd(), "src/assets/logo.webp");
  const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
  const logo = `data:image/webp;base64,${logoBase64}`;

  try {
    console.log("1");
    const { id } = req.params;
    const doctorUserId = req.user.id;
    const { doctor_notes, fitness_status, validity } = req.body;

    // Doctor ID fetch karein
    const [doctorRows] = await db.query(
      `SELECT
    d.id,
      d.doctorName,
      u.profile_image
   FROM doctors d
   JOIN users u ON d.user_id = u.id
   WHERE d.user_id = ?`,
      [doctorUserId],
    );

    console.log("2");

    const doctor = doctorRows[0];

    if (doctorRows.length === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    console.log("3");
    const doctorId = doctorRows[0].id;
    const doctorName = doctorRows[0].doctorName;

    // Certificate request data fetch karein
    const [requestRows] = await db.query(
      `SELECT
    full_name,
    certificate_type,
    purpose,
    medical_conditions,
    dob,
    gender,
    notes,
    medications
   FROM certificate_requests
   WHERE id = ?`,
      [id],
    );

    if (!requestRows.length) {
      return res.status(404).json({ message: "Request not found" });
    }

    const request = requestRows[0];

    // ✅ GET CLINIC NAME
    const [clinicRows] = await db.query(
      "SELECT clinic_name FROM doctor_clinics WHERE doctor_id = ? LIMIT 1",
      [doctorId],
    );

    const clinicName = clinicRows[0]?.clinic_name || " ";

    // Certificate ID generate karein
    const certificateId = generateCertificateId();
    const expiryDate = calculateExpiry(validity);

    // PDF path
    const dirPath = path.join(process.cwd(), "uploads/certificates");
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const certificateFile = `uploads/certificates/${certificateId}.pdf`;
    const filePath = path.join(process.cwd(), certificateFile);
    //  Puppeteer PDF Generate

    const qrData = `${process.env.BASE_URL}/verify/${certificateId}`;
    const qrImage = await QRCode.toDataURL(qrData);

    //  GET PATIENT PROFILE PHOTO
    const [docRows] = await db.query(
      `SELECT file_url
   FROM certificate_documents
   WHERE request_id = ? AND doc_type = 'profilePhoto'
   LIMIT 1`,
      [id],
    );

    let patientPhoto = "";

    if (docRows[0]?.file_url) {
      const fullPath = path.join(process.cwd(), docRows[0].file_url);

      if (fs.existsSync(fullPath)) {
        const imageBase64 = fs.readFileSync(fullPath, { encoding: "base64" });
        const ext = path.extname(fullPath).slice(1);

        patientPhoto = `data:image/${ext};base64,${imageBase64}`;
      }
    }

    console.log("4");

    const html = generateHTML({
      certificate_id: certificateId,
      date: new Date().toLocaleDateString(),
      patient: request.full_name,
      doctor: doctorName,
      clinc: clinicName,
      medical_conditions: request.medical_conditions || "N/A",
      certificateType: request.certificate_type,
      purpose: request.purpose,
      issueDate: new Date().toLocaleDateString(),
      expiryDate: expiryDate
        ? new Date(expiryDate).toLocaleDateString()
        : "N/A",
      dob: request.dob
        ? new Date(request.dob).toLocaleDateString("en-IN")
        : "N/A",
      gender: request.gender || "N/A",
      notes: request.notes || "Normal",
      treatment: fitness_status || "N/A",
      medicines: request.medications || "N/A",
      days: validity || 0,
      doctorImage: doctor.profile_image,
      logo: logo,
      qr: qrImage,
      patientPhoto: patientPhoto,
    });

    const pdfBuffer = await generatePDF(html);

    fs.writeFileSync(filePath, pdfBuffer);

    await db.query(
      `UPDATE certificate_requests
      SET status = 'approved',
           certificate_id = ?,
           doctor_notes = ?,
           fitness_status = ?,
           issued_at = NOW(),
           expiry_date = ?,
           certificate_file = ?
       WHERE id = ? AND doctor_id = ?`,
      [
        certificateId,
        doctor_notes,
        fitness_status,
        expiryDate,
        certificateFile,
        id,
        doctorId,
      ],
    );

    await db.query(
      `UPDATE certificate_request_timeline
   SET state = 'done'
   WHERE request_id = ?`,
      [id],
    );

    await db.query(
      `INSERT INTO certificate_request_timeline
   (request_id, label, state)
   VALUES (?, 'Approved', 'done')`,
      [id],
    );

    const [patientRows] = await db.query(
      "SELECT id AS user_id, email FROM users WHERE id = (SELECT user_id FROM certificate_requests WHERE id = ?)",
      [id],
    );

    const patient = patientRows[0];

    // 🔥 EVENT FIRE
    eventBus.emit(EVENTS.CERTIFICATE_APPROVED, {
      patientId: patient.user_id,
      patientEmail: patient.email,
      certificateId,
    });

    res.json({
      message: "Certificate approved and PDF generated successfully",
      certificateId,
    });
    console.log("5");
  } catch (error) {
    console.error("Approve Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// rejectRequest Api

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorUserId = req.user.id;

    // 🔥 doctor table se actual doctor_id nikalo
    const [doctorRows] = await db.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [doctorUserId],
    );

    if (!doctorRows.length) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doctorRows[0].id;

    const [result] = await db.query(
      `UPDATE certificate_requests
       SET status='rejected'
       WHERE id=? AND doctor_id=?`,
      [id, doctorId],
    );

    await db.query(
      `UPDATE certificate_request_timeline
   SET state = 'done'
   WHERE request_id = ?`,
      [id],
    );

    await db.query(
      `INSERT INTO certificate_request_timeline (request_id, label, state)
   VALUES (?, 'Request Rejected', 'done')`,
      [id],
    );

    const [patientRows] = await db.query(
      "SELECT id AS user_id, email FROM users WHERE id = (SELECT user_id FROM certificate_requests WHERE id = ?)",
      [id],
    );

    const patient = patientRows[0];

    eventBus.emit(EVENTS.CERTIFICATE_REJECTED, {
      patientId: patient.user_id,
      patientEmail: patient.email,
    });

    if (result.affectedRows === 0) {
      return res.status(400).json({
        message: "Reject failed (no matching record)",
      });
    }

    res.json({ message: "Request rejected successfully" });
  } catch (error) {
    console.error("Rejection Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// updateStatus Api

exports.updateStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  let certificateFile = null;

  if (status === "approved") {
    certificateFile = `/certificates/${id}.pdf`;
  }

  const query = `
    UPDATE certificate_requests
    SET status = ?, certificate_file = ?
    WHERE id = ?
  `;

  db.query(query, [status, certificateFile, id], (err) => {
    if (err) return res.status(500).json(err);

    res.json({
      message: "Status updated successfully",
    });
  });
};
// getIssuedCertificates Api

exports.getIssuedCertificates = async (req, res) => {
  try {
    const doctorUserId = req.user.id;

    // Doctor table se doctor_id nikalein
    const [doctorRows] = await db.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [doctorUserId],
    );

    if (doctorRows.length === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const doctorId = doctorRows[0].id;

    const [rows] = await db.query(
      `SELECT
      cr.id,
      cr.certificate_id,
      cr.full_name,
      cr.certificate_type,
      cr.issued_at,
      cr.expiry_date,
      cr.certificate_file,
      cr.purpose,
      d.doctorName AS doctor_name
   FROM certificate_requests cr
   JOIN doctors d ON cr.doctor_id = d.id
   WHERE cr.doctor_id = ?
     AND cr.status = 'approved'
   ORDER BY cr.issued_at DESC`,
      [doctorId],
    );

    res.json(rows);
  } catch (error) {
    console.error("Issued Certificates Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
// verifyCertificate Api

exports.verifyCertificate = (req, res) => {
  const { certificateId } = req.params;

  const query = `
    SELECT certificate_id, full_name, certificate_type, status, issued_at, expiry_date
    FROM certificate_requests
    WHERE certificate_id = ?
  `;

  db.query(query, [certificateId], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(404).json({
        valid: false,
        message: "Invalid Certificate",
      });
    }

    const cert = result[0];

    // check expiry
    const now = new Date();
    if (cert.expiry_date && new Date(cert.expiry_date) < now) {
      return res.json({
        valid: false,
        status: "Expired",
        data: cert,
      });
    }

    res.json({
      valid: true,
      status: "Active",
      data: cert,
    });
  });
};
