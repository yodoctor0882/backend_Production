const { v4: uuidv4 } = require("uuid");
const { plans } = require("../plan_data/store");
const db = require("../config/db");

const {
  success,
  created,
  badRequest,
  notFound,
  error,
} = require("../utils/response");

const {
  razorpay,
  verifyWebhookSignature,
  verifySubscriptionSignature,
  verifyPaymentSignature,
} = require("../utils/razorpay");

// const processedWebhookEvents = new Set();

// ------------------------ billingController --------------------------

const getBillingHistory = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    );

    const offset = (page - 1) * limit;
    const userId = req.user?.id;

    if (!userId) {
      return error(res, "Unauthorized", 401);
    }

    const [countRows] = await db.execute(
      `
      SELECT COUNT(*) AS total
      FROM invoices
      WHERE user_id = ?
      `,
      [userId],
    );

    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.query(
      `
      SELECT
        id,
        payment_id,
        subscription_id,
        plan_name,
        billing_cycle,
        amount,
        currency,
        status,
        period_start,
        period_end,
        paid_at,
        created_at
      FROM invoices
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
      `,
      [userId],
    );

    return success(
      res,
      {
        invoices: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      "Billing history fetched",
    );
  } catch (err) {
    console.error("[getBillingHistory]", {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });

    return error(res, "Failed to fetch billing history", 500);
  }
};

