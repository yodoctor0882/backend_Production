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


const serviceFees = require("../config/serviceFees");
// const razorpay = require("../utils/razorpay"); 

// createRequest Api

exports.createRequest = async (req, res) => {
  return res.status(410).json({
    success: false,
    message:
      "Direct certificate request creation is disabled. Please complete payment first.",
  });
};

// createPaymentOrder

exports.createPaymentOrder = async (req, res) => {
  try {
    const userId = req.user.id;

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

    if (!doctor_id) {
      return res.status(400).json({
        success: false,
        message: "Doctor ID is required",
      });
    }

    if (!certificate_type) {
      return res.status(400).json({
        success: false,
        message: "Certificate type is required",
      });
    }

    const [doctorRows] = await db.query(
      `
      SELECT id, user_id
      FROM doctors
      WHERE id = ?
      LIMIT 1
      `,
      [doctor_id]
    );

    if (doctorRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }


    const [serviceRows] = await db.query(
      `
      SELECT fee
      FROM doctor_services
      WHERE doctor_id = ?
        AND service = 'CERTIFICATE'
        AND enabled = TRUE
      LIMIT 1
      `,
      [doctor_id]
    );

    if (serviceRows.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "This doctor does not provide certificate service",
      });
    }

    const doctorFee = Number(serviceRows[0].fee);

    const platformFee = Number(
      serviceFees.CERTIFICATE_PLATFORM_FEE
    );

    if (!Number.isFinite(doctorFee) || doctorFee < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor fee",
      });
    }

    if (!Number.isFinite(platformFee) || platformFee < 0) {
      return res.status(500).json({
        success: false,
        message: "Invalid platform fee configuration",
      });
    }

    const totalAmount = doctorFee + platformFee;

    const amountInPaise = Math.round(
      totalAmount * 100
    );


    const razorpayOrder =
      await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",

        receipt: `CERT-${userId}-${Date.now()}`,

        notes: {
          patient_id: String(userId),
          doctor_id: String(doctor_id),
          certificate_type: String(certificate_type),
          service: "CERTIFICATE",
        },
      });

    const formData = {
      purpose: purpose || null,
      notes: notes || null,

      full_name: full_name || null,
      dob: dob || null,
      gender: gender || null,
      blood_group: blood_group || null,
      height: height || null,
      weight: weight || null,
      medical_conditions:
        medical_conditions || null,
      medications: medications || null,
    };

    const [paymentResult] =
      await db.query(
        `
        INSERT INTO certificate_payments
        (
          user_id,
          doctor_id,
          certificate_type,
          doctor_fee,
          platform_fee,
          total_amount,
          razorpay_order_id,
          status,
          form_data
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'CREATED', ?)
        `,
        [
          userId,
          doctor_id,
          certificate_type,
          doctorFee,
          platformFee,
          totalAmount,
          razorpayOrder.id,
          JSON.stringify(formData),
        ]
      );

    return res.status(200).json({
      success: true,
      message: "Payment order created successfully",

      data: {
        paymentId: paymentResult.insertId,

        razorpayKeyId:
          process.env.RAZORPAY_KEY_ID,

        orderId:
          razorpayOrder.id,

        doctorId: doctor_id,

        certificateType:
          certificate_type,

        doctorFee,

        platformFee,

        totalAmount,

        currency: "INR",
      },
    });

  } catch (error) {
    console.error(
      "createPaymentOrder error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

// verify payment

const crypto = require("crypto");

exports.verifyPayment = async (req, res) => {
  let connection = null;

  try {
    const userId = req.user.id;

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details are required",
      });
    }


    connection = await db.getConnection();

    await connection.beginTransaction();

    const [paymentRows] = await connection.query(
      `
      SELECT *
      FROM certificate_payments
      WHERE razorpay_order_id = ?
        AND user_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [
        razorpay_order_id,
        userId,
      ]
    );

    if (paymentRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Certificate payment record not found",
      });
    }

    const paymentRecord = paymentRows[0];

    if (
      paymentRecord.status === "PAID" &&
      paymentRecord.certificate_request_id
    ) {
      await connection.commit();

      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        requestId:
          paymentRecord.certificate_request_id,
      });
    }

    if (paymentRecord.status !== "CREATED") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Payment cannot be verified because current status is ${paymentRecord.status}`,
      });
    }


    const generatedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest("hex");

    if (
      generatedSignature !==
      razorpay_signature
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed",
      });
    }

    const razorpayPayment =
      await razorpay.payments.fetch(
        razorpay_payment_id
      );

    if (!razorpayPayment) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Razorpay payment not found",
      });
    }

    if (
      razorpayPayment.order_id !==
      paymentRecord.razorpay_order_id
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Payment does not belong to this certificate order",
      });
    }

    if (
      razorpayPayment.status !==
      "captured"
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Payment has not been captured",
        paymentStatus:
          razorpayPayment.status,
      });
    }

    const expectedAmount =
      Math.round(
        Number(paymentRecord.total_amount) * 100
      );

    const razorpayAmount =
      Number(razorpayPayment.amount);

    if (
      razorpayAmount !==
      expectedAmount
    ) {
      console.error(
        "❌ Certificate payment amount mismatch",
        {
          expectedAmount,
          razorpayAmount,
          orderId:
            razorpay_order_id,
          paymentId:
            razorpay_payment_id,
        }
      );

      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Payment amount does not match certificate amount",
      });
    }

    let formData = {};

    if (paymentRecord.form_data) {
      try {
        formData =
          typeof paymentRecord.form_data ===
          "string"
            ? JSON.parse(
                paymentRecord.form_data
              )
            : paymentRecord.form_data;
      } catch (parseError) {
        await connection.rollback();

        return res.status(500).json({
          success: false,
          message:
            "Invalid certificate form data",
        });
      }
    }


    const [requestResult] =
      await connection.query(
        `
        INSERT INTO certificate_requests
        (
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

          doctor_fee,
          platform_fee,
          total_amount,

          payment_status,
          status,

          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature
        )
        VALUES
        (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          'paid',
          'pending',
          ?, ?, ?
        )
        `,
        [
          paymentRecord.user_id,
          paymentRecord.doctor_id,
          paymentRecord.certificate_type,

          formData.purpose || null,
          formData.notes || null,

          formData.full_name || null,
          formData.dob || null,
          formData.gender || null,
          formData.blood_group || null,
          formData.height || null,
          formData.weight || null,
          formData.medical_conditions || null,
          formData.medications || null,

          paymentRecord.doctor_fee,
          paymentRecord.platform_fee,
          paymentRecord.total_amount,

          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        ]
      );

    const requestId = requestResult.insertId;


    await connection.query(
      `
      INSERT INTO certificate_request_timeline
      (
        request_id,
        label,
        state
      )
      VALUES
      (?, 'Request submitted', 'done'),
      (?, 'Payment Completed', 'done'),
      (?, 'Under Verification', 'waiting')
      `,
      [
        requestId,
        requestId,
        requestId,
      ]
    );

    const [paymentUpdate] =
      await connection.query(
        `
        UPDATE certificate_payments
        SET
          status = 'PAID',
          razorpay_payment_id = ?,
          razorpay_signature = ?,
          certificate_request_id = ?,
          paid_at = NOW()
        WHERE id = ?
          AND status = 'CREATED'
        `,
        [
          razorpay_payment_id,
          razorpay_signature,
          requestId,
          paymentRecord.id,
        ]
      );

    // Safety check
    if (
      paymentUpdate.affectedRows !== 1
    ) {
      throw new Error(
        "Certificate payment could not be marked as PAID"
      );
    }

    await connection.commit();
    connection.release();
    connection = null;

    try {
      const [doctorRows] =
        await db.query(
          `
          SELECT user_id
          FROM doctors
          WHERE id = ?
          LIMIT 1
          `,
          [paymentRecord.doctor_id]
        );

      const doctorUserId =
        doctorRows[0]?.user_id;

      if (doctorUserId) {
        eventBus.emit(
          EVENTS.CERTIFICATE_REQUEST_CREATED,
          {
            doctorId: doctorUserId,

            patientName:
              formData.full_name ||
              null,

            certificateType:
              paymentRecord.certificate_type,
          }
        );
      }
    } catch (notificationError) {
      console.error(
        "Certificate doctor notification error:",
        notificationError
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Payment verified and certificate request created successfully",

      data: {
        paymentId:
          paymentRecord.id,

        requestId,

        paymentStatus:
          "PAID",

        requestStatus:
          "pending",
      },
    });

  } catch (error) {

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Certificate payment rollback error:",
          rollbackError
        );
      }
    }

    console.error(
      "❌ verifyPayment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Payment verification failed",
      error: error.message,
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// refundCertificatePayment


exports.refundCertificatePayment = async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required",
      });
    }

    // 1. Get certificate request + payment details
    const [requestRows] = await connection.query(
      `
      SELECT
        id,
        user_id,
        doctor_id,
        status,
        payment_status,
        total_amount,
        razorpay_payment_id,
        razorpay_order_id
      FROM certificate_requests
      WHERE id = ?
      LIMIT 1
      `,
      [request_id]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Certificate request not found",
      });
    }

    const request = requestRows[0];

    // 2. Check payment status
    if (request.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "No successful payment found for this request",
      });
    }

    // 3. Check Razorpay payment ID
    if (!request.razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment ID not found",
      });
    }

    // 4. Make sure request is rejected
    if (request.status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Refund is allowed only for rejected requests",
      });
    }

    // 5. Prevent duplicate refund
    if (request.payment_status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been refunded",
      });
    }

    // 6. Amount in paise
    const refundAmount = Math.round(
      Number(request.total_amount) * 100
    );

    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund amount",
      });
    }

    // 7. Create Razorpay refund
    const refund = await razorpay.payments.refund(
      request.razorpay_payment_id,
      {
        amount: refundAmount,
        notes: {
          request_id: String(request_id),
          reason: "Certificate request rejected by doctor",
        },
      }
    );

    // 8. Update request
    await connection.query(
      `
      UPDATE certificate_requests
      SET
        payment_status = 'refunded',
        razorpay_refund_id = ?
      WHERE id = ?
      `,
      [
        refund.id,
        request_id,
      ]
    );

    // 9. Add timeline
    await connection.query(
      `
      INSERT INTO certificate_request_timeline
      (request_id, label, state)
      VALUES (?, 'Payment Refunded', 'done')
      `,
      [request_id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      requestId: request_id,
      refundId: refund.id,
      refundAmount: Number(request.total_amount),
    });

  } catch (error) {

    if (connection) {
      await connection.rollback();
    }

    console.error("refundCertificatePayment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to refund payment",
      error: error.message,
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ================= Upload Documents =================


exports.uploadDocument = async (req, res) => {
  let connection = null;

  try {
    const userId = req.user.id;
    const { request_id } = req.body;

    // =====================================================
    // 1. VALIDATION
    // =====================================================

    if (!request_id) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required",
      });
    }

    if (
      !req.files ||
      Object.keys(req.files).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    // =====================================================
    // 2. REQUIRED DOCUMENTS
    // =====================================================

    if (!req.files.profilePhoto) {
      return res.status(400).json({
        success: false,
        message: "Profile photo is required",
      });
    }

    if (!req.files.idProof) {
      return res.status(400).json({
        success: false,
        message: "ID proof is required",
      });
    }

    // =====================================================
    // 3. START TRANSACTION
    // =====================================================

    connection = await db.getConnection();

    await connection.beginTransaction();

    // =====================================================
    // 4. GET CERTIFICATE REQUEST
    // =====================================================

    const [requestRows] =
      await connection.query(
        `
        SELECT
          id,
          user_id,
          doctor_id,
          payment_status,
          status
        FROM certificate_requests
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [request_id, userId]
      );

    if (requestRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Certificate request not found",
      });
    }

    const request = requestRows[0];

    // =====================================================
    // 5. PAYMENT CHECK
    // =====================================================

    if (request.payment_status !== "paid") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Documents cannot be uploaded before payment is completed",
      });
    }


    if (request.status !== "pending") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Documents cannot be uploaded for request with status ${request.status}`,
      });
    }

    // =====================================================
    // 7. PREPARE FILES
    // =====================================================

    const allFiles = [
      ...(req.files.profilePhoto || []).map(
        (file) => ({
          ...file,
          type: "profilePhoto",
        })
      ),

      ...(req.files.idProof || []).map(
        (file) => ({
          ...file,
          type: "idProof",
        })
      ),

      ...(req.files.medicalReports || []).map(
        (file) => ({
          ...file,
          type: "medicalReports",
        })
      ),

      ...(req.files.prescription || []).map(
        (file) => ({
          ...file,
          type: "prescription",
        })
      ),
    ];

    if (allFiles.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "No valid documents found",
      });
    }

    // =====================================================
    // 8. SAVE DOCUMENTS
    // =====================================================

    const values = allFiles.map(
      (file) => [
        request_id,
        file.path,
        file.type,
      ]
    );

    await connection.query(
      `
      INSERT INTO certificate_documents
      (
        request_id,
        file_url,
        doc_type
      )
      VALUES ?
      `,
      [values]
    );

    await connection.commit();

    connection.release();
    connection = null;

    // =====================================================
    // 11. SUCCESS
    // =====================================================

    return res.status(201).json({
      success: true,
      message: "Documents uploaded successfully.",

      data: {
        requestId: request_id,
        status: "pending",
      },
    });

  } catch (error) {
    // =====================================================
    // ROLLBACK
    // =====================================================

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Document upload rollback error:",
          rollbackError
        );
      }
    }

    console.error(
      "❌ Certificate document upload error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to upload certificate documents",
      error: error.message,
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};


