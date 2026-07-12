const eventBus = require("../src/events/eventBus");
const EVENTS = require("../src/events/notification.events");
const cron = require("node-cron");
const db = require("../src/config/db");

const expireCertificatesJob = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("[CRON] Running certificate expiry job...");

    try {
      const [rows] = await db.query(`
        SELECT id, certificate_id, user_id, email
        FROM certificate_requests
        WHERE expiry_date < NOW()
        AND status = 'Approved'
      `);

      if (rows.length === 0) {
        console.log("[CRON] No certificates found for expiry.");
        return;
      }

      const ids = rows.map((row) => row.id);

      const placeholders = ids.map(() => "?").join(",");

      await db.query(
        `
        UPDATE certificate_requests
        SET status = 'Expired'
        WHERE id IN (${placeholders})
        `,
        ids
      );

      for (const row of rows) {
        eventBus.emit(EVENTS.CERTIFICATE_EXPIRED, {
          patientId: row.user_id,
          patientEmail: row.email,
          certificateId: row.certificate_id,
        });
      }

      console.log(`[CRON] Expire job done: ${rows.length}`);
    } catch (error) {
      console.error("[CRON] Certificate expiry job failed:", error);
    }
  });

  cron.schedule("0 9 * * *", async () => {
    console.log("[CRON] Running certificate reminder job...");

    try {
      const [rows] = await db.query(`
        SELECT id, certificate_id, user_id, email
        FROM certificate_requests
        WHERE DATE(expiry_date) = DATE_ADD(CURDATE(), INTERVAL 2 DAY)
        AND status = 'Approved'
      `);

      for (const row of rows) {
        eventBus.emit(EVENTS.CERTIFICATE_EXPIRY_REMINDER, {
          patientId: row.user_id,
          patientEmail: row.email,
          certificateId: row.certificate_id,
        });
      }

      console.log(`[CRON] Reminder job done: ${rows.length}`);
    } catch (error) {
      console.error("[CRON] Certificate reminder job failed:", error);
    }
  });
};

module.exports = expireCertificatesJob;