const getInvoice = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM invoices
      WHERE user_id = ?
      AND id = ?
      LIMIT 1
      `,
      [req.user.id, req.params.invoiceId],
    );

    if (!rows.length) {
      return notFound(res, "Invoice not found");
    }

    return success(
      res,
      {
        invoice: rows[0],
      },
      "Invoice fetched successfully",
    );
  } catch (err) {
    console.error("[getInvoice]", err);

    return error(res, "Failed to fetch invoice", 500);
  }
};

// -------------------- PlansControllers -----------------------------------

const getAllPlans = (req, res) => {
  const billing = req.query.billing || "monthly";

  const formatted = plans.map((p) => ({
    id: p.id,

    title: p.name,
    name: p.name,

    slug: p.slug,

    description: p.description,

    icon: p.icon,

    category: p.category,

    months: p.months,

    originalPrice: p.originalPrice || 0,

    price:
      billing === "yearly" ? (p.yearlyPrice ?? p.monthlyPrice) : p.monthlyPrice,

    totalPrice:
      billing === "yearly"
        ? (p.totalPrice ?? p.yearlyTotal)
        : (p.totalPrice ?? p.monthlyPrice),

    monthlyPrice: p.monthlyPrice,

    yearlyPrice: p.yearlyPrice,

    yearlyTotal: p.yearlyTotal,

    currency: p.currency,

    recommended: p.recommended,

    freeText: p.freeText,

    subtitle: p.subtitle,

    buttonText: p.buttonText,

    discount: p.discount,

    gradient: p.gradient,

    circleColor: p.circleColor,

    features: p.features,

    limits: {
      maxUsers: p.maxUsers,
      maxPatients: p.maxPatients,
    },
  }));

  return success(
    res,
    { plans: formatted, billing },
    "Plans fetched successfully",
  );
};

const getPlanById = (req, res) => {
  const { planId } = req.params;
  const plan = plans.find((p) => p.id === planId || p.slug === planId);

  if (!plan) return notFound(res, "Plan not found");
  return success(res, { plan }, "Plan fetched successfully");
};

// --------------------------- subscriptionsController --------------------------

const findPlan = (planId) =>
  plans.find((p) => p.id === planId || p.slug === planId);

const getPlanDurationMonths = (planId) => {
  const plan = plans.find((p) => p.id === planId);

  if (!plan) return 1;

  // trial plan
  if (plan.id === "plan_trial") {
    return 1.5;
  }

  if (plan.months) {
    return plan.months;
  }

  return 1;
};

const nextBillingDate = (planId) => {
  const plan = plans.find((p) => p.id === planId);

  const d = new Date();

  if (plan?.id === "plan_trial") {
    d.setDate(d.getDate() + 45);
    return d;
  }

  const months = getPlanDurationMonths(planId);

  d.setMonth(d.getMonth() + months);

  return d;
};

const createSubscription = async (req, res) => {
  try {
    const { planId, billing = "monthly", isUpgrade = false } = req.body;

    if (!planId) {
      return badRequest(res, "planId is required");
    }

    const plan = findPlan(planId);

    if (!plan) {
      return notFound(res, "Plan not found");
    }

    // ================= EXISTING ACTIVE/PENDING CHECK =================

    const [existing] = await db.execute(
      `
      SELECT id
      FROM subscriptions
      WHERE user_id = ?
      AND (
        status = 'active'
        OR (
          status = 'pending'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        )
      )
      LIMIT 1
      `,
      [req.user.id],
    );

    if (!isUpgrade && existing.length) {
      return badRequest(
        res,
        "User already has an active or pending subscription",
      );
    }

    if (isUpgrade) {
      const [activeRows] = await db.execute(
        `
    SELECT *
    FROM subscriptions
    WHERE user_id = ?
    AND status = 'active'
    LIMIT 1
    `,
        [req.user.id],
      );

      const activeSub = activeRows[0];

      if (activeSub?.upgrade_status === "scheduled") {
        return badRequest(
          res,
          "You already have a pending upgrade. Please wait until it becomes active.",
        );
      }
    }

    // ================= FREE TRIAL =================

    if (plan.id === "plan_trial") {
      const localSubId = `sub_${uuidv4().replace(/-/g, "").slice(0, 12)}`;

      const now = new Date();

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 45);

      await db.execute(
        `
        INSERT INTO subscriptions(
          id,
          user_id,
          plan_id,
          plan_name,
          status,
          billing_cycle,
          amount,
          currency,
          rzp_subscription_id,
          start_date,
          current_period_start,
          current_period_end,
          next_billing_date
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
        `,
        [
          localSubId,
          req.user.id,
          plan.id,
          plan.name,
          "active",
          "monthly",
          0,
          "INR",
          null,
          now,
          now,
          expiry,
          expiry,
        ],
      );

      return created(
        res,
        {
          trial: true,
          local_subscription_id: localSubId,
        },
        "45 Days Trial Activated",
      );
    }

    // ================= PLAN CONFIG =================

    const isYearly = billing === "yearly";

    const rzpPlanId = isYearly
      ? plan.razorpay?.yearly_plan_id
      : plan.razorpay?.monthly_plan_id;

    if (!rzpPlanId) {
      return error(res, "Razorpay plan configuration missing", 500);
    }

    const subscriptionAmount =
      plan.totalPrice || plan.yearlyPrice || plan.monthlyPrice;

    // ================= CREATE RAZORPAY SUB =================

    let rzpSubscription;

    try {
      rzpSubscription = await razorpay.subscriptions.create({
        plan_id: rzpPlanId,
        customer_notify: 1,
        quantity: 1,
        total_count: 12,
        notes: {
          userId: req.user.id,
          planId: plan.id,
          planName: plan.name,
          billing,
          isUpgrade: isUpgrade ? "1" : "0",
        },
      });
    } catch (rzpErr) {
      console.error("[Razorpay Subscription Create Error]", rzpErr);

      if (process.env.NODE_ENV === "production") {
        return error(res, "Failed to create Razorpay subscription", 500);
      }

      rzpSubscription = {
        id: `sub_mock_${uuidv4().replace(/-/g, "").slice(0, 14)}`,
        status: "created",
      };
    }

    // ================= SAVE DB =================

    const localSubId = `sub_${uuidv4().replace(/-/g, "").slice(0, 12)}`;

    await db.execute(
      `
      INSERT INTO subscriptions(
        id,
        user_id,
        plan_id,
        plan_name,
        billing_cycle,
        amount,
        currency,
        status,
        rzp_subscription_id
      )
      VALUES(?,?,?,?,?,?,?,?,?)
      `,
      [
        localSubId,
        req.user.id,
        plan.id,
        plan.name,
        billing,
        subscriptionAmount,
        plan.currency || "INR",
        "pending",
        rzpSubscription.id,
      ],
    );

    return created(
      res,
      {
        subscription_id: rzpSubscription.id,
        local_subscription_id: localSubId,

        razorpay_key: process.env.RAZORPAY_KEY_ID,

        plan: {
          id: plan.id,
          name: plan.name,
          amount: subscriptionAmount,
          currency: plan.currency,
          billing,
        },

        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone,
        },
      },
      "Subscription created successfully",
    );
  } catch (err) {
    console.error("[createSubscription]", err);

    return error(res, "Failed to create subscription", 500);
  }
};

const verifySubscription = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
      local_subscription_id,
    } = req.body;

    if (
      !razorpay_payment_id ||
      !razorpay_subscription_id ||
      !razorpay_signature
    ) {
      return badRequest(
        res,
        "razorpay_payment_id, razorpay_subscription_id and razorpay_signature are required",
      );
    }

    const isValid = verifySubscriptionSignature(
      razorpay_subscription_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      return badRequest(res, "Invalid payment signature");
    }

    // ================= FIND SUBSCRIPTION =================

    let rows;

    if (local_subscription_id) {
      [rows] = await connection.execute(
        `
        SELECT *
        FROM subscriptions
        WHERE id = ?
        AND user_id = ?
        LIMIT 1
        `,
        [local_subscription_id, req.user.id],
      );
    } else {
      [rows] = await connection.execute(
        `
        SELECT *
        FROM subscriptions
        WHERE rzp_subscription_id = ?
        AND user_id = ?
        LIMIT 1
        `,
        [razorpay_subscription_id, req.user.id],
      );
    }

    const sub = rows[0];

    if (!sub) {
      return notFound(res, "Subscription not found");
    }

    if (sub.status === "active") {
      return success(
        res,
        {
          subscription: sub,
        },
        "Subscription already verified",
      );
    }

    // ================= DUPLICATE PAYMENT CHECK =================

    const [existingPayment] = await connection.execute(
      `
      SELECT id
      FROM payments
      WHERE rzp_payment_id = ?
      LIMIT 1
      `,
      [razorpay_payment_id],
    );

    if (existingPayment.length) {
      return success(res, {}, "Payment already verified");
    }

    const now = new Date();
    const nextDate = nextBillingDate(sub.plan_id);

    const paymentDbId = `PAY-${Date.now()}`;
    const invoiceId = `INV-${Date.now()}`;

    await connection.beginTransaction();

    // ================= PAYMENT RECORD =================

    await connection.execute(
      `
      INSERT INTO payments(
        id,
        user_id,
        subscription_id,
        rzp_payment_id,
        rzp_subscription_id,
        amount,
        currency,
        status,
        razorpay_signature,
        signature_verified,
        source,
        captured_at
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        paymentDbId,
        sub.user_id,
        sub.id,
        razorpay_payment_id,
        razorpay_subscription_id,
        sub.amount,
        sub.currency,
        "captured",
        razorpay_signature,
        1,
        "checkout",
        now,
      ],
    );

    // ================= UPGRADE FLOW =================

    const [activeRows] = await connection.execute(
      `
  SELECT *
  FROM subscriptions
  WHERE user_id = ?
  AND status = 'active'
  LIMIT 1
  `,
      [sub.user_id],
    );

    const activeSub = activeRows[0];

    const isUpgrade = activeSub && activeSub.id !== sub.id;

    if (isUpgrade) {
      await connection.execute(
        `
    INSERT INTO subscription_upgrade_history(
      id,
      subscription_id,
      user_id,
      from_plan_id,
      to_plan_id,
      from_plan_name,
      to_plan_name,
      from_amount,
      to_amount,
      from_billing_cycle,
      to_billing_cycle,
      change_type,
      effective_from,
      notes,
      created_by
    )
    VALUES(
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
    `,
        [
          uuidv4(),
          activeSub.id,
          activeSub.user_id,
          activeSub.plan_id,
          sub.plan_id,
          activeSub.plan_name,
          sub.plan_name,
          activeSub.amount,
          sub.amount,
          activeSub.billing_cycle,
          sub.billing_cycle,
          "upgrade",
          activeSub.current_period_end,
          `Upgrade scheduled from ${activeSub.plan_name} to ${sub.plan_name}`,
          "user",
        ],
      );

      await connection.execute(
        `
    UPDATE subscriptions
    SET
      scheduled_plan_id = ?,
      scheduled_plan_name = ?,
      scheduled_amount = ?,
      scheduled_activation_date = current_period_end,
      upgrade_status = 'scheduled',
      updated_at = NOW()
    WHERE id = ?
    `,
        [sub.plan_id, sub.plan_name, sub.amount, activeSub.id],
      );

      await connection.execute(
        `
    UPDATE subscriptions
    SET
      status = 'cancelled',
      updated_at = NOW()
    WHERE id = ?
    `,
        [sub.id],
      );

      // upgrade invoice bhi create karni chahiye
      await connection.execute(
        `
    INSERT INTO invoices(
      id,
      user_id,
      subscription_id,
      payment_id,
      plan_name,
      billing_cycle,
      amount,
      currency,
      status,
      period_start,
      period_end,
      paid_at,
      source
    )
    VALUES(
      ?,?,?,?,?,?,?,?,?,?,?,?,?
    )
    `,
        [
          invoiceId,
          sub.user_id,
          activeSub.id,
          paymentDbId,
          sub.plan_name,
          sub.billing_cycle,
          sub.amount,
          sub.currency,
          "paid",
          now,
          activeSub.current_period_end,
          now,
          "checkout",
        ],
      );

      await connection.commit();

      return success(
        res,
        {
          subscription: activeSub,
          payment_id: paymentDbId,
          invoice_id: invoiceId,
        },
        "Upgrade scheduled successfully",
      );
    }

    // ================= ACTIVATE SUBSCRIPTION =================

    await connection.execute(
      `
      UPDATE subscriptions
      SET
        status = 'active',
        start_date = ?,
        current_period_start = ?,
        current_period_end = ?,
        next_billing_date = ?,
        last_payment_id = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [now, now, nextDate, nextDate, paymentDbId, sub.id],
    );

    // ================= CREATE INVOICE =================

    await connection.execute(
      `
      INSERT INTO invoices(
        id,
        user_id,
        subscription_id,
        payment_id,
        plan_name,
        billing_cycle,
        amount,
        currency,
        status,
        period_start,
        period_end,
        paid_at,
        source
      )
      VALUES(
        ?,?,?,?,?,?,?,?,?,?,?,?,?
      )
      `,
      [
        invoiceId,
        sub.user_id,
        sub.id,
        paymentDbId,
        sub.plan_name,
        sub.billing_cycle,
        sub.amount,
        sub.currency,
        "paid",
        now,
        nextDate,
        now,
        "checkout",
      ],
    );

    await connection.commit();

    const [updatedRows] = await connection.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE id = ?
      LIMIT 1
      `,
      [sub.id],
    );

    return success(
      res,
      {
        subscription: updatedRows[0],
        invoice_id: invoiceId,
        payment_id: paymentDbId,
      },
      "Subscription activated successfully",
    );
  } catch (err) {
    await connection.rollback();

    console.error("[verifySubscription]", err);

    return error(res, "Verification failed", 500);
  } finally {
    connection.release();
  }
};

