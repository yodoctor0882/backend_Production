const resetPasswordTemplate = (name, resetLink) => {
  return `
    <div style="font-family: Arial; padding:20px">
      <h2>Password Reset</h2>
      <p>Hello ${name},</p>
      <p>You requested to reset your password.</p>
      <p>Click the link below:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>If you did not request this, ignore this email.</p>
    </div>
  `;
};

module.exports = resetPasswordTemplate;