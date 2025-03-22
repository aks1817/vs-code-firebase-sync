const admin = require("firebase-admin");
const { getApps } = require("firebase-admin/app");
const serviceAccount = require("../../serviceAccountKey.json");

// Check if Firebase has already been initialized
if (!getApps().length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { db };
