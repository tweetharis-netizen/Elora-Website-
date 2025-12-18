const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const link = `${process.env.BASE_URL}/api/verify?token=${token}`;

    const mailOptions = {
      from: `"Elora" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Magic Login Link ✨",
      html: `<p>Click <a href="${link}">here</a> to log in. This link expires in 15 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, email });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed", details: err.message });
  }
};
