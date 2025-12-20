import { Resend } from 'resend';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

const resend = new Resend(process.env.RESEND_API_KEY);

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

    await resend.emails.send({
      from: 'Elora <onboarding@elora.dev>',
      to: email,
      subject: 'Verify your email for Elora',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5">
          <h2>Welcome to Elora 👋</h2>
          <p>Click the button below to verify your email address:</p>
          <p><a href="${link}" style="padding: 10px 15px; background: #6c63ff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
          <p>If you didn’t request this, just ignore this message.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true, message: 'Email sent' });
  } catch (err) {
    console.error('Error sending verification:', err);
    return res.status(500).json({ error: err.message });
  }
}
