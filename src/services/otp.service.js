const crypto = require("crypto");
const bcrypt = require("bcrypt");
const db = require("../config/db");

// Generate 6 digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Generate temporary verification ID
const generateVerificationId = () => {
  return crypto.randomUUID();
};

// Create OTP
const createOTP = async ({ userId, channel }) => {
  const otp = generateOTP();
  const verificationId = generateVerificationId();

  const otpHash = await bcrypt.hash(otp, 12);

  // OTP valid for 5 minutes
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Delete previous unused login OTPs
  await db.query(
    `DELETE FROM otp_verifications
     WHERE user_id = ?
     AND purpose = 'LOGIN'
     AND verified_at IS NULL`,
    [userId]
  );

  await db.query(
    `INSERT INTO otp_verifications
      (
        verification_id,
        user_id,
        otp_hash,
        channel,
        purpose,
        expires_at
      )
     VALUES (?, ?, ?, ?, 'LOGIN', ?)`,
    [
      verificationId,
      userId,
      otpHash,
      channel,
      expiresAt,
    ]
  );

  return {
    otp,
    verificationId,
    expiresAt,
  };
};

module.exports = {
  generateOTP,
  createOTP,
};