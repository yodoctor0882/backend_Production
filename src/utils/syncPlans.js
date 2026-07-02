const db = require("../config/db");
const {plans} = require("../plan_data/store");
const syncPlans = async () => {
  try {
    for (let index = 0; index < plans.length; index++) {
      const plan = plans[index];

      await db.execute(
        `
        INSERT INTO subscription_plans (
          id,
          name,
          slug,
          description,
          icon,
          monthly_price,
          yearly_price,
          yearly_total,
          currency,
          rzp_monthly_plan_id,
          rzp_yearly_plan_id,
          max_users,
          max_patients,
          is_recommended,
          is_active,
          sort_order
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)

        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          slug = VALUES(slug),
          description = VALUES(description),
          icon = VALUES(icon),
          monthly_price = VALUES(monthly_price),
          yearly_price = VALUES(yearly_price),
          yearly_total = VALUES(yearly_total),
          currency = VALUES(currency),
          rzp_monthly_plan_id = VALUES(rzp_monthly_plan_id),
          rzp_yearly_plan_id = VALUES(rzp_yearly_plan_id),
          max_users = VALUES(max_users),
          max_patients = VALUES(max_patients),
          is_recommended = VALUES(is_recommended),
          is_active = VALUES(is_active),
          sort_order = VALUES(sort_order)
        `,
        [
          plan.id,
          plan.name,
          plan.slug,
          plan.description || null,
          plan.icon || null,

          plan.monthlyPrice || 0,
          plan.yearlyPrice || 0,
          plan.totalPrice || 0,

          plan.currency || "INR",

          plan.razorpay?.monthly_plan_id || null,
          plan.razorpay?.yearly_plan_id || null,

          plan.maxUsers ?? 1,
          plan.maxPatients ?? 50,

          plan.recommended ? 1 : 0,
          1,
          index + 1,
        ]
      );
    }

    console.log("✅ Subscription plans synced");
  } catch (err) {
    console.error("❌ Plan sync failed:", err);
  }
};

module.exports = syncPlans;