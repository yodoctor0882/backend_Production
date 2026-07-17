const { initializeApp, cert, getApps } = require("firebase-admin/app");

const serviceAccount = require("./serviceAccountKey.json");

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}