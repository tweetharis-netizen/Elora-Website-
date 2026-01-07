const { kv, assertKvConfigured } = require("../_lib/kv");
const { sha256 } = require("../_lib/crypto");
const { verifySessionToken } = require("../_lib/tokens");
const { isEmailVerified } = require("../_lib/verificationStore");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function userHash(email) {
  return sha256(String(email || "").trim().toLowerCase());
}

function keyThread(email, id) {
  return `elora:chat:v1:thread:${userHash(email)}:${String(id || "").trim()}`;
}

function parseAuthEmail(req) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, code: 401, error: "missing_session" };
  try {
    const { email } = verifySessionToken(token);
    return { ok: true, email };
  } catch {
    return { ok: false, code: 401, error: "invalid_session" };
  }
}

function getQueryParam(req, name) {
  try {
    const u = new URL(req.url, "http://localhost");
    return u.searchParams.get(name) || "";
  } catch {
    return "";
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "method_not_allowed" });

  try {
    assertKvConfigured();
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.code === "kv_not_configured" ? "kv_not_configured" : "kv_error" });
  }

  const auth = parseAuthEmail(req);
  if (!auth.ok) return json(res, auth.code, { ok: false, error: auth.error });

  try {
    const verified = await isEmailVerified(auth.email);
    if (!verified) return json(res, 403, { ok: false, error: "not_verified" });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.code === "kv_not_configured" ? "kv_not_configured" : "verify_check_failed" });
  }

  const id = getQueryParam(req, "id").trim();
  if (!id) return json(res, 400, { ok: false, error: "missing_id" });

  try {
    const raw = await kv.get(keyThread(auth.email, id));
    if (!raw) return json(res, 404, { ok: false, error: "not_found" });

    if (typeof raw === "string") {
      try {
        return json(res, 200, { ok: true, thread: JSON.parse(raw) });
      } catch {
        return json(res, 500, { ok: false, error: "corrupt_thread" });
      }
    }

    // if kv returns object
    return json(res, 200, { ok: true, thread: raw });
  } catch {
    return json(res, 500, { ok: false, error: "read_failed" });
  }
};
