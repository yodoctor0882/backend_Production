const { AccessToken } = require("livekit-server-sdk");

const { v4: uuidv4 } = require("uuid");

const db = require("../config/db");

/* =========================================
   GET LIVEKIT TOKEN
========================================= */

const getLiveKitToken = async (req, res) => {
  try {
    const { roomName } = req.body;

    if (!roomName) {
      return res.status(400).json({
        success: false,
        message: "roomName is required",
      });
    }

    // FIND CONSULTATION

    const [rows] = await db.query(
      `
        SELECT *
        FROM consultations
        WHERE room_name = ?
      `,
      [roomName],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Consultation room not found",
      });
    }

    const consultation = rows[0];

    // CHECK ACCESS

    const isAllowed =
      consultation.doctor_user_id === req.user.id ||
      consultation.patient_user_id === req.user.id;

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized room access",
      });
    }

    // CHECK STATUS

    if (consultation.status === "ended") {
      return res.status(400).json({
        success: false,
        message: "Consultation already ended",
      });
    }

    // UPDATE STATUS TO ACTIVE

    if (consultation.status === "waiting") {
      await db.query(
        `
        UPDATE consultations
        SET
          status = 'active',
          started_at = NOW()
        WHERE id = ?
      `,
        [consultation.id],
      );
    }

    // GENERATE LIVEKIT TOKEN

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,

      process.env.LIVEKIT_API_SECRET,

      {
        identity: `${req.user.role}-${req.user.id}`,

        ttl: "10m",
      },
    );

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    return res.status(200).json({
      success: true,
      token: jwt,
      url: process.env.LIVEKIT_URL,
      roomName,
      consultationId: consultation.id,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate token",
    });
  }
};

/* =========================================
   CREATE CONSULTATION
========================================= */

const createConsultation = async (req, res) => {
  try {
    const { doctorUserId } = req.body;

    const patientUserId = req.user.id;

    // VALIDATE DOCTOR

    const [doctor] = await db.query(
      `
          SELECT id
          FROM users
          WHERE id = ?
          AND role = 'DOCTOR'
        `,
      [doctorUserId],
    );

    if (!doctor.length) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // CHECK EXISTING ACTIVE CONSULTATION

    const [existing] = await db.query(
      `
          SELECT id
          FROM consultations
          WHERE
            doctor_user_id = ?
            AND patient_user_id = ?
            AND status IN ('waiting', 'active')
        `,
      [doctorUserId, patientUserId],
    );

    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: "Consultation already exists",
      });
    }

    // GENERATE ROOM NAME

    const roomName = `consultation-${uuidv4()}`;

    // CREATE CONSULTATION

    const [result] = await db.query(
      `
          INSERT INTO consultations
          (
            doctor_user_id,
            patient_user_id,
            room_name,
            status
          )
          VALUES (?, ?, ?, ?)
        `,
      [doctorUserId, patientUserId, roomName, "waiting"],
    );

    return res.status(201).json({
      success: true,
      consultationId: result.insertId,
      roomName,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create consultation",
    });
  }
};

/* =========================================
   END CONSULTATION
========================================= */

const endConsultation = async (req, res) => {
  try {
    const { consultationId } = req.params;

    await db.query(
      `
        UPDATE consultations
        SET
          status = 'ended',
          ended_at = NOW()
        WHERE id = ?
        AND (
          doctor_user_id = ?
          OR patient_user_id = ?
        )
      `,
      [consultationId, req.user.id, req.user.id],
    );

    return res.status(200).json({
      success: true,
      message: "Consultation ended",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to end consultation",
    });
  }
};

/* =========================================
   SAVE MESSAGE
========================================= */

const saveMessage = async (req, res) => {
  try {
    const { consultationId, message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    // CHECK ACCESS

    const [consultation] = await db.query(
      `
        SELECT id
        FROM consultations
        WHERE id = ?
        AND (
          doctor_user_id = ?
          OR patient_user_id = ?
        )
      `,
      [consultationId, req.user.id, req.user.id],
    );

    if (!consultation.length) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // SAVE MESSAGE

    await db.query(
      `
      INSERT INTO consultation_messages
      (
        consultation_id,
        sender_user_id,
        message
      )
      VALUES (?, ?, ?)
    `,
      [consultationId, req.user.id, message],
    );

    return res.status(200).json({
      success: true,
      message: "Saved",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to save message",
    });
  }
};

/* =========================================
   GET MESSAGES
========================================= */

const getMessages = async (req, res) => {
  try {
    const { consultationId } = req.params;

    // CHECK ACCESS

    const [consultation] = await db.query(
      `
        SELECT id
        FROM consultations
        WHERE id = ?
        AND (
          doctor_user_id = ?
          OR patient_user_id = ?
        )
      `,
      [consultationId, req.user.id, req.user.id],
    );

    if (!consultation.length) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // FETCH MESSAGES

    const [messages] = await db.query(
      `
        SELECT *
        FROM consultation_messages
        WHERE consultation_id = ?
        ORDER BY created_at ASC
      `,
      [consultationId],
    );

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
};

/* =========================================
   GET CONSULTATION
========================================= */

const getConsultationById = async (req, res) => {
  try {
    const { consultationId } = req.params;

    const userId = req.user.id;

    const [rows] = await db.query(
      `
          SELECT *
          FROM consultations
          WHERE id = ?
          AND (
            doctor_user_id = ?
            OR patient_user_id = ?
          )
        `,
      [consultationId, userId, userId],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    return res.status(200).json({
      success: true,
      consultation: rows[0],
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch consultation",
    });
  }
};

module.exports = {
  getLiveKitToken,
  createConsultation,
  endConsultation,
  getConsultationById,
  saveMessage,
  getMessages,
};
