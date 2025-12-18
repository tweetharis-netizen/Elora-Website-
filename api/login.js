const jwt = require("jsonwebtoken");
const Resend = require("resend").Resend;

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Create JWT token
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    // Build verification link (must use BASE_URL env)
    const baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      throw new Error("BASE_URL environment variable is not set");
    }

    const magicLink = `${baseUrl}/api/verify?token=${token}`;

    // Send magic link email via Resend
    await resend.emails.send({
      from: process.env.RESEND_SENDER_EMAIL,
      to: email,
      subject: "Elora Login — Click to Sign In",
      html: `<p>Click <a href="${magicLink}">here</a> to log in to Elora.</p><p>This link expires in 15 minutes.</p>`,
    });

    return res.status(200).json({ success: true, email });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      error: "Email send failed",
      details: err.message,
    });
  }
};