// refundCertificatePayment


exports.refundCertificatePayment = async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required",
      });
    }

    // 1. Get certificate request + payment details
    const [requestRows] = await connection.query(
      `
      SELECT
        id,
        user_id,
        doctor_id,
        status,
        payment_status,
        total_amount,
        razorpay_payment_id,
        razorpay_order_id
      FROM certificate_requests
      WHERE id = ?
      LIMIT 1
      `,
      [request_id]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Certificate request not found",
      });
    }

    const request = requestRows[0];

    // 2. Check payment status
    if (request.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "No successful payment found for this request",
      });
    }

    // 3. Check Razorpay payment ID
    if (!request.razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment ID not found",
      });
    }

    // 4. Make sure request is rejected
    if (request.status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Refund is allowed only for rejected requests",
      });
    }

    // 5. Prevent duplicate refund
    if (request.payment_status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been refunded",
      });
    }

    // 6. Amount in paise
    const refundAmount = Math.round(
      Number(request.total_amount) * 100
    );

    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund amount",
      });
    }

    // 7. Create Razorpay refund
    const refund = await razorpay.payments.refund(
      request.razorpay_payment_id,
      {
        amount: refundAmount,
        notes: {
          request_id: String(request_id),
          reason: "Certificate request rejected by doctor",
        },
      }
    );

    // 8. Update request
    await connection.query(
      `
      UPDATE certificate_requests
      SET
        payment_status = 'refunded',
        razorpay_refund_id = ?
      WHERE id = ?
      `,
      [
        refund.id,
        request_id,
      ]
    );

    // 9. Add timeline
    await connection.query(
      `
      INSERT INTO certificate_request_timeline
      (request_id, label, state)
      VALUES (?, 'Payment Refunded', 'done')
      `,
      [request_id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      requestId: request_id,
      refundId: refund.id,
      refundAmount: Number(request.total_amount),
    });

  } catch (error) {

    if (connection) {
      await connection.rollback();
    }

    console.error("refundCertificatePayment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to refund payment",
      error: error.message,
    });

  } finally {
    if (connection) {
      connection.release();
    }
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

    // Request check
    const [rows] = await db.query(
      `SELECT * FROM certificate_requests WHERE id = ?`,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    await db.query(
      `UPDATE certificate_requests
       SET status = 'verification'
       WHERE id = ?
       AND status = 'pending'`,
      [id],
    );

    if (rows[0].status === "pending") {
      await db.query(
        `UPDATE certificate_request_timeline
         SET state = 'done'
         WHERE request_id = ?`,
        [id],
      );
    }

    const [updatedRows] = await db.query(
      `SELECT * FROM certificate_requests WHERE id = ?`,
      [id],
    );

    res.json(updatedRows[0]);
  } catch (error) {
    console.error("Error fetching request details:", error);

    res.status(500).json({
      message: "Server error",
    });
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
  let connection = null;
  let generatedFilePath = null;
  let transactionCommitted = false;
  try {
    console.log("API HIT");
    const logoPath = path.join(process.cwd(), "src/assets/logo.webp");
    const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
    const logo = `data:image/webp;base64,${logoBase64}`;

    const { id } = req.params;
    const doctorUserId = req.user.id;
    const { doctor_notes, fitness_status, validity } = req.body;

    const allowedFitnessStatus = [
      "Fit — No Restrictions",
      "Fit with Restrictions",
      "Temporarily Unfit",
      "Unfit",
    ];

    if (!fitness_status || !allowedFitnessStatus.includes(fitness_status)) {
      return res.status(400).json({
        message: "Invalid fitness status",
      });
    }

    const validityMap = {
      "1 month": 30,
      "3 months": 90,
      "6 months": 180,
      "1 year": 365,
    };

    const normalizedValidity = String(validity || "")
      .trim()
      .toLowerCase();

    const validityDays = validityMap[normalizedValidity];

    if (!validityDays) {
      return res.status(400).json({
        message: "Invalid certificate validity",
      });
    }

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

    if (!doctorRows.length) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    const doctor = doctorRows[0];

    const doctorId = doctor.id;
    const doctorName = doctor.doctorName;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [requestRows] = await connection.query(
      `SELECT
      full_name,
      certificate_type,
      purpose,
      medical_conditions,
      dob,
      gender,
      notes,
      medications,
      status,
      certificate_id,
      certificate_file
   FROM certificate_requests
   WHERE id = ?
     AND doctor_id = ?
   FOR UPDATE`,
      [id, doctorId],
    );

    if (!requestRows.length) {
      await connection.rollback();

      return res.status(404).json({
        message: "Request not found",
      });
    }

    const request = requestRows[0];

    if (request.status !== "verification") {
      await connection.rollback();

      return res.status(409).json({
        message: "Certificate already approved",
        status: request.status,
      });
    }
    const [clinicRows] = await connection.query(
      "SELECT clinic_name FROM doctor_clinics WHERE doctor_id = ? LIMIT 1",
      [doctorId],
    );

    const clinicName = clinicRows[0]?.clinic_name || " ";

    const certificateId = generateCertificateId();
    const expiryDate = calculateExpiry(validityDays);

    const dirPath = path.join(process.cwd(), "uploads/certificates");
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const certificateFile = `uploads/certificates/${certificateId}.pdf`;
    const filePath = path.join(process.cwd(), certificateFile);

    const qrData = `${process.env.BASE_URL}/verify/${certificateId}`;
    const qrImage = await QRCode.toDataURL(qrData);

    const [docRows] = await connection.query(
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
      days: validityDays,
      doctorImage: doctor.profile_image,
      logo: logo,
      qr: qrImage,
      patientPhoto: patientPhoto,
    });

    const pdfBuffer = await generatePDF(html);

    fs.writeFileSync(filePath, pdfBuffer);

    generatedFilePath = filePath;

    const [updateResult] = await connection.query(
      `UPDATE certificate_requests
   SET status = 'approved',
       certificate_id = ?,
       doctor_notes = ?,
       fitness_status = ?,
       issued_at = NOW(),
       expiry_date = ?,
       certificate_file = ?
   WHERE id = ?
   AND doctor_id = ?
   AND status = 'verification'`,
      [
        certificateId,
        doctor_notes || null,
        fitness_status,
        expiryDate,
        certificateFile,
        id,
        doctorId,
      ],
    );
    if (updateResult.affectedRows !== 1) {
      throw new Error("Certificate could not be approved");
    }

    await connection.query(
      `UPDATE certificate_request_timeline
   SET state = 'done'
   WHERE request_id = ?`,
      [id],
    );

    await connection.query(
      `INSERT INTO certificate_request_timeline
   (request_id, label, state)
   VALUES (?, 'Approved', 'done')`,
      [id],
    );

    const [patientRows] = await connection.query(
      `SELECT id AS user_id, email
   FROM users
   WHERE id = (
     SELECT user_id
     FROM certificate_requests
     WHERE id = ?
   )`,
      [id],
    );

    const patient = patientRows[0] || null;

    await connection.commit();
    transactionCommitted = true;

    if (patient) {
      try {
        eventBus.emit(EVENTS.CERTIFICATE_APPROVED, {
          patientId: patient.user_id,
          patientEmail: patient.email,
          certificateId,
        });
      } catch (eventError) {
        console.error("Certificate approved event error:", eventError);
      }
    }

    return res.json({
      message: "Certificate approved and PDF generated successfully",
      certificateId,
    });
  } catch (error) {
    if (connection && !transactionCommitted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback Error:", rollbackError);
      }
    }
    if (
      generatedFilePath &&
      !transactionCommitted &&
      fs.existsSync(generatedFilePath)
    ) {
      try {
        fs.unlinkSync(generatedFilePath);
      } catch (fileError) {
        console.error("PDF cleanup error:", fileError);
      }
    }

    console.error("Approve Error:", error);

    return res.status(500).json({
      message: "Server Error",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// rejectRequest Api

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorUserId = req.user.id;
    const [doctorRows] = await db.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [doctorUserId],
    );

    if (!doctorRows.length) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    const doctorId = doctorRows[0].id;
    const [result] = await db.query(
      `UPDATE certificate_requests
       SET status = 'rejected'
       WHERE id = ?
       AND doctor_id = ?
        AND status = 'verification'`,
      [id, doctorId],
    );

    if (result.affectedRows !== 1) {
      return res.status(409).json({
        message: "Certificate cannot be rejected",
      });
    }

    await db.query(
      `UPDATE certificate_request_timeline
       SET state = 'done'
       WHERE request_id = ?`,
      [id],
    );

    await db.query(
      `INSERT INTO certificate_request_timeline
       (request_id, label, state)
       VALUES (?, 'Request Rejected', 'done')`,
      [id],
    );

    const [patientRows] = await db.query(
      `SELECT id AS user_id, email
       FROM users
       WHERE id = (
         SELECT user_id
         FROM certificate_requests
         WHERE id = ?
       )`,
      [id],
    );

    const patient = patientRows[0];
    if (patient) {
      try {
        eventBus.emit(EVENTS.CERTIFICATE_REJECTED, {
          patientId: patient.user_id,
          patientEmail: patient.email,
        });
      } catch (eventError) {
        console.error("Certificate rejected event error:", eventError);
      }
    }

    return res.json({
      message: "Request rejected successfully",
    });
  } catch (error) {
    console.error("Rejection Error:", error);

    return res.status(500).json({
      message: "Server error",
    });
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

// get all doctor for certificate

exports.getAllCertificateDoctors = async (req, res) => {
  try {
    const [doctors] = await db.query(`
            SELECT
                d.id AS id,
                d.doctorName,
                d.specialization,
                d.experience_years,
                d.rating,
                dd.file_path AS profile_image,
                ds.fee AS certificate_fee

            FROM doctors d

            LEFT JOIN doctor_documents dd
                ON dd.doctor_id = d.id
                AND dd.doc_type = 'profile'

            INNER JOIN doctor_services ds
                ON ds.doctor_id = d.id
                AND ds.service = 'CERTIFICATE'
                AND ds.enabled = TRUE

            WHERE d.status = 'APPROVED'

            AND EXISTS (
                SELECT 1
                FROM subscriptions s
                WHERE s.user_id = d.user_id
                AND s.status = 'active'
            )

            ORDER BY d.rating DESC

            LIMIT 5
        `);

    return res.status(200).json({
      success: true,
      doctors,
    });
  } catch (err) {
    console.error("getAllDoctors error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
