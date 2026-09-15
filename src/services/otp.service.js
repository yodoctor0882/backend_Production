const crypto = require("crypto");
const bcrypt = require("bcrypt");
const db = require("../config/db");


// GENERATE 6 DIGIT OTP

const generateOTP = () => {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
};

// GENERATE VERIFICATION ID


const generateVerificationId = () => {
  return crypto.randomUUID();
};


// CREATE EMAIL OTP

const createEmailOTP = async (userId) => {

  const otp = generateOTP();

  const verificationId =
  generateVerificationId();

  const otpHash = await bcrypt.hash(otp, 12);


  const expiresAt =
    new Date(
      Date.now() + 5 * 60 * 1000
    );

  await db.query(
    `DELETE FROM otp_verifications
     WHERE user_id = ?
       AND purpose = 'LOGIN'
       AND channel = 'EMAIL'
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
    VALUES (?, ?, ?, 'EMAIL', 'LOGIN', ?)`,
    [
      verificationId,
      userId,
      otpHash,
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
  createEmailOTP,
};