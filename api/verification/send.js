const { sendMail } = require("../_lib/mail");
const { getClientIp } = require("../_lib/rateLimit"); // only for IP parsing
const { signVerifyToken } = require("../_lib/tokens");
const { enforceSendLimits, normEmail } = require("../_lib/verificationStore");
const { json, readJson, applyCors, frontendUrl, getBaseUrl } = require("../_lib/http");

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const FRONTEND = frontendUrl();
  if (!FRONTEND) return json(res, 500, { ok: false, error: "missing_ELORA_FRONTEND_URL" });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return json(res, 400, { ok: false, error: "invalid_json" });
  }

  const email = normEmail(body.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { ok: false, error: "invalid_email" });

  const ip = getClientIp(req);

  // KV-backed anti-abuse: cooldown + daily caps
  try {
    const rl = await enforceSendLimits({
      ip,
      email,
      cooldownSeconds: 60,
      dailyMaxPerIp: 25,
      dailyMaxPerEmail: 10,
    });
    if (!rl.ok) return json(res, 429, { ok: false, error: rl.error, retryAfter: rl.retryAfter });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: e?.code === "kv_not_configured" ? "kv_not_configured" : "rate_limit_failed",
    });
  }

  let token;
  try {
    token = signVerifyToken({ email, ttlSeconds: 45 * 60 }).token;
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "token_sign_failed" });
  }

  // Preferred: confirmation happens on the BACKEND so it can set the session cookie, then redirect to frontend.
  const SELF = getBaseUrl(req);
  const confirmUrl =
    SELF
      ? `${SELF}/api/verification/confirm?token=${encodeURIComponent(token)}`
      : `${FRONTEND}/api/verification/confirm?token=${encodeURIComponent(token)}`;

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
};
