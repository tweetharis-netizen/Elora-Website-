import nodemailer from 'nodemailer';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    }),
  });
}

// Create Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function handler(req, res) {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    // Generate Firebase verification link
    const link = await getAuth().generateEmailVerificationLink(email);

    // Send email via Gmail
    await transporter.sendMail({
      from: `"Elora" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email for Elora',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Welcome to Elora 👋</h2>
          <p>Please verify your email by clicking the button below:</p>
          <p>
            <a href="${link}" style="
              display: inline-block;
              padding: 10px 16px;
              background-color: #6c63ff;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            ">
              Verify Email
            </a>
          </p>
          <p>If you didn’t request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (err) {
    console.error('Error sending verification email:', err);
    return res.status(500).json({ error: err.message });
  }
}
