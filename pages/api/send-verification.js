// pages/api/send-verification.js

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

const app = !getAuth.length
  ? initializeApp({ credential: cert(serviceAccount) })
  : null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const auth = getAuth();
    await auth.getUserByEmail(email); // Check if user exists
    const link = await auth.generateEmailVerificationLink(email);

    return res.status(200).json({ message: "Verification email sent", link });
  } catch (error) {
    console.error("Firebase Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
