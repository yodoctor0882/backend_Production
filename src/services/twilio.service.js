const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

const sendLoginOTPSMS = async (mobile) => {
  try {
    console.log("📱 TWILIO SMS TO:", mobile);
    console.log("🔑 VERIFY SERVICE:", process.env.TWILIO_VERIFY_SERVICE_SID);

    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: mobile,
        channel: "sms",
      });

    console.log("✅ TWILIO RESPONSE:", verification.status);

    return {
      success: true,
      status: verification.status,
    };
  } catch (error) {
    throw new Error("Failed to send SMS OTP");
  }
};

const verifyLoginOTPSMS = async (mobile, otp) => {
  try {
    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: mobile,
        code: otp,
      });

    return {
      success: verificationCheck.status === "approved",
      status: verificationCheck.status,
    };
  } catch (error) {
    console.error("TWILIO VERIFY OTP ERROR:", error);

    throw new Error("Failed to verify SMS OTP");
  }
};

module.exports = {
  sendLoginOTPSMS,
  verifyLoginOTPSMS,
};
