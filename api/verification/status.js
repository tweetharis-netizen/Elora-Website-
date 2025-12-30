const { db } = require("../_lib/firebaseAdmin");
const { verifySessionToken } = require("../_lib/tokens");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return res.status(200).json({ verified: false, email: "" });

  try {
    const payload = verifySessionToken(token);
    const email = String(payload.sub || "").toLowerCase();
    if (!email) return res.status(200).json({ verified: false, email: "" });

    const firestore = db();
    const snap = await firestore.collection("verified_emails").doc(email).get();
    if (!snap.exists) return res.status(200).json({ verified: false, email: "" });

    return res.status(200).json({ verified: true, email });
  } catch {
    return res.status(200).json({ verified: false, email: "" });
  }
};
