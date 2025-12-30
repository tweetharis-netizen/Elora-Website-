const jwt = require("jsonwebtoken");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  const VERIFY_SECRET = process.env.ELORA_VERIFY_JWT_SECRET || process.env.JWT_SECRET;
  const SESSION_SECRET = process.env.ELORA_SESSION_JWT_SECRET || process.env.SESSION_SECRET;

  if (!VERIFY_SECRET) return json(res, 500, { ok: false, error: "missing_verify_secret" });
  if (!SESSION_SECRET) return json(res, 500, { ok: false, error: "missing_session_secret" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "invalid_json" });
  }

  const token = String(body.token || "");
  if (!token) return json(res, 400, { ok: false, error: "missing_token" });

  let p;
  try {
    p = jwt.verify(token, VERIFY_SECRET);
  } catch (e) {
    const msg = e?.name === "TokenExpiredError" ? "expired" : "invalid";
    return json(res, 400, { ok: false, error: msg });
  }

  if (p?.purpose !== "verify" || !p?.email) return json(res, 400, { ok: false, error: "invalid" });

  const email = String(p.email).toLowerCase();

  // This is what the FRONTEND stores as an httpOnly cookie
  const sessionJwt = jwt.sign(
    { v: 1, purpose: "verified_session", email },
    SESSION_SECRET,
    { expiresIn: "30d" }
  );

  return json(res, 200, { ok: true, email, sessionJwt });
};
