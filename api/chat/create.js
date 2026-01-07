const { kv, assertKvConfigured } = require("../_lib/kv");
const { sha256, randomId } = require("../_lib/crypto");
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

function safeTitle(input) {
  const t = String(input || "").trim().replace(/\s+/g, " ").slice(0, 60);
  return t || "New chat";
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

  const now = Date.now();
  const id = randomId(12);

  const thread = {
    id,
    title: safeTitle(body.title),
    createdAt: now,
    updatedAt: now,
    // visible “ability adaptation” state lives here (frontend can show it)
    studentState: body.studentState && typeof body.studentState === "object" ? body.studentState : { mode: "auto", level: "on_track" },
  };

  try {
    const list = await readList(auth.email);

    // hard cap total threads per user
    const MAX_THREADS = 20;
    const next = [thread, ...list].slice(0, MAX_THREADS);

    await writeList(auth.email, next);

    // Create empty thread doc
    await kv.set(keyThread(auth.email, id), JSON.stringify({ ...thread, messages: [] }));

    return json(res, 200, { ok: true, thread });
  } catch (e) {
    return json(res, 500, { ok: false, error: "persist_failed" });
  }
};
