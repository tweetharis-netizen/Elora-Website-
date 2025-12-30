const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Basic abuse protection (serverless-friendly).
 * Not perfect across cold starts, but stops casual spam.
 */
const mem = globalThis.__ELORA_RL__ || (globalThis.__ELORA_RL__ = new Map());
function hit(key, windowMs) {
  const now = Date.now();
  const last = mem.get(key) || 0;
  if (now - last < windowMs) return false;
  mem.set(key, now);
  return true;
}

function makeTransport() {
  const user = process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.EMAIL_SMTP_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) throw new Error("SMTP auth missing (EMAIL_SMTP_USER/PASS or EMAIL_USER/PASS)");

  // Option A: Gmail service mode
  if (process.env.EMAIL_SMTP_SERVICE) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SMTP_SERVICE,
      auth: { user, pass },
    });
  }

  // Option B: Host mode
  const host = process.env.EMAIL_SMTP_HOST;
  const port = Number(process.env.EMAIL_SMTP_PORT || 587);
  const secure = String(process.env.EMAIL_SMTP_SECURE || "false") === "true";

  if (!host) throw new Error("SMTP host missing (set EMAIL_SMTP_HOST or EMAIL_SMTP_SERVICE)");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const FRONTEND =
    (process.env.ELORA_FRONTEND_URL || process.env.REDIRECT_URL || process.env.BASE_URL || "").replace(/\/$/, "");

  const VERIFY_SECRET = process.env.ELORA_VERIFY_JWT_SECRET || process.env.JWT_SECRET;

  if (!FRONTEND) return json(res, 500, { ok: false, error: "Missing ELORA_FRONTEND_URL" });
  if (!VERIFY_SECRET) return json(res, 500, { ok: false, error: "Missing ELORA_VERIFY_JWT_SECRET (or JWT_SECRET)" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON" });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { ok: false, error: "Invalid email" });

  const ip = getClientIp(req);
  if (!hit(`ip:${ip}`, 60_000)) return json(res, 429, { ok: false, error: "Too many requests. Try again soon." });
  if (!hit(`email:${email}`, 60_000)) return json(res, 429, { ok: false, error: "Recently sent. Try again soon." });

  const token = jwt.sign(
    { purpose: "verify", email, jti: crypto.randomBytes(16).toString("hex") },
    VERIFY_SECRET,
    { expiresIn: "30m" }
  );

  // IMPORTANT: link hits FRONTEND confirm endpoint (frontend sets cookie on its own domain)
  const confirmUrl = `${FRONTEND}/api/verification/confirm?token=${encodeURIComponent(token)}`;

  try {
    const transport = makeTransport();
    const from = process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER;

    await transport.sendMail({
      from: `"Elora" <${from}>`,
      to: email,
      subject: "Elora — Verify your email",
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5;">
          <h2 style="margin:0 0 8px 0;">Verify your email</h2>
          <p style="margin:0 0 16px 0;color:#334155;">
            Click the button below to unlock exports (DOCX / PDF / PPTX).
          </p>
          <p style="margin:0 0 18px 0;">
            <a href="${confirmUrl}"
               style="display:inline-block;padding:12px 16px;border-radius:999px;
                      background:linear-gradient(135deg,#7c7bff,#59c2ff);
                      color:white;text-decoration:none;font-weight:800;">
              Verify email
            </a>
          </p>
          <p style="margin:0;color:#64748b;font-size:13px;">
            This link expires in 30 minutes. If you didn’t request this, ignore it.
          </p>
        </div>
      `,
    });

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error("EMAIL SEND FAILED:", e?.message || e);
    // Don’t leak secrets; return a useful code.
    const msg = String(e?.message || "");
    if (msg.includes("Invalid login")) return json(res, 500, { ok: false, error: "smtp_auth_failed" });
    if (msg.includes("EAUTH")) return json(res, 500, { ok: false, error: "smtp_auth_failed" });
    if (msg.includes("ECONNECTION")) return json(res, 500, { ok: false, error: "smtp_connection_failed" });
    return json(res, 500, { ok: false, error: "email_send_failed" });
  }
};