const getActiveSubscription = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
SELECT *
FROM subscriptions
WHERE user_id = ?
AND status = 'active'
ORDER BY current_period_end DESC
LIMIT 1
  `,
      [req.user.id],
    );

    if (!rows.length) {
      return success(
        res,
        {
          hasSubscription: false,
          subscription: null,
        },
        "No active subscription",
      );
    }

    return success(
      res,
      {
        hasSubscription: true,
        subscription: rows[0],
      },
      "Active subscription fetched",
    );
  } catch (err) {
    console.error("[getActiveSubscription]", err);

    return error(res, "Failed to fetch active subscription", 500);
  }
};

const getAllSubscriptions = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [req.user.id],
    );

    return success(
      res,
      {
        subscriptions: rows,
        total: rows.length,
      },
      "Subscriptions fetched successfully",
    );
  } catch (err) {
    console.error("[getAllSubscriptions]", err);

    return error(res, "Failed to fetch subscriptions", 500);
  }
};

const getSubscriptionById = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE id = ?
      AND user_id = ?
      LIMIT 1
      `,
      [req.params.id, req.user.id],
    );

    if (!rows.length) {
      return notFound(res, "Subscription not found");
    }

    return success(
      res,
      {
        subscription: rows[0],
      },
      "Subscription fetched successfully",
    );
  } catch (err) {
    console.error("[getSubscriptionById]", err);

    return error(res, "Failed to fetch subscription", 500);
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE id = ?
      AND user_id = ?
      LIMIT 1
      `,
      [req.params.id, req.user.id],
    );

    if (!rows.length) {
      return notFound(res, "Subscription not found");
    }

    const sub = rows[0];

    if (sub.status === "cancelled") {
      return badRequest(res, "Subscription already cancelled");
    }

    const { cancel_at_period_end = true } = req.body;

    // ================= RAZORPAY CANCEL =================

    try {
      if (
        sub.rzp_subscription_id &&
        !sub.rzp_subscription_id.startsWith("sub_mock")
      ) {
        await razorpay.subscriptions.cancel(
          sub.rzp_subscription_id,
          cancel_at_period_end,
        );
      }
    } catch (e) {
      console.error("[Razorpay Cancel Error]", e.message);
    }

    // ================= DB UPDATE =================

    if (cancel_at_period_end) {
      await db.execute(
        `
        UPDATE subscriptions
        SET
          cancel_at_period_end = 1,
          cancelled_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
        `,
        [sub.id],
      );
    } else {
      await db.execute(
        `
        UPDATE subscriptions
        SET
          status = 'cancelled',
          cancel_at_period_end = 0,
          cancelled_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
        `,
        [sub.id],
      );
    }

    const [updatedRows] = await db.execute(
      `
        SELECT *
        FROM subscriptions
        WHERE id = ?
        LIMIT 1
        `,
      [sub.id],
    );

    return success(
      res,
      {
        subscription: updatedRows[0],
      },
      cancel_at_period_end
        ? "Subscription will be cancelled at period end"
        : "Subscription cancelled immediately",
    );
  } catch (err) {
    console.error("[cancelSubscription]", err);

    return error(res, "Failed to cancel subscription", 500);
  }
};

const upgradeSubscription = async (req, res) => {
  try {
    const { newPlanId } = req.body;

    if (!newPlanId) {
      return badRequest(res, "newPlanId is required");
    }

    const [rows] = await db.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE id = ?
      AND user_id = ?
      LIMIT 1
      `,
      [req.params.id, req.user.id],
    );

    if (!rows.length) {
      return notFound(res, "Subscription not found");
    }

    const sub = rows[0];

    const newPlan = findPlan(newPlanId);

    if (!newPlan) {
      return notFound(res, "New plan not found");
    }

    if (sub.plan_id === newPlan.id) {
      return badRequest(res, "Already on this plan");
    }

    if (
      sub.upgrade_status === "scheduled" &&
      sub.scheduled_plan_id === newPlan.id
    ) {
      return badRequest(res, "This upgrade is already scheduled");
    }

    if (sub.upgrade_status === "scheduled") {
      return badRequest(
        res,
        "You already have a pending upgrade. Please wait until it becomes active.",
      );
    }

    const newAmount =
      sub.billing_cycle === "yearly"
        ? newPlan.totalPrice || newPlan.yearlyPrice || 0
        : newPlan.totalPrice || newPlan.monthlyPrice || 0;

    await db.execute(
      `
  UPDATE subscriptions
  SET
    scheduled_plan_id = ?,
    scheduled_plan_name = ?,
    scheduled_amount = ?,
    scheduled_activation_date = current_period_end,
    upgrade_status = 'scheduled',
    updated_at = NOW()
  WHERE id = ?
  `,
      [newPlan.id, newPlan.name, newAmount, sub.id],
    );

    const [updatedRows] = await db.execute(
      `
        SELECT *
        FROM subscriptions
        WHERE id = ?
        LIMIT 1
        `,
      [sub.id],
    );

    return success(
      res,
      {
        subscription: updatedRows[0],
      },
      `${newPlan.name} plan has been scheduled and will activate when your current plan expires`,
    );
  } catch (err) {
    console.error("[upgradeSubscription]", err);

    return error(res, "Failed to upgrade subscription", 500);
  }
};

