// // handlers/certificate.handler.js
// const { createAppNotification } = require("../utils/notification.db");
// const { sendEmail } = require("../utils/email.service");


// exports.handleCertificateRequestCreated = async (data) => {
//   try {
//     const title = "🆕 New Certificate Request";
//     const message = `${data.patientName} has requested a ${data.certificateType} certificate`;

//     await createAppNotification({
//       userId: data.doctorId,
//       role: "doctor",
//       title,
//       message,
//     });
//   } catch (err) {
//     console.error(err);
//   }
// };

// exports.handleCertificateApproved = async (data) => {
//   try {
//     const title = "🎉 Certificate Approved";
//     const message = `Your certificate (${data.certificateId}) has been approved and is ready to download.`;

//     await createAppNotification({
//       userId: data.patientId,
//       role: "patient",
//       title,
//       message,
//     });

//     await sendEmail({
//       to: data.patientEmail,
//       subject: title,
//       html: `<p>${message}</p>`,
//     });
//   } catch (err) {
//     console.error(err);
//   }
// };

// exports.handleCertificateRejected = async (data) => {
//   try {
//     const title = "❌ Certificate Rejected";
//     const message = `Your certificate request has been rejected.`;

//     await createAppNotification({
//       userId: data.patientId,
//       role: "patient",
//       title,
//       message,
//     });

//     await sendEmail({
//       to: data.patientEmail,
//       subject: title,
//       html: `<p>${message}</p>`,
//     });
//   } catch (err) {
//     console.error(err);
//   }
// };

// exports.handleCertificateExpired = async (data) => {
//   try {
//     const title = "⚠️ Certificate Expired";
//     const message = `Your certificate (${data.certificateId}) has expired.`;

//     await createAppNotification({
//       userId: data.patientId,
//       role: "patient",
//       title,
//       message,
//     });

//     await sendEmail({
//       to: data.patientEmail,
//       subject: title,
//       html: `<p>${message}</p>`,
//     });
//   } catch (err) {
//     console.error(err);
//   }
// };

// exports.handleExpiryReminder = async (data) => {
//   try {
//     const title = "⏰ Certificate Expiry Reminder";
//     const message = `Your certificate (${data.certificateId}) will expire soon.`;

//     await createAppNotification({
//       userId: data.patientId,
//       role: "patient",
//       title,
//       message,
//     });

//     await sendEmail({
//       to: data.patientEmail,
//       subject: title,
//       html: `<p>${message}</p>`,
//     });
//   } catch (err) {
//     console.error(err);
//   }
// };



// handlers/certificate.handler.js
const { createAppNotification } = require("../utils/notification.db");
const { sendEmail } = require("../utils/email.service");

exports.handleCertificateApproved = async (data) => {
  try {
    const title = "🎉 Certificate Approved";
    const message = `Your certificate (${data.certificateId}) has been approved and is ready to download.`;

    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title,
      message,
    });

    await sendEmail({
      to: data.patientEmail,
      subject: title,
      html: `<p>${message}</p>`,
    });
  } catch (err) {
    console.error(err);
  }
};

exports.handleCertificateRejected = async (data) => {
  try {
    const title = "❌ Certificate Rejected";
    const message = `Your certificate request has been rejected.`;

    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title,
      message,
    });

    await sendEmail({
      to: data.patientEmail,
      subject: title,
      html: `<p>${message}</p>`,
    });
  } catch (err) {
    console.error(err);
  }
};

exports.handleCertificateExpired = async (data) => {
  try {
    const title = "⚠️ Certificate Expired";
    const message = `Your certificate (${data.certificateId}) has expired.`;

    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title,
      message,
    });

    await sendEmail({
      to: data.patientEmail,
      subject: title,
      html: `<p>${message}</p>`,
    });
  } catch (err) {
    console.error(err);
  }
};

exports.handleExpiryReminder = async (data) => {
  try {
    const title = "⏰ Certificate Expiry Reminder";
    const message = `Your certificate (${data.certificateId}) will expire soon.`;

    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title,
      message,
    });

    await sendEmail({
      to: data.patientEmail,
      subject: title,
      html: `<p>${message}</p>`,
    });
  } catch (err) {
    console.error(err);
  }
};