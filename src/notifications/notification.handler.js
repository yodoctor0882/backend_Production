// exports.handleAppointmentRequested = (data) => {
//   console.log("Appointment requested", data);
// };

// exports.handleAppointmentConfirmed = (data) => {
//   console.log("Appointment confirmed", data);
// };

// exports.handleAppointmentRejected = (data) => {
//   console.log("Appointment rejected", data);
// };

// exports.handleAppointmentCancelledByPatient = (data) => {
//   console.log("Appointment cancelled by patient", data);
// };

// exports.handleAppointmentCancelledByAdmin = (data) => {
//   console.log("Appointment cancelled by admin", data);
// };

// exports.handleAppointmentCompleted = (data) => {
//   console.log("Appointment completed", data);
// };

// exports.handleAppointmentReminder = (data) => {
//   console.log("Appointment reminder", data);
// };

// exports.handleDoctorApproved = (data) => {
//   console.log("Doctor approved", data);
// };

// exports.handleDoctorRejected = (data) => {
//   console.log("Doctor rejected", data);
// };

// exports.handleVisitSummaryAdded = (data) => {
//   console.log("Visit summary added", data);
// };

const { createAppNotification } = require("../utils/notification.db");
const notifications = require("../utils/notification.messages");

const { sendEmail } = require("../utils/email.service");


// 📥 Appointment Requested
exports.handleAppointmentRequested = async (data) => {
  try {
    console.log("Appointment requested", data);

    const doctorData = notifications.APPOINTMENT_REQUESTED.doctor;

    await createAppNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
      appointmentId: data.appointmentId,
    });

    await sendEmail({
      to: data.doctorEmail,
      subject: doctorData.title,
      html: `<p>${doctorData.icon} ${doctorData.message}</p>`,
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

// ✅ Appointment Confirmed
exports.handleAppointmentConfirmed = async (data) => {
  try {
    console.log("Appointment confirmed", data);

    const patientData = notifications.APPOINTMENT_CONFIRMED.patient;
    const doctorData = notifications.APPOINTMENT_CONFIRMED.doctor;

    // Patient
    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title: patientData.title,
      message: patientData.message,
      appointmentId: data.appointmentId,
    });

    await sendEmail({
      to: data.patientEmail,
      subject: patientData.title,
      html: `<p>${patientData.icon} ${patientData.message}</p>`,
    });

    // Doctor
    await createAppNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
      appointmentId: data.appointmentId,
    });

    await sendEmail({
      to: data.doctorEmail,
      subject: doctorData.title,
      html: `<p>${doctorData.icon} ${doctorData.message}</p>`,
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

// ❌ Appointment Rejected
exports.handleAppointmentRejected = async (data) => {
  try {
    console.log("Appointment rejected", data);

    const patientData = notifications.APPOINTMENT_REJECTED.patient;

    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title: patientData.title,
      message: patientData.message,
      appointmentId: data.appointmentId,
    });

    await sendEmail({
      to: data.patientEmail,
      subject: patientData.title,
      html: `<p>${patientData.icon} ${patientData.message}</p>`,
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

// ⚠️ Cancelled by Patient
exports.handleAppointmentCancelledByPatient = async (data) => {
  try {
    console.log("Cancelled by patient", data);

    const doctorData = notifications.APPOINTMENT_CANCELLED_BY_PATIENT.doctor;

    await createAppNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
      appointmentId: data.appointmentId,
    });

    await sendEmail({
      to: data.doctorEmail,
      subject: doctorData.title,
      html: `<p>${doctorData.icon} ${doctorData.message}</p>`,
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

// ⚠️ Cancelled by Admin
exports.handleAppointmentCancelledByAdmin = async (data) => {
  try {
    console.log("Cancelled by admin", data);

    // You can customize message if needed
  } catch (err) {
    console.error("Error:", err);
  }
};

// ⚠️ Cancelled by Doctor

exports.handleAppointmentCancelledByDoctor = async (data) => {
  try {
    const notifications = require("./notification.messages");
    const { sendEmail } = require("./email.service");
    const { createAppNotification } = require("./notification.db");

    const title = "⚠️ Appointment Cancelled by Doctor";
    const message = `Your appointment was cancelled by the doctor. Reason: ${data.reason}`;

    // 🔔 DB notification
    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title,
      message,
      appointmentId: data.appointmentId,
    });

    // 📩 Email
    await sendEmail({
      to: data.patientEmail,
      subject: title,
      html: `<p>${message}</p>`,
    });

  } catch (err) {
    console.error("Error:", err);
  }
};

// 🎉 Completed
exports.handleAppointmentCompleted = async (data) => {
  try {
    console.log("Appointment completed", data);

    const patientData = notifications.APPOINTMENT_COMPLETED.patient;

    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title: patientData.title,
      message: patientData.message,
      appointmentId: data.appointmentId,
    });

    await sendEmail({
      to: data.patientEmail,
      subject: patientData.title,
      html: `<p>${patientData.icon} ${patientData.message}</p>`,
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

// ⏰ Reminder
exports.handleAppointmentReminder = async (data) => {
  try {
    console.log("Reminder", data);

    const patientData = notifications.APPOINTMENT_REMINDER.patient;

    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title: patientData.title,
      message: patientData.message,
      appointmentId: data.appointmentId,
    });

    await sendEmail({
      to: data.patientEmail,
      subject: patientData.title,
      html: `<p>${patientData.icon} ${patientData.message}</p>`,
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

// 🎉 Doctor Approved
exports.handleDoctorApproved = async (data) => {
  try {
    console.log("Doctor approved", data);

    const doctorData = notifications.DOCTOR_APPROVED.doctor;

    await createAppNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
    });

    await sendEmail({
      to: data.doctorEmail,
      subject: doctorData.title,
      html: `<p>${doctorData.icon} ${doctorData.message}</p>`,
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

// ❌ Doctor Rejected
exports.handleDoctorRejected = async (data) => {
  try {
    console.log("Doctor rejected", data);

    const doctorData = notifications.DOCTOR_REJECTED.doctor;

    await createAppNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
    });

    await sendEmail({
      to: data.doctorEmail,
      subject: doctorData.title,
      html: `<p>${doctorData.icon} ${doctorData.message}</p>`,
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

// 📝 Visit Summary
exports.handleVisitSummaryAdded = async (data) => {
  try {
    console.log("Visit summary added", data);
    // optional: add notification/email if needed
  } catch (err) {
    console.error("Error:", err);
  }
};