import nodemailer from 'nodemailer';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

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

export default async function handler(req, res) {
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

    const html = `
      <div style="font-family: sans-serif; padding: 20px; background: #f4f4f4; color: #333; border-radius: 8px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <h2 style="text-align: center; color: #6c63ff;">Welcome to Elora 👋</h2>
          <p style="font-size: 16px;">Hello there!</p>
          <p style="font-size: 16px;">Please verify your email by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" style="background-color: #6c63ff; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Verify Email</a>
          </div>
          <p style="font-size: 14px; color: #777;">If you didn’t request this, you can ignore this message.</p>
          <p style="font-size: 14px; text-align: center;">— The Elora Team</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Elora" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Please verify your email',
      html,
    });

    return res.status(200).json({ success: true, message: 'Verification email sent!' });
  } catch (err) {
    console.error('Error sending verification email:', err);
    return res.status(500).json({ error: err.message });
  }
}