// ----------------------------------- usersController ----------------------------------

const getMe = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE user_id = ?
      AND status = 'active'
      LIMIT 1
      `,
      [req.user.id],
    );

    return success(
      res,
      {
        user: req.user,
        activeSubscription: rows.length > 0 ? rows[0] : null,
      },
      "Profile fetched successfully",
    );
  } catch (err) {
    console.error("[getMe]", err);

    return error(res, "Failed to fetch profile", 500);
  }
};

const updateMe = async (req, res) => {
  try {
    const { name, phone } = req.body;

    await db.execute(
      `
      UPDATE users
      SET
        name = ?,
        phone = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [name ?? req.user.name, phone ?? req.user.phone, req.user.id],
    );

    const [rows] = await db.execute(
      `
      SELECT *
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [req.user.id],
    );

    return success(res, { user: rows[0] }, "Profile updated");
  } catch (err) {
    console.error("[updateMe]", err);
    return error(res, "Failed to update profile", 500);
  }
};

const getDashboard = async (req, res) => {
  try {
    // ================= ACTIVE SUB =================

    const [subRows] = await db.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE user_id = ?
      AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [req.user.id],
    );

    const activeSubscription = subRows.length > 0 ? subRows[0] : null;

    // ================= TOTAL INVOICES =================

    const [invoiceCountRows] = await db.execute(
      `
        SELECT COUNT(*) AS totalInvoices
        FROM invoices
        WHERE user_id = ?
        `,
      [req.user.id],
    );

    const totalInvoices = invoiceCountRows[0]?.totalInvoices || 0;

    // ================= TOTAL SPENT =================

    const [spentRows] = await db.execute(
      `
        SELECT
          COALESCE(
            SUM(amount),
            0
          ) AS totalSpent
        FROM invoices
        WHERE user_id = ?
        AND status = 'paid'
        `,
      [req.user.id],
    );

    const totalSpent = spentRows[0]?.totalSpent || 0;

    // ================= RECENT INVOICES =================

    const [recentInvoices] = await db.execute(
      `
        SELECT
          id,
          payment_id,
          plan_name,
          billing_cycle,
          amount,
          currency,
          status,
          paid_at,
          created_at
        FROM invoices
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 5
        `,
      [req.user.id],
    );

    return success(
      res,
      {
        user: req.user,

        activeSubscription,

        stats: {
          totalInvoices,
          totalSpent,
          currency: "INR",
        },

        recentInvoices,
      },
      "Dashboard data fetched",
    );
  } catch (err) {
    console.error("[getDashboard]", err);

    return error(res, "Failed to fetch dashboard", 500);
  }
};

// ---------------------------------- paymentsController ---------------------------

const createOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", notes = {} } = req.body;
    if (!amount || amount <= 0)
      return badRequest(res, "Valid amount is required");

    let order;
    try {
      order = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency,
        receipt: `rcpt_${uuidv4().slice(0, 12)}`,
        notes: { ...notes, userId: req.user.id },
      });
    } catch (e) {
      console.warn("[createOrder] mock mode:", e.message);
      order = {
        id: `order_mock_${uuidv4().replace(/-/g, "").slice(0, 14)}`,
        amount: Math.round(amount * 100),
        currency,
        status: "created",
      };
    }

    return created(
      res,
      {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpay_key: process.env.RAZORPAY_KEY_ID,
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone,
        },
      },
      "Order created",
    );
  } catch (err) {
    console.error("[createOrder]", err);
    return error(res, "Failed to create order");
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      local_subscription_id,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return badRequest(res, "order_id, payment_id and signature are required");
    }

    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      return badRequest(res, "Invalid payment signature");
    }

    // ================= DUPLICATE CHECK =================

    const [existing] = await db.execute(
      `
      SELECT *
      FROM payments
      WHERE rzp_payment_id = ?
      LIMIT 1
      `,
      [razorpay_payment_id],
    );

    if (existing.length) {
      return success(
        res,
        {
          payment: existing[0],
        },
        "Payment already verified",
      );
    }

    // ================= FETCH PAYMENT =================

    let paymentDetails;

    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (e) {
      console.error("[Payment Fetch Error]", e);

      paymentDetails = {
        id: razorpay_payment_id,
        amount: 0,
        currency: "INR",
        method: "unknown",
        status: "captured",
      };
    }

    // ================= FIND SUBSCRIPTION =================

    let subscriptionId = null;
    let rzpSubscriptionId = null;

    if (local_subscription_id) {
      const [subs] = await db.execute(
        `
        SELECT *
        FROM subscriptions
        WHERE id = ?
        LIMIT 1
        `,
        [local_subscription_id],
      );

      if (subs.length) {
        subscriptionId = subs[0].id;
        rzpSubscriptionId = subs[0].rzp_subscription_id;
      }
    }

    // ================= INSERT PAYMENT =================

    const paymentId = `pay_${Date.now()}`;

    await db.execute(
      `
  INSERT INTO payments(
    id,
    user_id,
    subscription_id,
    rzp_payment_id,
    rzp_order_id,
    rzp_subscription_id,
    amount,
    currency,
    method,
    status,
    razorpay_signature,
    source,
    captured_at,
    signature_verified
  )
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        paymentId,
        req.user.id,
        subscriptionId,
        razorpay_payment_id,
        razorpay_order_id,
        rzpSubscriptionId,
        paymentDetails.amount || 0,
        paymentDetails.currency || "INR",
        paymentDetails.method || "unknown",
        "captured",
        razorpay_signature,
        "checkout",
        new Date(),
        1,
      ],
    );

    return success(
      res,
      {
        payment: {
          id: paymentId,
          razorpay_payment_id,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          method: paymentDetails.method,
          status: "captured",
        },
      },
      "Payment verified successfully",
    );
  } catch (err) {
    console.error("[verifyPayment]", err);

    return error(res, "Payment verification failed", 500);
  }
};

