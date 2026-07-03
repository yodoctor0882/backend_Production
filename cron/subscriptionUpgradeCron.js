const cron = require("node-cron");
const db = require("../src/config/db");
const plans = require("../src/plan_data/store");

const getPlanDurationMonths = (planId) => {
  const plan = plans.find((p) => p.id === planId);

  if (!plan) return 1;

  if (plan.id === "plan_trial") {
    return 1.5;
  }

  return plan.months || 1;
};

const activateScheduledUpgrades = async () => {
  try {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE upgrade_status = 'scheduled'
      AND scheduled_activation_date IS NOT NULL
      AND scheduled_activation_date <= NOW()
      `,
    );

    for (const sub of rows) {
      const startDate = new Date(sub.scheduled_activation_date);

      const nextBillingDate = new Date(startDate);
      nextBillingDate.setMonth(
        nextBillingDate.getMonth() +
          getPlanDurationMonths(sub.scheduled_plan_id),
      );

      await db.execute(
        `
        UPDATE subscriptions
        SET
          plan_id = ?,
          plan_name = ?,
          amount = ?,

        current_period_start = ?,
          current_period_end = ?,
          next_billing_date = ?,

          scheduled_plan_id = NULL,
          scheduled_plan_name = NULL,
          scheduled_amount = NULL,
          scheduled_activation_date = NULL,

          upgrade_status = 'none',
          updated_at = NOW()

        WHERE id = ?
        `,
        [
          sub.scheduled_plan_id,
          sub.scheduled_plan_name,
          sub.scheduled_amount,

          startDate,
          nextBillingDate,
          nextBillingDate,

          sub.id,
        ],
      );

      console.log(
        `[UPGRADE ACTIVATED] ${sub.id} -> ${sub.scheduled_plan_name}`,
      );
    }
  } catch (err) {
    console.error("[activateScheduledUpgrades]", err);
  }
};

// Every 15 minutes
cron.schedule("*/15 * * * *", async () => {
  console.log("[CRON] Checking scheduled upgrades...");

  await activateScheduledUpgrades();
});

module.exports = {
  activateScheduledUpgrades,
};
