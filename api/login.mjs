import { Resend } from 'resend';
import jwt from 'jsonwebtoken';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const magicLink = \`\${process.env.BASE_URL}/api/verify?token=\${token}\`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_SENDER_EMAIL,
      to: email,
      subject: 'Your Magic Login Link',
      html: \`<p>Click <a href="\${magicLink}">here</a> to login to Elora. This link expires in 15 minutes.</p>\`,
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
}
