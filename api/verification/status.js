const jwt = require("jsonwebtoken");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  const SESSION_SECRET = process.env.ELORA_SESSION_JWT_SECRET;
  if (!SESSION_SECRET) return json(res, 500, { ok: false, error: "Missing ELORA_SESSION_JWT_SECRET" });

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return json(res, 200, { ok: true, verified: false });

  try {
    const p = jwt.verify(token, SESSION_SECRET);
    const verified = p?.purpose === "verified_session" && p?.v === 1 && !!p?.email;
    return json(res, 200, { ok: true, verified, email: verified ? p.email : null });
  } catch {
    return json(res, 200, { ok: true, verified: false });
  }
};
