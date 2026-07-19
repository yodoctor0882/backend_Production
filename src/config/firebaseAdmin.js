// const { initializeApp, cert, getApps } = require("firebase-admin/app");

// const serviceAccount = require("./serviceAccountKey.json");

// if (!getApps().length) {
//   initializeApp({
//     credential: cert(serviceAccount),
//   });
// }


const { initializeApp, cert, getApps } = require("firebase-admin/app");

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY_BASE64,
} = process.env;

if (!FIREBASE_PROJECT_ID) {
  throw new Error("FIREBASE_PROJECT_ID is missing");
}

if (!FIREBASE_CLIENT_EMAIL) {
  throw new Error("FIREBASE_CLIENT_EMAIL is missing");
}

if (!FIREBASE_PRIVATE_KEY_BASE64) {
  throw new Error("FIREBASE_PRIVATE_KEY_BASE64 is missing");
}

const privateKey = Buffer.from(
  FIREBASE_PRIVATE_KEY_BASE64,
  "base64",
).toString("utf8");

if (
  !privateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
  !privateKey.trim().endsWith("-----END PRIVATE KEY-----")
) {
  throw new Error("Firebase private key is invalid");
}

const serviceAccount = {
  projectId: FIREBASE_PROJECT_ID,
  clientEmail: FIREBASE_CLIENT_EMAIL,
  privateKey,
};

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}