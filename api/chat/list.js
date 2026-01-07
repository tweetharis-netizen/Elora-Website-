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

function keyThreadList(email) {
  return `elora:chat:v1:list:${userHash(email)}`;
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

async function readList(email) {
  const raw = await kv.get(keyThreadList(email));
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
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

  try {
    const list = await readList(auth.email);

    // newest first
    list.sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));

    // hard cap returned list (avoid huge payloads)
    const capped = list.slice(0, 40);

    return json(res, 200, { ok: true, threads: capped });
  } catch {
    return json(res, 200, { ok: true, threads: [] });
  }
};
