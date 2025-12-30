import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  try {
    const token = req.query?.token;
    if (!token) return res.status(400).json({ error: "Token missing" });

    const secret = process.env.JWT_SECRET || process.env.ELORA_SESSION_JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Missing JWT_SECRET" });

    const decoded = jwt.verify(token, secret, { clockTolerance: 120 });
    const email = decoded?.email || decoded?.sub;
    if (!email) return res.status(401).json({ error: "Invalid token" });

    // Minimal: redirect to home.html with email
    const baseUrl = (process.env.BASE_URL || process.env.ELORA_BACKEND_URL || "").replace(/\/$/, "");
    const redirectUrl = baseUrl ? `${baseUrl}/home?email=${encodeURIComponent(email)}` : `/home?email=${encodeURIComponent(email)}`;
    return res.redirect(302, redirectUrl);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
