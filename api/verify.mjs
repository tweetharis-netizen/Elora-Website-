const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

module.exports = async function handler(req, res) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: "Token missing" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const email = decoded.email;

    // Create user if not exists
    const userRef = db.collection("users").doc(email);
    const snapshot = await userRef.get();
    if (!snapshot.exists) {
      await userRef.set({
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Redirect or return JSON
    // If you want a redirect to a home/dashboard page:
    const redirectUrl = `${process.env.BASE_URL}/home?email=${encodeURIComponent(email)}`;
    return res.redirect(302, redirectUrl);

    // OR simply return JSON:
    // return res.status(200).json({ success: true, email });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ error: "Verify failed", details: err.message });
  }
};
