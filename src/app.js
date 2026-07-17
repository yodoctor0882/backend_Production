// const express = require("express");
// const app = express();

// app.set("trust proxy", 1);

// app.disable("x-powered-by");
// require("dotenv").config();
// const requiredEnv = [
//   "RAZORPAY_KEY_ID",
//   "RAZORPAY_KEY_SECRET",
//   "RAZORPAY_WEBHOOK_SECRET",
//   "JWT_SECRET",
// ];
// requiredEnv.forEach((key) => {
//   if (!process.env[key]) {
//     throw new Error(`${key} is missing in .env`);
//   }
// });
// const cors = require("cors");

// const path = require("path");

// const helmet = require("helmet");
// const morgan = require("morgan");
// const rateLimit = require("express-rate-limit");

// app.use(helmet());

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const {
  authLimiter,
  paymentLimiter,
} = require("./middleware/rateLimit");

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

const requiredEnv = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "JWT_SECRET",
];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`${key} is missing in .env`);
  }
});
app.use("/auth", authLimiter);
app.use("/razorpay", paymentLimiter);
app.use(helmet());


const expireCertificatesJob = require("../cron/expireCertificates");
const EVENTS = require("./events/notification.events");
const registerEvents = require("./events/registerEvents");
const {
  activateScheduledUpgrades,
} = require("../cron/subscriptionUpgradeCron");
activateScheduledUpgrades();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "https://yodoctor.in",
      "https://www.yodoctor.in",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log("Origin:", origin);

      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      //console.log("Blocked Origin:", origin);

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },

    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-razorpay-signature"],
  }),
);



app.use(
  "/razorpay/webhooks/razorpay",
  express.raw({ type: "application/json" }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

app.use(["/auth", "/patient", "/doctor", "/admin"], limiter);

expireCertificatesJob();

registerEvents();

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use("/auth", require("./routes/auth.routes"));
app.use("/patient", require("./routes/patient.routes"));
app.use("/doctor", require("./routes/doctor.routes"));
app.use("/admin", require("./routes/admin.routes"));
app.use("/notifications", require("./routes/notification.routes"));

app.use("/certificate", require("./routes/certificate.routes"));
app.use("/api/chatbot", require("./routes/chatbot.routes"));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/contact", require("./routes/enquiry.routes"));

app.use("/razorpay", require("./routes/razorpay.routes"));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "YoDoctor API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

app.get("/cors-test", (req, res) => {
  res.json({
    success: true,
    origin: req.headers.origin,
    allowedOrigins,
  });
});

// 404 handler  ← ADD HERE

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use((err, req, res, next) => {
  console.error("[ERROR]", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

module.exports = app;
