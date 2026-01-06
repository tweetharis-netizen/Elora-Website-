const { verifySessionToken } = require("../_lib/tokens");
const { isEmailVerified } = require("../_lib/verificationStore");
const { getRole } = require("../_lib/roleStore");
const { json, applyCors, parseCookies, SESSION_COOKIE } = require("../_lib/http");

function bearerFromReq(req) {
  const auth = String(req?.headers?.authorization || "");
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  // Prefer httpOnly cookie session; accept Bearer for backward compatibility.
  const cookies = parseCookies(req);
  const token = String(cookies[SESSION_COOKIE] || bearerFromReq(req) || "");
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
      role = "regular";
    }

    return json(res, 200, { ok: true, verified: true, email, role });
  } catch {
    return json(res, 200, { ok: true, verified: false, role: "guest" });
  }
};
