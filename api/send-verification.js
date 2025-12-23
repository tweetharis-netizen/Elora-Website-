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

/* ---------- CORS ---------- */
function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && origin.includes("vercel.app")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Ensure user exists
    try {
      await admin.auth().getUserByEmail(email);
    } catch {
      await admin.auth().createUser({
        email,
        emailVerified: false,
      });
    }

    // 🔑 THIS IS THE KEY LINE
    // User is redirected here ONLY AFTER clicking the email link
    const verificationLink =
      await admin.auth().generateEmailVerificationLink(email, {
        url: "https://elora-verification-ui.vercel.app/success",
      });

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
          <p>Please verify your email to continue.</p>
          <a href="${verificationLink}"
             style="display:inline-block;padding:12px 18px;
             background:#4f46e5;color:white;
             text-decoration:none;border-radius:8px;">
            Verify Email
          </a>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Verification email sent",
    });
  } catch (error) {
    console.error("Verification error:", error);
    return res
      .status(500)
      .json({ error: "Failed to send verification email" });
  }
}
