const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("../config/s3");

const { sendEmail } = require("../utils/email.service");
const resetPasswordTemplate = require("../utils/emailTemplates/resetPassword.template");

//COMMON HELPERS

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const response = (res, status, success, message) => {
  return res.status(status).json({ success, message });
};

// helper to build full URL
const buildImageUrl = (req, relativePath) => {
  if (!relativePath) return null;
  return `${req.protocol}://${req.get("host")}/${relativePath}`;
};

const deleteFileIfExists = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err; // ignore file not found, throw others
    }
  }
};

// common login api for doctor and patients
exports.login = async (req, res) => {
  const { identifier, password, portal } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: "Email or mobile and password required",
    });
  }

  try {
    /* ================= FETCH USER ================= */
    const [users] = await db.query(
      `SELECT id, email, mobile, password, role, is_active,
              failed_attempts, lock_until
       FROM users
       WHERE email = ? OR mobile = ?`,
      [identifier, identifier],
    );

    /* ================= USER NOT FOUND ================= */
    if (users.length === 0) {
      await bcrypt.compare(
        password,
        "$2b$12$C6UzMDM.H6dfI/f/IKcEeOeWZqR/3Gzdh0dX8GZFODdgNpTiFqouy",
      ); // dummy hash for timing attack protection

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = users[0];

    /* ================= ACCOUNT LOCK CHECK ================= */
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      return res.status(423).json({
        success: false,
        message: "Account locked. Try again after 24 hours.",
      });
    }

    /* ================= ACTIVE CHECK ================= */
    if (user.is_active === 0) {
      return res.status(403).json({
        success: false,
        message: "Account inactive",
      });
    }

    /* ================= PASSWORD CHECK ================= */
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      const attempts = user.failed_attempts + 1;

      if (attempts >= 5) {
        await db.query(
          `UPDATE users
           SET failed_attempts = 0,
               lock_until = DATE_ADD(NOW(), INTERVAL 24 HOUR)
           WHERE id = ?`,
          [user.id],
        );

        return res.status(423).json({
          success: false,
          message:
            "Account locked due to multiple failed attempts. Try again after 24 hours.",
        });
      } else {
        await db.query(
          `UPDATE users
           SET failed_attempts = ?
           WHERE id = ?`,
          [attempts, user.id],
        );

        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }
    }

    /* ================= SUCCESS → RESET ATTEMPTS ================= */
    await db.query(
      `UPDATE users
       SET failed_attempts = 0,
           lock_until = NULL
       WHERE id = ?`,
      [user.id],
    );

    const role = user.role?.trim().toUpperCase();

    if (portal === "DOCTOR" && role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctors can login here",
      });
    }

    if (portal === "USER" && role === "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Please use doctor login page",
      });
    }

    /* ================= DOCTOR FLOW ================= */
    if (user.role?.trim().toUpperCase() === "DOCTOR") {
      const [[doctor]] = await db.query(
        `SELECT status, current_step FROM doctors WHERE user_id = ?`,
        [user.id],
      );

      if (!doctor) {
        return res.status(403).json({
          success: false,
          message: "Doctor profile not found. Contact admin.",
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
      );

      /* ===== IN_PROGRESS → Resume ===== */
      if (doctor.status === "IN_PROGRESS") {
        return res.status(200).json({
          success: true,
          message: "Resume registration",
          redirect: "resume",
          nextStep: doctor.current_step + 1,
          status: doctor.status,
          data: { token },
        });
      }

      /* ===== PENDING_VERIFICATION ===== */
      if (doctor.status === "PENDING") {
        return res.status(200).json({
          success: true,
          message: "Profile under verification",
          redirect: "waiting-approval",
          status: doctor.status,
          data: { token },
        });
      }

      /* ===== APPROVED ===== */
      if (doctor.status === "APPROVED") {
        return res.status(200).json({
          success: true,
          message: "Login successful",
          redirect: "dashboard",
          status: doctor.status,
          data: { token },
        });
      }
    }

    /* ================= PATIENT FLOW ================= */
    if (user.role?.trim().toUpperCase() === "PATIENT") {
      const token = jwt.sign(
        {
          id: user.id,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
      );

      return res.status(200).json({
        success: true,
        message: "Login successful",
        redirect: "dashboard",
        data: { token },
      });
    }

    /* ================= ADMIN FLOW ================= */
    if (user.role?.trim().toUpperCase() === "ADMIN") {
      const token = jwt.sign(
        {
          id: user.id,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
      );

      return res.status(200).json({
        success: true,
        message: "Admin login successful",
        redirect: "admin-dashboard",
        data: { token },
      });
    }

    /* ================= FALLBACK ================= */
    return res.status(403).json({
      success: false,
      message: "Invalid role",
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// forget password through email or mobile number

exports.forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return response(res, 400, false, "Email is required");
    }

    const [[user]] = await db.query(
      `SELECT id, email, reset_token_expiry
       FROM users
       WHERE email = ?`,
      [identifier],
    );

    if (!user) {
      return response(res, 404, false, "Please enter correct email");
    }

    // 🔒 Rate limit check (cooldown 2 minutes)
    if (
      user.reset_token_expiry &&
      new Date(user.reset_token_expiry) > new Date(Date.now() - 2 * 60 * 1000)
    ) {
      return response(res, 429, false, "Please wait before requesting again");
    }

    // Generate token
    const plainToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(plainToken)
      .digest("hex");

    await db.query(
      `UPDATE users
       SET reset_token = ?,
           reset_token_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
       WHERE id = ?`,
      [hashedToken, user.id],
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${plainToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset Your Password",
      html: resetPasswordTemplate(user.email, resetLink),
    });

    return response(res, 200, true, "Reset link sent to your email");
  } catch (err) {
    return response(res, 500, false, "Server error");
  }
};

// VERIFY TOKEN for email /  verofy OTP for mobile number

exports.verifyReset = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return response(res, 400, false, "Token required");
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const [[user]] = await db.query(
      `SELECT id
       FROM users
       WHERE reset_token = ?
       AND reset_token_expiry > NOW()`,
      [hashedToken],
    );

    if (!user) {
      return response(res, 400, false, "Invalid or expired link");
    }

    return response(res, 200, true, "Token valid");
  } catch (err) {
    return response(res, 500, false, "Server error");
  }
};

// RESET PASSWORD (FINAL STEP)

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return response(res, 400, false, "All fields required");
    }

    if (newPassword !== confirmPassword) {
      return response(res, 400, false, "Passwords do not match");
    }

    // 🔒 Strong password validation (same as register)
    if (!strongPasswordRegex.test(newPassword)) {
      return response(
        res,
        400,
        false,
        "Password must include uppercase, lowercase, number and min 8 chars",
      );
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const [[user]] = await db.query(
      `SELECT id
       FROM users
       WHERE reset_token = ?
       AND reset_token_expiry > NOW()`,
      [hashedToken],
    );

    if (!user) {
      return response(res, 400, false, "Invalid or expired link");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.query(
      `UPDATE users
       SET password = ?,
           reset_token = NULL,
           reset_token_expiry = NULL
       WHERE id = ?`,
      [hashedPassword, user.id],
    );

    return response(res, 200, true, "Password reset successfully");
  } catch (err) {
    return response(res, 500, false, "Server error");
  }
};

