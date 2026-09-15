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
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        padding: 30px;
        border: 1px solid #ddd;
        border-radius: 10px;
      ">

        <h2>YoDoctor Login Verification</h2>

        <p>Hello,</p>

        <p>
          We received a login request for your YoDoctor account.
        </p>

        <p>Your verification OTP is:</p>

        <div style="
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
          margin: 25px 0;
        ">
          ${otp}
        </div>

        <p>
          This OTP is valid for <strong>5 minutes</strong>.
        </p>

        <p>
          Do not share this OTP with anyone.
        </p>

        <p>
          If you did not attempt to login, please ignore this email.
        </p>

        <br>

        <p>
          Regards,<br>
          <strong>YoDoctor Team</strong>
        </p>

      </div>
    `,
  });
};

module.exports = {
  sendLoginOTPEmail,
};