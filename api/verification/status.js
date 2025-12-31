const { verifySessionToken } = require("../_lib/tokens");
const { isEmailVerified } = require("../_lib/verificationStore");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "method_not_allowed" });

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return json(res, 200, { ok: true, verified: false });

  let email = "";
  try {
    email = verifySessionToken(token).email;
  } catch {
    return json(res, 200, { ok: true, verified: false });
  }

  try {
    const verified = await isEmailVerified(email);
    return json(res, 200, { ok: true, verified, email: verified ? email : null });
  } catch (e) {
    // If KV is down/misconfigured, fail closed
    return json(res, 200, { ok: true, verified: false });
  }
};
