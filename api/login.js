const Resend = require("resend").Resend;
const jwt = require("jsonwebtoken");

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    // create token
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const magicLink = `${process.env.BASE_URL}/api/verify?token=${token}`;

    // send email
    await resend.emails.send({
      from: process.env.RESEND_SENDER_EMAIL,
      to: email,
      subject: "Your Elora Login Link",
      html: `<p>Click <a href="${magicLink}">here</a> to login to Elora.</p><p>This link expires in 15 minutes.</p>`,
    });

    return res.status(200).json({ success: true, email });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Email send failed", details: err.message });
  }
};
