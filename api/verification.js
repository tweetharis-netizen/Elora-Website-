// Single verification router to reduce serverless function count (Hobby limit).
// Rewrites map old endpoints to this file with ?action=...

const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
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

// ---------- KV config ----------
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

// ---------- helpers ----------
function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function sha256(s) {
  return crypto.createHash("sha256").update(String(s || "")).digest("hex");
}
function randomId(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

function verifySecret() {
  return process.env.ELORA_VERIFY_JWT_SECRET || process.env.JWT_SECRET || "";
}
function sessionSecret() {
  return process.env.ELORA_SESSION_JWT_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || "";
}

function signVerifyToken({ email, ttlSeconds = 45 * 60 }) {
  const secret = verifySecret();
  if (!secret) throw new Error("missing_verify_secret");

  const e = normEmail(email);
  const jti = randomId(16);

  const token = jwt.sign(
    { typ: "verify", purpose: "verify", email: e, sub: e, jti },
    secret,
    { expiresIn: ttlSeconds, issuer: "elora-website", audience: "elora" }
  );

  return { token, jti, ttlSeconds };
}

function verifyVerifyToken(token) {
  const secret = verifySecret();
  if (!secret) throw new Error("missing_verify_secret");

  const payload = jwt.verify(token, secret, {
    issuer: "elora-website",
    audience: "elora",
    clockTolerance: 120,
  });

  const email = normEmail(payload?.email || payload?.sub || "");
  const jti = String(payload?.jti || "").trim();

  const ok = (payload?.typ === "verify" || payload?.purpose === "verify") && email && jti;
  if (!ok) throw new Error("invalid");

  return { email, jti };
}

function signSessionToken({ email, ttlSeconds = 60 * 60 * 24 * 30 }) {
  const secret = sessionSecret();
  if (!secret) throw new Error("missing_session_secret");

  const e = normEmail(email);

  return jwt.sign(
    { typ: "session", purpose: "verified_session", v: 1, verified: true, email: e, sub: e },
    secret,
    { expiresIn: ttlSeconds, issuer: "elora-website", audience: "elora-verification-ui" }
  );
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

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// ---------- verification store (KV) ----------
function todayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
function emailHash(email) {
  return sha256(normEmail(email));
}
function ipHash(ip) {
  return sha256(String(ip || "").trim());
}
function keyVerifiedEmail(email) {
  return `elora:verified:email:${emailHash(email)}`;
}
function keyUsedJti(jti) {
  return `elora:verify:usedjti:${String(jti || "").trim()}`;
}
function keyCooldownIp(ip) {
  return `elora:rl:verify_send:ip:${ipHash(ip)}`;
}
function keyCooldownEmail(email) {
  return `elora:rl:verify_send:email:${emailHash(email)}`;
}
function keyDailyIp(ip) {
  return `elora:rl:verify_send:ip_daily:${ipHash(ip)}:${todayKey()}`;
}
function keyDailyEmail(email) {
  return `elora:rl:verify_send:email_daily:${emailHash(email)}:${todayKey()}`;
}
async function ttlSeconds(key) {
  const ttl = await kv.ttl(key);
  return typeof ttl === "number" && ttl > 0 ? ttl : 0;
}
async function setNxEx(key, seconds) {
  const res = await kv.set(key, "1", { nx: true, ex: seconds });
  return res === "OK";
}
async function incrWithExpiry(key, ttl) {
  const n = await kv.incr(key);
  if (n === 1) await kv.expire(key, ttl);
  return n;
}
async function enforceSendLimits({ ip, email, cooldownSeconds = 60, dailyMaxPerIp = 25, dailyMaxPerEmail = 10 }) {
  assertKvConfigured();

  const okIp = await setNxEx(keyCooldownIp(ip), cooldownSeconds);
  if (!okIp) return { ok: false, error: "rate_limited", retryAfter: (await ttlSeconds(keyCooldownIp(ip))) || cooldownSeconds };

  const okEmail = await setNxEx(keyCooldownEmail(email), cooldownSeconds);
  if (!okEmail) return { ok: false, error: "rate_limited", retryAfter: (await ttlSeconds(keyCooldownEmail(email))) || cooldownSeconds };

  const ipCount = await incrWithExpiry(keyDailyIp(ip), 60 * 60 * 24);
  if (ipCount > dailyMaxPerIp) return { ok: false, error: "rate_limited", retryAfter: (await ttlSeconds(keyDailyIp(ip))) || 60 * 60 * 24 };

  const emailCount = await incrWithExpiry(keyDailyEmail(email), 60 * 60 * 24);
  if (emailCount > dailyMaxPerEmail) return { ok: false, error: "rate_limited", retryAfter: (await ttlSeconds(keyDailyEmail(email))) || 60 * 60 * 24 };

  return { ok: true };
}
async function markEmailVerified(email) {
  assertKvConfigured();
  await kv.set(keyVerifiedEmail(email), "1");
}
async function isEmailVerified(email) {
  assertKvConfigured();
  const v = await kv.get(keyVerifiedEmail(email));
  return v === "1" || v === 1 || v === true;
}
async function isJtiUsed(jti) {
  assertKvConfigured();
  const v = await kv.get(keyUsedJti(jti));
  return v === "1" || v === 1 || v === true;
}
async function markJtiUsed(jti, ttl = 60 * 60 * 24 * 2) {
  assertKvConfigured();
  await kv.set(keyUsedJti(jti), "1", { nx: true, ex: ttl });
}

// ---------- role store ----------
function keyRole(email) {
  return `elora:role:email:${emailHash(email)}`;
}
async function getRole(email) {
  assertKvConfigured();
  const v = await kv.get(keyRole(email));
  const r = String(v || "").trim().toLowerCase();
  return r === "teacher" ? "teacher" : "regular";
}

// ---------- mail ----------
function getTransport() {
  const host = process.env.EMAIL_SMTP_HOST;
  const port = Number(process.env.EMAIL_SMTP_PORT || "465");
  const secure = String(process.env.EMAIL_SMTP_SECURE || "true") === "true";

  const user = process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER || "";
  const pass = process.env.EMAIL_SMTP_PASS || process.env.EMAIL_PASS || "";
  const service = process.env.EMAIL_SMTP_SERVICE;

  if (service) {
    if (!user || !pass) throw new Error("missing_smtp_auth");
    return nodemailer.createTransport({ service, auth: { user, pass } });
  }

  if (!host) throw new Error("missing_smtp_host");
  if (!user || !pass) throw new Error("missing_smtp_auth");

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}
function getFrom() {
  return process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER || "";
}
async function sendMail({ to, subject, html, text }) {
  const transport = getTransport();
  const from = getFrom();
  if (!from) throw new Error("missing_email_from");
  await transport.sendMail({ from: `Elora <${from}>`, to, subject, html, text });
}

// ---------- handler ----------
module.exports = async function handler(req, res) {
  try {
    assertKvConfigured();
  } catch (e) {
    return json(res, 503, { ok: false, error: "kv_not_configured" });
  }

  const action = String(req.query?.action || "").trim();

  // ---- STATUS ----
  if (action === "status") {
    if (req.method !== "GET") return json(res, 405, { ok: false, error: "method_not_allowed" });

    const token = getBearer(req);
    if (!token) return json(res, 200, { ok: true, verified: false, role: "guest" });

    let email = "";
    try {
      email = verifySessionToken(token).email;
    } catch {
      return json(res, 200, { ok: true, verified: false, role: "guest" });
    }

    try {
      const verified = await isEmailVerified(email);
      if (!verified) return json(res, 200, { ok: true, verified: false, role: "guest" });

      const role = await getRole(email).catch(() => "regular");
      return json(res, 200, { ok: true, verified: true, email, role });
    } catch {
      return json(res, 200, { ok: true, verified: false, role: "guest" });
    }
  }

  // ---- SEND ----
  if (action === "send") {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

    // IMPORTANT: never rely on request Host for demo links (Vercel preview URLs break sessions).
    // ELORA_FRONTEND_URL should be set to your canonical demo URL, and we keep a safe fallback.
    const FRONTEND = String(process.env.ELORA_FRONTEND_URL || "https://elora-verification-ui.vercel.app").replace(/\/$/, "");

    const body = await readBody(req);
    const email = normEmail(body.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { ok: false, error: "invalid_email" });

    const ip = getClientIp(req);

    const rl = await enforceSendLimits({ ip, email }).catch((err) => {
      if (err?.code === "kv_not_configured") return { ok: false, hard: true, error: "kv_not_configured" };
      return { ok: false, hard: true, error: "rate_limit_failed" };
    });

    if (!rl.ok) {
      if (rl.hard) return json(res, 500, { ok: false, error: rl.error });
      return json(res, 429, { ok: false, error: rl.error, retryAfter: rl.retryAfter });
    }

    let token;
    try {
      token = signVerifyToken({ email, ttlSeconds: 45 * 60 }).token;
    } catch (e) {
      return json(res, 500, { ok: false, error: e?.message || "token_sign_failed" });
    }

    const confirmUrl = `${FRONTEND}/api/verification/confirm?token=${encodeURIComponent(token)}`;

    try {
      await sendMail({
        to: email,
        subject: "Elora — Verify your email",
        text: `Verify your email: ${confirmUrl}\n\nThis link expires in 45 minutes.`,
        html: `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5;">
            <h2 style="margin:0 0 8px 0;">Verify your email</h2>
            <p style="margin:0 0 16px 0;color:#334155;">
              Click below to unlock exports and teacher tools.
            </p>
            <p style="margin:0 0 18px 0;">
              <a href="${confirmUrl}"
                 style="display:inline-block;padding:12px 16px;border-radius:999px;
                        background:linear-gradient(135deg,#4f46e5,#0ea5e9);
                        color:white;text-decoration:none;font-weight:800;">
                Verify email
              </a>
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;">
              This link expires in 45 minutes. If you didn’t request this, ignore it.
            </p>
          </div>
        `,
      });

      return json(res, 200, { ok: true });
    } catch (e) {
      console.error("EMAIL SEND FAILED:", e?.message || e);
      return json(res, 500, { ok: false, error: "email_send_failed" });
    }
  }

  // ---- CONFIRM / EXCHANGE (same logic, different input field) ----
  if (action === "confirm" || action === "exchange") {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

    const body = await readBody(req);
    const token = String(action === "exchange" ? body.code : body.token || "").trim();
    if (!token) return json(res, 400, { ok: false, error: action === "exchange" ? "missing_code" : "missing_token" });

    let email, jti;
    try {
      const v = verifyVerifyToken(token);
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

    let sessionToken;
    try {
      sessionToken = signSessionToken({ email });
    } catch (e) {
      return json(res, 500, { ok: false, error: e?.message || "session_sign_failed" });
    }

    return json(res, 200, { ok: true, email, sessionToken });
  }

  return json(res, 404, { ok: false, error: "not_found" });
};
