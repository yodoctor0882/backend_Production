const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendLoginOTPEmail = async (email, otp) => {
  await transporter.sendMail({
    from: `"YoDoctor" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: "YoDoctor Login OTP",

    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>YoDoctor Login Verification</h2>

        <p>Your OTP for login is:</p>

        <h1 style="letter-spacing: 8px;">
          ${otp}
        </h1>

        <p>This OTP is valid for <strong>5 minutes</strong>.</p>

        <p>
          If you did not attempt to login, please ignore this email.
        </p>
      </div>
    `,
  });
};

module.exports = {
  sendLoginOTPEmail,
};