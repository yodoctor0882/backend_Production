const eventBus = require("../src/events/eventBus");
const EVENTS = require("../src/events/notification.events");
const cron = require("node-cron");
const db = require("../src/config/db");

const expireCertificatesJob = () => {

  // 🔁 Common DB helper
  const runQuery = (query, callback) => {
    db.query(query, (err, results) => {
      if (err) {
        console.error("Cron DB Error:", err);
        return;
      }
      callback(results);
    });
  };

  // 🔁 Common event emitter
  const emitEvent = (eventType, row) => {
    eventBus.emit(eventType, {
      patientId: row.user_id,
      patientEmail: row.email,
      certificateId: row.certificate_id,
    });
  };

  // ✅ 1. EXPIRE CERTIFICATES
  cron.schedule("0 0 * * *", () => {
    console.log("Running Expiry Job...");

    const query = `
      SELECT id, certificate_id, user_id, email
      FROM certificate_requests
      WHERE expiry_date < NOW()
      AND status = 'Approved'
    `;

    runQuery(query, (results) => {
      results.forEach((row) => {
        db.query(
          `UPDATE certificate_requests SET status='Expired' WHERE id=?`,
          [row.id]
        );

        emitEvent(EVENTS.CERTIFICATE_EXPIRED, row);
      });

      console.log("Expire job done:", results.length);
    });
  });

  // ✅ 2. EXPIRY REMINDER
  cron.schedule("0 9 * * *", () => {
    console.log("Running Reminder Job...");

    const query = `
      SELECT id, certificate_id, user_id, email
      FROM certificate_requests
      WHERE DATE(expiry_date) = DATE_ADD(CURDATE(), INTERVAL 2 DAY)
      AND status = 'Approved'
    `;

    runQuery(query, (results) => {
      results.forEach((row) => {
        emitEvent(EVENTS.CERTIFICATE_EXPIRY_REMINDER, row);
      });

      console.log("Reminder job done:", results.length);
    });
  });

};

module.exports = expireCertificatesJob;