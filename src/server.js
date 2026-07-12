require("dotenv").config();

const app = require("./app");

const syncPlans = require("./utils/syncPlans");

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await syncPlans();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Startup Error:", err);
  }
})();
