const EVENTS = require("../events/notification.events");
const eventBus = require("../events/eventBus");
const events = require("../events/notification.events");
const handlers = require("../notifications/notification.handler");
const certHandler = require("../notifications/certificate.handler");

const registerEvents = () => {
  // Appointment lifecycle
  eventBus.on(
    events.APPOINTMENT_REQUESTED,
    handlers.handleAppointmentRequested,
  );
  eventBus.on(
    events.APPOINTMENT_CONFIRMED,
    handlers.handleAppointmentConfirmed,
  );
  eventBus.on(events.APPOINTMENT_REJECTED, handlers.handleAppointmentRejected);
  eventBus.on(
    events.APPOINTMENT_CANCELLED_BY_PATIENT,
    handlers.handleAppointmentCancelledByPatient,
  );
  eventBus.on(
    events.APPOINTMENT_CANCELLED_BY_ADMIN,
    handlers.handleAppointmentCancelledByAdmin,
  );
  eventBus.on(
    events.APPOINTMENT_CANCELLED_BY_DOCTOR,
    handlers.handleAppointmentCancelledByDoctor,
  );

  eventBus.on(
    events.APPOINTMENT_COMPLETED,
    handlers.handleAppointmentCompleted,
  );

  // Reminders
  eventBus.on(events.APPOINTMENT_REMINDER, handlers.handleAppointmentReminder);

  // Doctor onboarding
  eventBus.on(events.DOCTOR_APPROVED, handlers.handleDoctorApproved);
  eventBus.on(events.DOCTOR_REJECTED, handlers.handleDoctorRejected);

  // Visit summary
  eventBus.on(events.VISIT_SUMMARY_ADDED, handlers.handleVisitSummaryAdded);

  // Visit summary

  eventBus.on(
    EVENTS.CERTIFICATE_APPROVED,
    certHandler.handleCertificateApproved,
  );
  eventBus.on(
    EVENTS.CERTIFICATE_REJECTED,
    certHandler.handleCertificateRejected,
  );
  eventBus.on(EVENTS.CERTIFICATE_EXPIRED, certHandler.handleCertificateExpired);
  eventBus.on(
    EVENTS.CERTIFICATE_EXPIRY_REMINDER,
    certHandler.handleExpiryReminder,
  );
  // console.log("✅ Event listeners registered");
};

module.exports = registerEvents;