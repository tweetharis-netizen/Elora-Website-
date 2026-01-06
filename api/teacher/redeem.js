const { verifySessionToken } = require("../_lib/tokens");
const { isEmailVerified } = require("../_lib/verificationStore");
const { setRole } = require("../_lib/roleStore");
const { kv, assertKvConfigured } = require("../_lib/kv");
const { sha256 } = require("../_lib/crypto");
const { json, readJson, applyCors, parseCookies, SESSION_COOKIE } = require("../_lib/http");

function bearerFromReq(req) {
  const auth = String(req?.headers?.authorization || "");
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function parseInviteCodes(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normCode(code) {
  return String(code || "").trim().toUpperCase();
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  // Prefer cookie; accept Bearer for older clients.
  const cookies = parseCookies(req);
  const token = String(cookies[SESSION_COOKIE] || bearerFromReq(req) || "");
  if (!token) return json(res, 401, { ok: false, error: "missing_session" });

  let email = "";
  try {
    email = verifySessionToken(token).email;
  } catch {
    return json(res, 401, { ok: false, error: "invalid_session" });
  }

  // Must be verified to redeem teacher access.
  try {
    const verified = await isEmailVerified(email);
    if (!verified) return json(res, 403, { ok: false, error: "not_verified" });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: e?.code === "kv_not_configured" ? "kv_not_configured" : "verify_check_failed",
    });
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    return json(res, 400, { ok: false, error: "invalid_json" });
  }

  const code = normCode(body?.code);
  if (!code) return json(res, 400, { ok: false, error: "missing_code" });

  const allowList = parseInviteCodes(process.env.ELORA_TEACHER_INVITE_CODES || process.env.TEACHER_INVITE_CODES);
  if (!allowList.length) return json(res, 500, { ok: false, error: "teacher_invites_not_configured" });

  if (!allowList.map(normCode).includes(code)) return json(res, 401, { ok: false, error: "invalid_code" });

  try {
    await setRole(email, "teacher");

    // Persist redemption record (codes are reusable, but we still track who redeemed what).
    assertKvConfigured();
    const emailKey = sha256(email);
    const codeKey = sha256(code);
    const now = Date.now();

    await kv.set(`elora:teacher_invite:redeemed:${emailKey}:${codeKey}`, String(now), { ex: 60 * 60 * 24 * 365 });
    await kv.set(`elora:teacher_invite:last_code:${emailKey}`, code, { ex: 60 * 60 * 24 * 365 });

    return json(res, 200, { ok: true, role: "teacher" });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: e?.code === "kv_not_configured" ? "kv_not_configured" : "persist_failed",
    });
  }
};
