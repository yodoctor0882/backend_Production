// // server.js
// const app = require("./app");
// require("dotenv").config();

// const PORT = process.env.PORT || 4000;

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });


const app = require("./app");
require("dotenv").config();

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