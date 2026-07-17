const eventBus = require("./eventBus");
const EVENTS = require("./notification.events");

const handlers = require("../notifications/notification.handler");
const certHandler = require("../notifications/certificate.handler");

let eventsRegistered = false;

const registerEvents = () => {
  if (eventsRegistered) {
    console.warn("[Events] Event listeners are already registered");
    return;
  }

  eventsRegistered = true;

  // Doctor registration
  eventBus.on(EVENTS.DOCTOR_REGISTERED, handlers.handleDoctorRegistered);

  eventBus.on(
    EVENTS.DOCTOR_REGISTRATION_SUBMITTED,
    handlers.handleDoctorRegistrationSubmitted,
  );

  // Appointment lifecycle
  eventBus.on(
    EVENTS.APPOINTMENT_REQUESTED,
    handlers.handleAppointmentRequested,
  );

  eventBus.on(
    EVENTS.APPOINTMENT_CONFIRMED,
    handlers.handleAppointmentConfirmed,
  );

  eventBus.on(EVENTS.APPOINTMENT_REJECTED, handlers.handleAppointmentRejected);

  eventBus.on(
    EVENTS.APPOINTMENT_CANCELLED_BY_PATIENT,
    handlers.handleAppointmentCancelledByPatient,
  );

  eventBus.on(
    EVENTS.APPOINTMENT_CANCELLED_BY_ADMIN,
    handlers.handleAppointmentCancelledByAdmin,
  );

  eventBus.on(
    EVENTS.APPOINTMENT_CANCELLED_BY_DOCTOR,
    handlers.handleAppointmentCancelledByDoctor,
  );

  eventBus.on(
    EVENTS.APPOINTMENT_COMPLETED,
    handlers.handleAppointmentCompleted,
  );

  // Appointment reminder
  eventBus.on(EVENTS.APPOINTMENT_REMINDER, handlers.handleAppointmentReminder);

  // Doctor onboarding
  eventBus.on(EVENTS.DOCTOR_APPROVED, handlers.handleDoctorApproved);

  eventBus.on(EVENTS.DOCTOR_REJECTED, handlers.handleDoctorRejected);

  // Visit summary
  eventBus.on(EVENTS.VISIT_SUMMARY_ADDED, handlers.handleVisitSummaryAdded);

  // Certificate lifecycle
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

  console.log("✅ Application event listeners registered");
};

module.exports = registerEvents;