const getPayment = async (req, res) => {
  try {
    const paymentId = req.params.paymentId;

    // ================= DB =================

    const [rows] = await db.execute(
      `
      SELECT *
      FROM payments
      WHERE id = ?
      OR rzp_payment_id = ?
      LIMIT 1
      `,
      [paymentId, paymentId],
    );

    if (rows.length) {
      return success(
        res,
        {
          payment: rows[0],
        },
        "Payment fetched successfully",
      );
    }

    // ================= RAZORPAY FALLBACK =================

    try {
      const rzpPayment = await razorpay.payments.fetch(paymentId);

      return success(
        res,
        {
          payment: rzpPayment,
        },
        "Payment fetched from Razorpay",
      );
    } catch {
      return notFound(res, "Payment not found");
    }
  } catch (err) {
    console.error("[getPayment]", err);

    return error(res, "Failed to fetch payment", 500);
  }
};

// -------------------------------- webhooksController ----------------------------

const addBillingCycle = (planId) => {
  const plan = plans.find((p) => p.id === planId);

  const d = new Date();

  if (plan?.id === "plan_trial") {
    d.setDate(d.getDate() + 45);
    return d;
  }

  const months = getPlanDurationMonths(planId);

  d.setMonth(d.getMonth() + months);

  return d;
};

