const { verifySessionToken } = require("../_lib/tokens");
const { isEmailVerified } = require("../_lib/verificationStore");
const { getRole } = require("../_lib/roleStore");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "method_not_allowed" });

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  // No session: treat as guest.
  if (!token) return json(res, 200, { ok: true, verified: false, role: "guest" });

  let email = "";
  try {
    email = verifySessionToken(token).email;
  } catch {
    return json(res, 200, { ok: true, verified: false, role: "guest" });
  }

  try {
    const verified = await isEmailVerified(email);
    if (!verified) return json(res, 200, { ok: true, verified: false, role: "guest" });

    let role = "regular";
    try {
      role = await getRole(email);
    } catch {
      // If role store is missing, default to regular.
      role = "regular";
    }

    return json(res, 200, { ok: true, verified: true, email, role });
  } catch {
    return json(res, 200, { ok: true, verified: false, role: "guest" });
  }
};
