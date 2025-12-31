const { verifyVerifyToken, signSessionToken } = require("../_lib/tokens");
const { isJtiUsed, markJtiUsed, markEmailVerified, isEmailVerified } = require("../_lib/verificationStore");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function looksLikeJwt(s) {
  // naive but effective: header.payload.signature
  return typeof s === "string" && s.split(".").length === 3;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const code = String(req.body?.code || "").trim();
  if (!code) return json(res, 400, { ok: false, error: "missing_code" });

  // New/robust path: code is actually a verify JWT (or someone pasted token)
  if (looksLikeJwt(code)) {
    let email, jti;
    try {
      const v = verifyVerifyToken(code);
      email = v.email;
      jti = v.jti;
    } catch (e) {
      const msg = e?.name === "TokenExpiredError" ? "expired" : "invalid";
      return json(res, 400, { ok: false, error: msg });
    }

    try {
      if (await isJtiUsed(jti)) return json(res, 400, { ok: false, error: "used" });
      await markJtiUsed(jti);
      await markEmailVerified(email);
    } catch (e) {
      return json(res, 500, { ok: false, error: e?.code === "kv_not_configured" ? "kv_not_configured" : "persist_failed" });
    }

    const sessionToken = signSessionToken({ email });
    return json(res, 200, { ok: true, email, sessionToken });
  }

  // Legacy Firestore exchange-code path (only if Firebase env is configured)
  const hasFirebase =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY;

  if (!hasFirebase) {
    return json(res, 400, {
      ok: false,
      error: "deprecated_exchange_code",
    });
  }

  try {
    const { db } = require("../_lib/firebaseAdmin");
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

    // With KV, verified state is authoritative, but also allow legacy Firestore verified_emails if you still have it.
    let verified = false;
    try {
      verified = await isEmailVerified(email);
    } catch {}

    if (!verified) {
      const vSnap = await firestore.collection("verified_emails").doc(email).get();
      if (!vSnap.exists) return json(res, 401, { ok: false, error: "not_verified" });
      // migrate forward
      try { await markEmailVerified(email); } catch {}
    }

    const sessionToken = signSessionToken({ email });
    return json(res, 200, { ok: true, email, sessionToken });
  } catch {
    return json(res, 401, { ok: false, error: "invalid_or_expired_code" });
  }
};
