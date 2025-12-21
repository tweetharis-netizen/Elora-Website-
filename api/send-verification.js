import nodemailer from 'nodemailer';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin only once
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

// Basic CORS middleware
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    const link = await getAuth().generateEmailVerificationLink(email);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Elora" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email for Elora',
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.5; padding:20px;">
          <h2 style="color:#6c63ff;">Welcome to Elora 👋</h2>
          <p>Click below to verify your email:</p>
          <a href="${link}" style="
            display:inline-block;
            padding:12px 20px;
            background:#6c63ff;
            color:white;
            border-radius:6px;
            text-decoration:none;
            font-weight:bold;
          ">Verify Email</a>
          <p style="font-size:12px; color:#555; margin-top:15px;">
            If you didn’t request this, ignore this email.
          </p>
        </div>
      `,
    });

    res.status(200).json({ success: true, message: 'Email sent!' });
  } catch (error) {
    console.error('send-verification error:', error);
    res.status(500).json({ error: error.message });
  }
}
