import admin from "firebase-admin";
import serviceAccount from "../../../serviceAccountKey.json";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default async function handler(req, res) {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Missing email parameter" });
  }

  try {
    await admin.auth().getUserByEmail(email);
    const link = await admin.auth().generateEmailVerificationLink(email);
    return res.status(200).json({ link });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
