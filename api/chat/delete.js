const { kv, assertKvConfigured } = require("../_lib/kv");
const { sha256 } = require("../_lib/crypto");
const { verifySessionToken } = require("../_lib/tokens");
const { isEmailVerified } = require("../_lib/verificationStore");

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

function userHash(email) {
  return sha256(String(email || "").trim().toLowerCase());
}

function keyThreadList(email) {
  return `elora:chat:v1:list:${userHash(email)}`;
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

async function writeList(email, list) {
  await kv.set(keyThreadList(email), JSON.stringify(list));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

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

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "invalid_json" });
  }

  const id = String(body.id || "").trim();
  if (!id) return json(res, 400, { ok: false, error: "missing_id" });

  try {
    await kv.del(keyThread(auth.email, id));

    const list = await readList(auth.email);
    const next = list.filter((t) => t?.id !== id);
    await writeList(auth.email, next);

    return json(res, 200, { ok: true });
  } catch {
    return json(res, 500, { ok: false, error: "delete_failed" });
  }
};
