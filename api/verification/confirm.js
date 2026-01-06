const { verifyVerifyToken, signSessionToken } = require("../_lib/tokens");
const { isJtiUsed, markJtiUsed, markEmailVerified } = require("../_lib/verificationStore");
const { json, readJson, applyCors, readQuery, setSessionCookie, frontendUrl, redirect } = require("../_lib/http");

// /api/verification/confirm
// - GET: used by email link, sets httpOnly session cookie on THIS backend domain, then redirects to frontend.
// - POST: used by programmatic flows; also sets cookie and returns JSON (kept for backward compatibility).

module.exports = async function handler(req, res) {
  // CORS matters only for fetch; safe for top-level GET navigations too.
  if (applyCors(req, res)) return;

  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  let token = "";
  if (method === "GET") {
    token = String(readQuery(req).get("token") || "");
  } else {
    try {
      const body = await readJson(req);
      token = String(body?.token || body?.code || "");
    } catch (e) {
      return json(res, 400, { ok: false, error: "invalid_json" });
    }
  }

  if (!token) {
    if (method === "GET") {
      const FRONTEND = frontendUrl();
      return redirect(res, FRONTEND ? `${FRONTEND}/verify?error=missing_token` : "/");
    }
    return json(res, 400, { ok: false, error: "missing_token" });
  }

  let email = "";
  let jti = "";
  try {
    const v = verifyVerifyToken(token);
    email = v.email;
    jti = v.jti;
  } catch (e) {
    const msg = e?.name === "TokenExpiredError" ? "expired" : "invalid";
    if (method === "GET") {
      const FRONTEND = frontendUrl();
      return redirect(res, FRONTEND ? `${FRONTEND}/verify?error=${encodeURIComponent(msg)}` : "/");
    }
    return json(res, 400, { ok: false, error: msg });
  }

  try {
    if (await isJtiUsed(jti)) {
      if (method === "GET") {
        const FRONTEND = frontendUrl();
        return redirect(res, FRONTEND ? `${FRONTEND}/verify?error=used` : "/");
      }
      return json(res, 400, { ok: false, error: "used" });
    }

    await markJtiUsed(jti);
    await markEmailVerified(email);
  } catch (e) {
    const err = e?.code === "kv_not_configured" ? "kv_not_configured" : "persist_failed";
    if (method === "GET") {
      const FRONTEND = frontendUrl();
      return redirect(res, FRONTEND ? `${FRONTEND}/verify?error=${encodeURIComponent(err)}` : "/");
    }
    return json(res, 500, { ok: false, error: err });
  }

  let sessionToken = "";
  try {
    sessionToken = signSessionToken({ email });
  } catch (e) {
    const err = e?.message || "session_sign_failed";
    if (method === "GET") {
      const FRONTEND = frontendUrl();
      return redirect(res, FRONTEND ? `${FRONTEND}/verify?error=${encodeURIComponent(err)}` : "/");
    }
    return json(res, 500, { ok: false, error: err });
  }

  // Cookie is the authoritative session; keep sessionToken in JSON for legacy clients.
  setSessionCookie(req, res, sessionToken);

  if (method === "GET") {
    const FRONTEND = frontendUrl();
    // Frontend already has /verified; it also triggers a status refresh.
    return redirect(res, FRONTEND ? `${FRONTEND}/verified` : "/");
  }

  return json(res, 200, { ok: true, email, sessionToken });
};
