const { db } = require("../_lib/firebaseAdmin");
const { randomId } = require("../_lib/crypto");
const { verifyVerifyToken } = require("../_lib/tokens");

function frontendUrl() {
  return (process.env.ELORA_FRONTEND_URL || "https://elora-verification-ui.vercel.app").replace(/\/$/, "");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  const token = String(req.query?.token || "");
  if (!token) return res.redirect(`${frontendUrl()}/verify?error=invalid`);

  try {
    const payload = verifyVerifyToken(token);
    const email = String(payload.sub || "").toLowerCase();
    const jti = String(payload.jti || "");

    if (!email || !jti) return res.redirect(`${frontendUrl()}/verify?error=invalid`);

    const firestore = db();
    const now = Date.now();

    await firestore.runTransaction(async (tx) => {
      const tokenRef = firestore.collection("verification_tokens").doc(jti);
      const tokenSnap = await tx.get(tokenRef);
      if (!tokenSnap.exists) throw new Error("invalid");

      const t = tokenSnap.data() || {};
      if (t.usedAt) throw new Error("used");
      if (t.expiresAt && now > Number(t.expiresAt) + 60 * 1000) throw new Error("expired"); // 60s grace

      // Mark token used
      tx.set(tokenRef, { usedAt: now }, { merge: true });

      // Mark verified
      const emailRef = firestore.collection("verified_emails").doc(email);
      tx.set(emailRef, { email, verifiedAt: now }, { merge: true });
    });

    // Create one-time exchange code
    const code = randomId(24);
    const firestore = db();
    await firestore.collection("exchange_codes").doc(code).set({
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      usedAt: null,
      email,
    });

    return res.redirect(`${frontendUrl()}/success?code=${encodeURIComponent(code)}`);
  } catch (e) {
    const reason = String(e?.message || "");
    const mapped =
      reason === "expired" ? "expired" :
      reason === "used" ? "invalid" :
      "invalid";
    return res.redirect(`${frontendUrl()}/verify?error=${encodeURIComponent(mapped)}`);
  }
};
