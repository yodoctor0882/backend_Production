const { createAppNotification } = require("../utils/notification.db");
const notifications = require("../utils/notification.messages");

const { sendEmail } = require("../utils/email.service");
const {
  sendRealtimeNotification,
} = require("../services/realtimeNotification.service");


exports.handleDoctorRegistered = async (data) => {
  try {
    const adminData = notifications.DOCTOR_REGISTERED.admin;

    await createAppNotification({
      role: "admin",
      title: adminData.title,
      message: adminData.message.replace(
        "{doctorName}",
        data.doctorName
      ),
    });

    sendRealtimeNotification({
      role: "admin",
      title: adminData.title,
      message: adminData.message.replace(
        "{doctorName}",
        data.doctorName
      ),
      type: "notification",
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

exports.handleDoctorRegistrationSubmitted = async (data) => {
  try {
    const adminData =
      notifications.DOCTOR_REGISTRATION_SUBMITTED.admin;

    await createAppNotification({
      role: "admin",
      title: adminData.title,
      message: adminData.message.replace(
        "{doctorName}",
        data.doctorName
      ),
    });

    sendRealtimeNotification({
      role: "admin",
      title: adminData.title,
      message: adminData.message.replace(
        "{doctorName}",
        data.doctorName
      ),
      type: "notification",
    });

  } catch (err) {
    console.error(err);
  }
};


// 📥 Appointment Requested
exports.handleAppointmentRequested = async (data) => {
  try {
    const doctorData = notifications.APPOINTMENT_REQUESTED.doctor;

    await createAppNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
      appointmentId: data.appointmentId,
    });

    // Realtime first
    sendRealtimeNotification({
      userId: data.doctorId,
      title: doctorData.title,
      message: doctorData.message,
      type: "notification",
      data: {
        appointmentId: data.appointmentId,
      },
    });

    // Email should not block notification
    sendEmail({
      to: data.doctorEmail,
      subject: doctorData.title,
      html: `<p>${doctorData.icon} ${doctorData.message}</p>`,
    }).catch((err) => {
      console.error("[EMAIL ERROR]", err);
    });
  } catch (err) {
    console.error("[NOTIFICATION ERROR]", err);
  }
};

// ✅ Appointment Confirmed
exports.handleAppointmentConfirmed = async (data) => {
  try {
    console.log("[Notification] Appointment confirmed:", data);

    const patientData =
      notifications.APPOINTMENT_CONFIRMED.patient;

    const doctorData =
      notifications.APPOINTMENT_CONFIRMED.doctor;

    // ---------------- Patient notification ----------------

    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title: patientData.title,
      message: patientData.message,
      appointmentId: data.appointmentId,
    });

    sendRealtimeNotification({
      userId: data.patientId,
      role: "patient",
      title: patientData.title,
      message: patientData.message,
      type: "notification",
      data: {
        appointmentId: data.appointmentId,
      },
    });

    if (data.patientEmail) {
      sendEmail({
        to: data.patientEmail,
        subject: patientData.title,
        html: `<p>${patientData.icon || ""} ${patientData.message}</p>`,
      }).catch((error) => {
        console.error(
          "[EMAIL ERROR][PATIENT]",
          error.message,
        );
      });
    }

    // ---------------- Doctor notification ----------------

    await createAppNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
      appointmentId: data.appointmentId,
    });

    sendRealtimeNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
      type: "notification",
      data: {
        appointmentId: data.appointmentId,
      },
    });

    if (data.doctorEmail) {
      sendEmail({
        to: data.doctorEmail,
        subject: doctorData.title,
        html: `<p>${doctorData.icon || ""} ${doctorData.message}</p>`,
      }).catch((error) => {
        console.error(
          "[EMAIL ERROR][DOCTOR]",
          error.message,
        );
      });
    }

    console.log(
      `[Notification] Appointment ${data.appointmentId} notifications completed`,
    );
  } catch (error) {
    console.error(
      "[Notification Handler][Appointment Confirmed]",
      error,
    );
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

    sendRealtimeNotification({
      userId: data.patientId,
      role: "patient",
      title: patientData.title,
      message: patientData.message,
      type: "notification",
      data: {
        appointmentId: data.appointmentId,
      },
    });

    sendEmail({
      to: data.patientEmail,
      subject: patientData.title,
      html: `<p>${patientData.icon} ${patientData.message}</p>`,
    }).catch((err) => console.error("[EMAIL ERROR]", err));
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

    sendRealtimeNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
      type: "notification",
      data: {
        appointmentId: data.appointmentId,
      },
    });

    sendEmail({
      to: data.doctorEmail,
      subject: doctorData.title,
      html: `<p>${doctorData.icon} ${doctorData.message}</p>`,
    }).catch((err) => console.error("[EMAIL ERROR]", err));
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
    sendRealtimeNotification({
      userId: data.patientId,
      role: "patient",
      title,
      message,
      type: "notification",
      data: {
        appointmentId: data.appointmentId,
      },
    });

    sendEmail({
      to: data.patientEmail,
      subject: title,
      html: `<p>${message}</p>`,
    }).catch((err) => console.error("[EMAIL ERROR]", err));
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

    sendRealtimeNotification({
      userId: data.patientId,
      role: "patient",
      title: patientData.title,
      message: patientData.message,
      type: "notification",
      data: {
        appointmentId: data.appointmentId,
      },
    });

    sendEmail({
      to: data.patientEmail,
      subject: patientData.title,
      html: `<p>${patientData.icon} ${patientData.message}</p>`,
    }).catch((err) => {
      console.error("[EMAIL ERROR]", err);
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

    sendRealtimeNotification({
      userId: data.patientId,
      role: "patient",
      title: patientData.title,
      message: patientData.message,
      type: "notification",
      data: {
        appointmentId: data.appointmentId,
      },
    });

    sendEmail({
      to: data.patientEmail,
      subject: patientData.title,
      html: `<p>${patientData.icon} ${patientData.message}</p>`,
    }).catch((err) => {
      console.error("[EMAIL ERROR]", err);
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

    sendRealtimeNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
      type: "notification",
    });

    sendEmail({
      to: data.doctorEmail,
      subject: doctorData.title,
      html: `<p>${doctorData.icon} ${doctorData.message}</p>`,
    }).catch((err) => {
      console.error("[EMAIL ERROR]", err);
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

    sendRealtimeNotification({
      userId: data.doctorId,
      role: "doctor",
      title: doctorData.title,
      message: doctorData.message,
      type: "notification",
    });

    sendEmail({
      to: data.doctorEmail,
      subject: doctorData.title,
      html: `<p>${doctorData.icon} ${doctorData.message}</p>`,
    }).catch((err) => {
      console.error("[EMAIL ERROR]", err);
    });
  } catch (err) {
    console.error("Error:", err);
  }
};

// 📝 Visit Summary
exports.handleVisitSummaryAdded = async (data) => {
  try {
    await createAppNotification({
      userId: data.patientId,
      role: "patient",
      title: data.title,
      message: data.message,
      appointmentId: data.appointmentId,
    });

    sendRealtimeNotification({
      userId: data.patientId,
      role: "patient",
      title: data.title,
      message: data.message,
      type: "notification",
      data: {
        appointmentId: data.appointmentId,
      },
    });

    if (data.patientEmail) {
      sendEmail({
        to: data.patientEmail,
        subject: data.title,
        html: `<p>${data.message}</p>`,
      }).catch((err) => {
        console.error("[EMAIL ERROR]", err);
      });
    }
  } catch (err) {
    console.error("Error:", err);
  }
};
