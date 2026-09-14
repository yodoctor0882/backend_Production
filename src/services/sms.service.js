const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendLoginOTPSMS = async (mobile, otp) => {
  await client.messages.create({
    body: `Your YoDoctor login OTP is ${otp}. It is valid for 5 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: mobile,
  });
};

module.exports = {
  sendLoginOTPSMS,
};