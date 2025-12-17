import jwt from 'jsonwebtoken';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const firebaseApp = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(firebaseApp);

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRef = db.collection('users').doc(decoded.email);
    const doc = await userRef.get();

    if (!doc.exists) {
      await userRef.set({ email: decoded.email, role: 'student', createdAt: new Date() });
    }

    res.status(200).json({ success: true, email: decoded.email });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token', details: err.message });
  }
}