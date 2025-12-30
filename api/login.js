const jwt = require("jsonwebtoken");
const { sendMail } = require("./_lib/mail");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required" });

  const secret = process.env.JWT_SECRET || process.env.ELORA_SESSION_JWT_SECRET || "";
  if (!secret) return res.status(500).json({ error: "Missing JWT_SECRET or ELORA_SESSION_JWT_SECRET" });

  const baseUrl = (process.env.BASE_URL || process.env.ELORA_BACKEND_URL || "https://elora-website.vercel.app").replace(/\/$/, "");

  try {
    const token = jwt.sign({ email }, secret, { expiresIn: "15m" });
    const magicLink = `${baseUrl}/api/verify?token=${encodeURIComponent(token)}`;

    await sendMail({
      to: email,
      subject: "Elora Login — Click to Sign In",
      text: `Click to sign in:\n\n${magicLink}\n\nThis link expires in 15 minutes.`,
      html: `<p>Click <a href="${magicLink}">here</a> to log in to Elora.</p><p>This link expires in 15 minutes.</p>`,
    });

    return res.status(200).json({ success: true, email });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Email send failed", details: err.message });
  }
};
