const { db } = require("../_lib/firebaseAdmin");
const { enforceRateLimit } = require("../_lib/rateLimit");
const { signVerifyToken } = require("../_lib/tokens");
const { sendMail } = require("../_lib/mail");

function frontendUrl() {
  return (process.env.ELORA_FRONTEND_URL || "https://elora-verification-ui.vercel.app").replace(/\/$/, "");
}
function backendUrl() {
  return (process.env.ELORA_BACKEND_URL || "https://elora-website.vercel.app").replace(/\/$/, "");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email." });
  }

  try {
    // Anti-abuse
    await enforceRateLimit({ req, email });

    // Create verify token (JWT) and store jti
    const { token, jti, ttlSeconds } = signVerifyToken({ email });

    const firestore = db();
    const now = Date.now();
    await firestore.collection("verification_tokens").doc(jti).set({
      email,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
      usedAt: null,
    });

    const link = `${backendUrl()}/api/verification/confirm?token=${encodeURIComponent(token)}`;

    const subject = "Verify your email for Elora";
    const text = `Verify your email for Elora:\n\n${link}\n\nThis link expires in ${Math.round(ttlSeconds / 60)} minutes.`;

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;color:#0f172a">
        <div style="max-width:560px;margin:0 auto;padding:20px">
          <h2 style="margin:0 0 10px">Verify your email</h2>
          <p style="margin:0 0 16px;color:#334155">
            Verification unlocks exports (DOCX / PDF / PPTX).
          </p>
          <p style="margin:0 0 18px">
            <a href="${link}" style="display:inline-block;padding:12px 16px;border-radius:12px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:800">
              Verify Email
            </a>
          </p>
          <p style="margin:0;color:#64748b;font-size:12px">
            This link expires in ${Math.round(ttlSeconds / 60)} minutes.
          </p>
        </div>
      </div>
    `;

    await sendMail({ to: email, subject, html, text });

    return res.status(200).json({ ok: true });
  } catch (e) {
    const msg = e?.message || "Failed to send.";
    const code = e?.code || "send_failed";
    return res.status(code === "cooldown" || code === "rate_limited" ? 429 : 500).json({ error: msg });
  }
};
