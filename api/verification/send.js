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
 * Simple anti-abuse (works even without a DB; not perfect across cold starts)
 */
const mem = globalThis.__ELORA_RL__ || (globalThis.__ELORA_RL__ = new Map());
function hit(key, windowMs) {
  const now = Date.now();
  const last = mem.get(key) || 0;
  if (now - last < windowMs) return false;
  mem.set(key, now);
  return true;
}

function makeTransporter() {
  // Service-based (Gmail)
  if (process.env.EMAIL_SMTP_SERVICE) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SMTP_SERVICE,
      auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS,
      },
    });
  }

  // Host-based SMTP
  if (process.env.EMAIL_SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: Number(process.env.EMAIL_SMTP_PORT || 587),
      secure: String(process.env.EMAIL_SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS,
      },
    });
  }

  throw new Error("Missing SMTP config. Set EMAIL_SMTP_SERVICE or EMAIL_SMTP_HOST.");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const FRONTEND = (process.env.ELORA_FRONTEND_URL || "").replace(/\/$/, "");
  const VERIFY_SECRET = process.env.ELORA_VERIFY_JWT_SECRET;

  if (!FRONTEND) return json(res, 500, { ok: false, error: "Missing ELORA_FRONTEND_URL" });
  if (!VERIFY_SECRET) return json(res, 500, { ok: false, error: "Missing ELORA_VERIFY_JWT_SECRET" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { ok: false, error: "Invalid email" });

  const ip = getClientIp(req);
  if (!hit(`ip:${ip}`, 60_000)) return json(res, 429, { ok: false, error: "Too many requests. Try again soon." });
  if (!hit(`email:${email}`, 60_000)) return json(res, 429, { ok: false, error: "Recently sent. Try again soon." });

  const jti = crypto.randomBytes(16).toString("hex");

  const token = jwt.sign(
    { email, jti, purpose: "verify" },
    VERIFY_SECRET,
    { expiresIn: "30m" }
  );

  // IMPORTANT: link points to FRONTEND confirm endpoint (frontend sets cookie)
  const confirmUrl = `${FRONTEND}/api/verification/confirm?token=${encodeURIComponent(token)}`;

  try {
    const transporter = makeTransporter();
    const from = process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER;

    await transporter.sendMail({
      from: `"Elora" <${from}>`,
      to: email,
      subject: "Elora — Verify your email",
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5;">
          <h2 style="margin:0 0 8px 0;">Verify your email</h2>
          <p style="margin:0 0 16px 0;color:#334155;">
            Click below to verify and unlock DOCX / PDF / PPTX exports.
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
            Link expires in 30 minutes. If you didn’t request this, ignore.
          </p>
        </div>
      `,
    });

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error("EMAIL SEND FAIL:", e);
    return json(res, 500, { ok: false, error: "Email send failed" });
  }
};
