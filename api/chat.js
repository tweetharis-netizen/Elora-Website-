// Single endpoint to stay within Vercel Hobby function count.
// Actions: list | create | get | set
const { kv, assertKvConfigured } = require("./_lib/kv");
const { sha256, randomId } = require("./_lib/crypto");
const { verifySessionToken } = require("./_lib/tokens");
const { isEmailVerified } = require("./_lib/verificationStore");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function emailHash(email) {
  return sha256(normEmail(email));
}
function keyIndex(email) {
  return `elora:chat:index:${emailHash(email)}`;
}
function keyThread(id) {
  return `elora:chat:thread:${String(id || "").trim()}`;
}
function nowIso() {
  return new Date().toISOString();
}
function clampStr(s, max) {
  const t = String(s || "");
  return t.length > max ? t.slice(0, max) : t;
}
function sanitizeMessages(messages, { maxMessages = 80, maxText = 6000 } = {}) {
  const arr = Array.isArray(messages) ? messages : [];
  return arr.slice(-maxMessages).map((m) => ({
    from: m?.from === "user" ? "user" : "elora",
    text: clampStr(m?.text || "", maxText),
    at: m?.at ? String(m.at) : undefined,
  }));
}

async function readIndex(email) {
  const raw = await kv.get(keyIndex(email));
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function writeIndex(email, index) {
  await kv.set(keyIndex(email), JSON.stringify(index));
}

function getBearer(req) {
  const auth = String(req.headers.authorization || "");
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

module.exports = async function handler(req, res) {
  assertKvConfigured();

  const token = getBearer(req);
  if (!token) return json(res, 401, { ok: false, error: "missing_session" });

  let email = "";
  try {
    email = verifySessionToken(token).email;
  } catch {
    return json(res, 401, { ok: false, error: "invalid_session" });
  }

  const verified = await isEmailVerified(email).catch(() => false);
  if (!verified) return json(res, 403, { ok: false, error: "not_verified" });

  const body = req.method === "POST" ? await readBody(req) : {};
  const action = String((req.method === "GET" ? req.query?.action : body?.action) || "").trim();

  if (req.method === "GET" && action !== "list") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  if (action === "list") {
    const index = await readIndex(email);
    return json(res, 200, { ok: true, threads: index });
  }

  if (action === "create") {
    const title = clampStr(body?.title || "New chat", 80);
    const id = randomId(12);
    const createdAt = nowIso();

    const thread = {
      id,
      owner: emailHash(email),
      title,
      createdAt,
      updatedAt: createdAt,
      messages: [],
    };

    await kv.set(keyThread(id), JSON.stringify(thread));

    const index = await readIndex(email);
    const nextIndex = [
      { id, title, createdAt, updatedAt: createdAt },
      ...index.filter((t) => t?.id !== id),
    ].slice(0, 30);
    await writeIndex(email, nextIndex);

    return json(res, 200, { ok: true, id, thread });
  }

  if (action === "get") {
    const id = String(body?.id || "").trim();
    if (!id) return json(res, 400, { ok: false, error: "missing_thread_id" });

    const raw = await kv.get(keyThread(id));
    const thread = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;

    if (!thread || thread.owner !== emailHash(email)) return json(res, 404, { ok: false, error: "not_found" });
    return json(res, 200, { ok: true, thread });
  }

  if (action === "set") {
    const id = String(body?.id || "").trim();
    if (!id) return json(res, 400, { ok: false, error: "missing_thread_id" });

    const raw = await kv.get(keyThread(id));
    const thread = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;

    if (!thread || thread.owner !== emailHash(email)) return json(res, 404, { ok: false, error: "not_found" });

    const next = { ...thread };
    if (typeof body?.title === "string") next.title = clampStr(body.title, 80);
    if (body?.messages) next.messages = sanitizeMessages(body.messages);
    next.updatedAt = nowIso();

    await kv.set(keyThread(id), JSON.stringify(next));

    const index = await readIndex(email);
    const meta = { id, title: next.title || "Chat", createdAt: next.createdAt, updatedAt: next.updatedAt };
    const nextIndex = [meta, ...index.filter((t) => t?.id !== id)].slice(0, 30);
    await writeIndex(email, nextIndex);

    return json(res, 200, { ok: true, thread: next });
  }

  return json(res, 400, { ok: false, error: "invalid_action" });
};
