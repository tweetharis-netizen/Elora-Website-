// 📁 api/send-verification.js

import nodemailer from "nodemailer";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert, getApps } from "firebase-admin/app";

// Initialize Firebase Admin once
if (!getApps().length) {
  initializeApp({
    credential: cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url:
        process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    }),
  });
}

export default async function handler(req, res) {
  try {
    // 1) Validate email
    const { email } = req.query;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Missing or invalid email." });
    }

    const auth = getAuth();

    // 2) Try to get the user — or create them
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        user = await auth.createUser({ email });
      } else {
        throw err;
      }
    }

    // 3) Generate verification link
    const verificationLink = await auth.generateEmailVerificationLink(email);

    // 4) Send email via Gmail
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
      subject: "Verify Your Elora Email",
      html: `
        <div style="font-family:Arial,sans-serif; text-align:center; padding:20px;">
          <h2 style="color:#6c63ff;">Welcome to Elora 👋</h2>
          <p>Click the button below to verify your email:</p>
          <a href="${verificationLink}" style="
            display:inline-block;
            padding:12px 20px;
            background:#6c63ff;
            color:white;
            border-radius:6px;
            text-decoration:none;
            font-weight:bold;
          ">Verify Email</a>
          <p style="margin-top:15px; font-size:12px; color:#555;">
            If you didn’t request this email, you can ignore it.
          </p>
        </div>
      `,
    });

    // 5) Success
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("⚠️ send-verification error:", error);
    return res.status(500).json({ error: error.message });
  }
}
