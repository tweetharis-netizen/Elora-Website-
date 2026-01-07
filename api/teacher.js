// Single teacher router (currently: redeem) to reduce serverless function count.
const jwt = require("jsonwebtoken");
const { kv } = require("@vercel/kv");
const crypto = require("crypto");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function isKvConfigured() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}
function assertKvConfigured() {
  if (!isKvConfigured()) {
    const err = new Error("kv_not_configured");
    err.code = "kv_not_configured";
    throw err;
  }
}

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function sha256(s) {
  return crypto.createHash("sha256").update(String(s || "")).digest("hex");
}
function emailHash(email) {
  return sha256(normEmail(email));
}

function sessionSecret() {
  return process.env.ELORA_SESSION_JWT_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || "";
}
function verifySessionToken(token) {
  const secret = sessionSecret();
  if (!secret) throw new Error("missing_session_secret");

  const payload = jwt.verify(token, secret, {
    issuer: "elora-website",
    audience: "elora-verification-ui",
    clockTolerance: 120,
  });

  const email = normEmail(payload?.email || payload?.sub || "");
  const ok =
    !!email &&
    ((payload?.typ === "session" && payload?.verified === true) ||
      (payload?.purpose === "verified_session" && payload?.v === 1));

  if (!ok) throw new Error("invalid");
  return { email };
}

function getBearer(req) {
  const auth = String(req.headers.authorization || "");
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function keyVerifiedEmail(email) {
  return `elora:verified:email:${emailHash(email)}`;
}
async function isEmailVerified(email) {
  assertKvConfigured();
  const v = await kv.get(keyVerifiedEmail(email));
  return v === "1" || v === 1 || v === true;
}

// role store
function keyRole(email) {
  return `elora:role:email:${emailHash(email)}`;
}
function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  return r === "teacher" ? "teacher" : "regular";
}
async function setRole(email, role) {
  assertKvConfigured();
  await kv.set(keyRole(email), normalizeRole(role));
}

function parseInviteCodes(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  try {
    assertKvConfigured();
  } catch {
    return json(res, 503, { ok: false, error: "kv_not_configured" });
  }

  const action = String(req.query?.action || "").trim();

  if (action !== "redeem") return json(res, 404, { ok: false, error: "not_found" });
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  const token = getBearer(req);
  if (!token) return json(res, 401, { ok: false, error: "missing_session" });

  let email = "";
  try {
    email = verifySessionToken(token).email;
  } catch {
    return json(res, 401, { ok: false, error: "invalid_session" });
  }

  const verified = await isEmailVerified(email).catch(() => false);
  if (!verified) return json(res, 403, { ok: false, error: "not_verified" });

  const body = await readBody(req);
  const code = String(body.code || "").trim();

  // allow clearing teacher role
  if (!code) {
    await setRole(email, "regular");
    return json(res, 200, { ok: true, role: "regular" });
  }

  const allowList = parseInviteCodes(process.env.TEACHER_INVITE_CODES || process.env.ELORA_TEACHER_INVITE_CODES);
  if (!allowList.length) return json(res, 500, { ok: false, error: "teacher_invites_not_configured" });
  if (!allowList.includes(code)) return json(res, 401, { ok: false, error: "invalid_code" });

  await setRole(email, "teacher");
  return json(res, 200, { ok: true, role: "teacher" });
};
