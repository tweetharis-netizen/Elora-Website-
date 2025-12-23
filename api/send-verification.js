import admin from "firebase-admin";
import nodemailer from "nodemailer";

/* ---------- Firebase Init ---------- */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

/* ---------- CORS Helper ---------- */
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "https://elora-verification-ui.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  /* ---------- Handle Preflight ---------- */
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  /* ---------- Allow Only POST ---------- */
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const verificationLink =
      await admin.auth().generateEmailVerificationLink(email);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Elora" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your email for Elora",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Welcome to Elora</h2>
          <p>Your AI Teaching Assistant is almost ready.</p>
          <p>Please verify your email:</p>
          <a href="${verificationLink}" 
             style="display:inline-block;padding:12px 18px;
             background:#6366f1;color:white;
             text-decoration:none;border-radius:8px;">
            Verify Email
          </a>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ error: "Failed to send verification email" });
  }
}