const razorpayWebhook = async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!signature) {
    return badRequest(res, "Missing Razorpay signature");
  }

  if (!verifyWebhookSignature(req.body, signature)) {
    return badRequest(res, "Invalid signature");
  }

  let event;

  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON body",
    });
  }

  const payload = event.payload;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    switch (event.event) {
      // =========================
      // SUBSCRIPTION ACTIVATED
      // =========================

      case "subscription.activated": {
        const rzpSubId = payload.subscription?.entity?.id;

        if (rzpSubId) {
          await connection.execute(
            `
            UPDATE subscriptions
            SET
              status='active',
              updated_at=NOW()
            WHERE rzp_subscription_id=?
            `,
            [rzpSubId],
          );
        }

        break;
      }

      // =========================
      // SUBSCRIPTION CHARGED
      // =========================

      case "subscription.charged": {
        const rzpSubId = payload.subscription?.entity?.id;

        const payment = payload.payment?.entity;

        if (!rzpSubId || !payment) break;

        const [subs] = await connection.execute(
          `
            SELECT *
            FROM subscriptions
            WHERE rzp_subscription_id=?
            LIMIT 1
            `,
          [rzpSubId],
        );

        if (!subs.length) break;

        const sub = subs[0];

        const now = new Date();

        const nextDate = addBillingCycle(sub.plan_id);

        await connection.execute(
          `
          UPDATE subscriptions
          SET
            status='active',
            last_payment_id=?,
            current_period_start=?,
            current_period_end=?,
            next_billing_date=?,
            updated_at=NOW()
          WHERE id=?
          `,
          [payment.id, now, nextDate, nextDate, sub.id],
        );

        const invoiceId = `INV-WH-${Date.now()}`;

        await connection.execute(
          `
          INSERT INTO invoices(
            id,
            user_id,
            subscription_id,
            payment_id,
            plan_name,
            billing_cycle,
            amount,
            currency,
            status,
            period_start,
            period_end,
            paid_at,
            source
          )
          VALUES(
            ?,?,?,?,?,?,?,?,?,?,?,?,?
          )
          `,
          [
            invoiceId,
            sub.user_id,
            sub.id,
            payment.id,
            sub.plan_name,
            sub.billing_cycle,
            payment.amount,
            payment.currency || "INR",
            "paid",
            now,
            nextDate,
            now,
            "webhook",
          ],
        );

        break;
      }

      // =========================
      // SUB CANCELLED
      // =========================

      case "subscription.cancelled":
      case "subscription.completed": {
        const rzpSubId = payload.subscription?.entity?.id;

        if (rzpSubId) {
          await connection.execute(
            `
            UPDATE subscriptions
            SET
              status='cancelled',
              cancelled_at=NOW(),
              updated_at=NOW()
            WHERE rzp_subscription_id=?
            `,
            [rzpSubId],
          );
        }

        break;
      }

      // =========================
      // SUB PENDING
      // =========================

      case "subscription.pending": {
        const rzpSubId = payload.subscription?.entity?.id;

        if (rzpSubId) {
          await connection.execute(
            `
            UPDATE subscriptions
            SET
              status='pending',
              updated_at=NOW()
            WHERE rzp_subscription_id=?
            `,
            [rzpSubId],
          );
        }

        break;
      }

      // =========================
      // PAYMENT CAPTURED
      // =========================

      case "payment.captured": {
        const rzpSubId = payload.subscription?.entity?.id;
        const p = payload.payment?.entity;

        if (!p) break;

        const [existing] = await connection.execute(
          `
            SELECT id
            FROM payments
            WHERE rzp_payment_id=?
            LIMIT 1
            `,
          [p.id],
        );

        const [subs] = await connection.execute(
          `
  SELECT id,user_id
  FROM subscriptions
  WHERE rzp_subscription_id=?
  LIMIT 1
  `,
          [rzpSubId],
        );

        if (!subs.length) break;

        const sub = subs[0];

        if (!existing.length) {
          await connection.execute(
            `
  INSERT INTO payments(
    id,
    user_id,
    subscription_id,
    rzp_payment_id,
    rzp_subscription_id,
    amount,
    currency,
    method,
    status,
    source,
    captured_at,
    signature_verified
  )
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  `,
            [
              `pay_${Date.now()}`,
              sub.user_id,
              sub.id,
              p.id,
              rzpSubId,
              p.amount,
              p.currency || "INR",
              p.method || "unknown",
              "captured",
              "webhook",
              new Date(),
              1,
            ],
          );
        }

        break;
      }

      // =========================
      // PAYMENT FAILED
      // =========================

      case "payment.failed": {
        const p = payload.payment?.entity;

        const rzpSubId = payload.subscription?.entity?.id;

        if (rzpSubId) {
          await connection.execute(
            `
            UPDATE subscriptions
            SET
              status='past_due',
              last_failed_payment_id=?,
              updated_at=NOW()
            WHERE rzp_subscription_id=?
            `,
            [p?.id || null, rzpSubId],
          );
        }

        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.event}`);
    }

    await connection.commit();

    return res.json({
      success: true,
      received: true,
    });
  } catch (err) {
    await connection.rollback();

    console.error("[Webhook Error]", err);

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  } finally {
    connection.release();
  }
};

const createLabPaymentOrder = async (req, res) => {
  try {
    const { booking_id } = req.body;

    const [booking] = await db.execute(
      `
      SELECT *
      FROM lab_bookings
      WHERE id=?
      LIMIT 1
      `,
      [booking_id],
    );

    if (!booking.length) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const [existing] = await db.execute(
      `
      SELECT *
      FROM lab_booking_payments
      WHERE booking_id=?
      AND payment_status IN ('created','captured')
      LIMIT 1
      `,
      [booking_id],
    );

    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: "Payment already initiated",
      });
    }

    const amount = booking[0].total_amount;

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: booking[0].booking_id,
    });

    await db.execute(
      `
      INSERT INTO lab_booking_payments
      (
        booking_id,
        razorpay_order_id,
        amount,
        payment_status
      )
      VALUES (?,?,?,'created')
      `,
      [booking_id, order.id, amount],
    );

    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpay_key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
    });
  }
};

const verifyLabPayment = async (req, res) => {
  try {
    const {
      booking_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const [existingPayment] = await db.execute(
      `
      SELECT *
      FROM lab_booking_payments
      WHERE razorpay_payment_id=?
      LIMIT 1
      `,
      [razorpay_payment_id],
    );

    if (existingPayment.length) {
      return res.json({
        success: true,
        message: "Payment already verified",
      });
    }

    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    await db.execute(
      `
      UPDATE lab_booking_payments
      SET
        razorpay_payment_id=?,
        razorpay_signature=?,
        payment_status='captured',
        paid_at=NOW()
      WHERE razorpay_order_id=?
      `,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id],
    );

    await db.execute(
      `
      UPDATE lab_bookings
      SET
        payment_status='Paid',
        status='Confirmed'
      WHERE id=?
      `,
      [booking_id],
    );

    await db.execute(
      `
      INSERT INTO lab_booking_tracking
      (
        booking_id,
        status,
        remarks
      )
      VALUES (?,?,?)
      `,
      [booking_id, "Confirmed", "Payment received successfully"],
    );

    res.json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};

module.exports = {
  getBillingHistory,
  getInvoice,

  getAllPlans,
  getPlanById,

  createSubscription,
  verifySubscription,
  getActiveSubscription,
  getAllSubscriptions,
  getSubscriptionById,
  cancelSubscription,
  upgradeSubscription,

  getMe,
  updateMe,
  getDashboard,

  createOrder,
  verifyPayment,
  getPayment,

  razorpayWebhook,
  createLabPaymentOrder,
  verifyLabPayment,
};

// ------------------------------ END ----------------------------------------------
