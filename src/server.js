// require("dotenv").config();

// const app = require("./app");

// const syncPlans = require("./utils/syncPlans");

// const PORT = process.env.PORT || 4000;

// (async () => {
//   try {
//     await syncPlans();

//     app.listen(PORT, () => {
//       console.log(`🚀 Server running on port ${PORT}`);
//     });
//   } catch (err) {
//     console.error("Startup Error:", err);
//   }
// })();

require("dotenv").config();

const http = require("http");

const app = require("./app");
const syncPlans = require("./utils/syncPlans");
const { initializeSocket } = require("./socket");

const expireCertificatesJob = require("../cron/expireCertificates");

const {
  activateScheduledUpgrades,
} = require("../cron/subscriptionUpgradeCron");

const registerEvents = require("./events/registerEvents");

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

const httpServer = http.createServer(app);

/*
 * Socket.IO must initialize before registerEvents and cron jobs.
 */
initializeSocket(httpServer);

const startServer = async () => {
  try {
    await syncPlans();

    console.log("✅ Subscription plans synchronized");

    /*
     * Handlers may use SocketManager, so register only after
     * initializeSocket().
     */
    registerEvents();

    /*
     * Cron jobs may emit events, so start them after Socket.IO
     * and event listeners are ready.
     */
    expireCertificatesJob();
    activateScheduledUpgrades();

    httpServer.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on ${HOST}:${PORT}`);
      console.log("✅ Socket.IO server ready");
    });
  } catch (error) {
    console.error("❌ Startup Error:", error);
    process.exit(1);
  }
};

startServer();

const shutdown = (signal) => {
  console.log(`[Server] ${signal} received`);

  const { getIO, isSocketInitialized } = require("./socket");

  if (isSocketInitialized()) {
    const io = getIO();

    io.close(() => {
      console.log("[Socket.IO] Closed");
    });
  }

  httpServer.close((error) => {
    if (error) {
      console.error("[Server] Shutdown error:", error);
      process.exit(1);
    }

    console.log("[Server] HTTP server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[Server] Forced shutdown");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[Process] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Process] Uncaught exception:", error);
  shutdown("UNCAUGHT_EXCEPTION");
});