//UPLOAD / UPDATE PROFILE IMAGE

exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    const imageUrl = req.file.location;

    // get old image
    const [[user]] = await db.query(
      "SELECT profile_image FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ❌ DO NOT delete local file (no local anymore)

    // update DB
    await db.query("UPDATE users SET profile_image = ? WHERE id = ?", [
      imageUrl,
      req.user.id,
    ]);

    return res.json({
      success: true,
      imageUrl: imageUrl,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

//GET PROFILE IMAGE

exports.getProfileImage = async (req, res) => {
  try {
    const [[user]] = await db.query(
      "SELECT profile_image FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      imageUrl: user.profile_image || null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

//DELETE PROFILE IMAGE

exports.deleteProfileImage = async (req, res) => {
  try {
    const [[user]] = await db.query(
      "SELECT profile_image FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!user || !user.profile_image) {
      return res.status(400).json({
        success: false,
        message: "No profile image to delete",
      });
    }

    const imageUrl = user.profile_image;

    // 🔥 Extract key from URL
    const key = imageUrl.split(".amazonaws.com/")[1];

    // 🔥 Delete from S3
    await s3.send(
      new DeleteObjectCommand({
        Bucket: "yodoctor.in",
        Key: key,
      }),
    );

    // remove from DB
    await db.query("UPDATE users SET profile_image = NULL WHERE id = ?", [
      req.user.id,
    ]);

    return res.json({
      success: true,
      imageUrl: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
