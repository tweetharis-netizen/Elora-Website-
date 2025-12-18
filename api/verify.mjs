import jwt from "jsonwebtoken";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: "Token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // create user if not exists
    const userRef = db.collection("users").doc(decoded.email);
    const snapshot = await userRef.get();
    if (!snapshot.exists) {
      await userRef.set({ email: decoded.email, createdAt: new Date() });
    }

    // ✅ Redirect to dashboard/homepage with email
    const redirectUrl = `https://elora-website.vercel.app/home?email=${encodeURIComponent(decoded.email)}`;
    return res.writeHead(302, { Location: redirectUrl }).end();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Invalid or expired token", details: err.message });
  }
}
