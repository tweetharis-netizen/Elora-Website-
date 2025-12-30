const { db } = require("../_lib/firebaseAdmin");
const { signSessionToken } = require("../_lib/tokens");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const code = String(req.body?.code || "").trim();
  if (!code) return res.status(400).json({ error: "Missing code" });

  try {
    const firestore = db();
    const now = Date.now();

    const ref = firestore.collection("exchange_codes").doc(code);

    let email = "";
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("invalid_code");

      const d = snap.data() || {};
      if (d.usedAt) throw new Error("code_used");
      if (d.expiresAt && now > Number(d.expiresAt) + 60 * 1000) throw new Error("code_expired");

      email = String(d.email || "").toLowerCase();
      if (!email) throw new Error("invalid_code");

      tx.set(ref, { usedAt: now }, { merge: true });
    });

    // Ensure verified state exists
    const vSnap = await firestore.collection("verified_emails").doc(email).get();
    if (!vSnap.exists) return res.status(401).json({ error: "Email not verified." });

    const sessionToken = signSessionToken({ email });

    return res.status(200).json({ ok: true, email, sessionToken });
  } catch (e) {
    const reason = String(e?.message || "Exchange failed");
    const status =
      reason.includes("expired") ? 401 :
      reason.includes("used") ? 401 :
      401;
    return res.status(status).json({ error: "Invalid or expired code." });
  }
};
