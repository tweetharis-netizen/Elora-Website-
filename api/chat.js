// Single chat endpoint to keep function count low.
// Actions: list | create | get | set
const jwt = require("jsonwebtoken");
const { kv } = require("@vercel/kv");
const crypto = require("crypto");

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

function isKvConfigured() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}
function assertKvConfigured() {
  if (!isKvConfigured()) {
    const err = new Error("kv_not_configured");
    err.code = "kv_not_configured";
    throw err;
  }
}

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function sha256(s) {
  return crypto.createHash("sha256").update(String(s || "")).digest("hex");
}
function randomId(bytes = 12) {
  return crypto.randomBytes(bytes).toString("hex");
}
function clampStr(s, max) {
  const t = String(s || "");
  return t.length > max ? t.slice(0, max) : t;
}

function sessionSecret() {
  return process.env.ELORA_SESSION_JWT_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || "";
}
function verifySessionToken(token) {
  const secret = sessionSecret();
  if (!secret) throw new Error("missing_session_secret");

  const payload = jwt.verify(token, secret, {
    issuer: "elora-website",
    audience: "elora-verification-ui",
    clockTolerance: 120,
  });

  const email = normEmail(payload?.email || payload?.sub || "");
  const ok =
    !!email &&
    ((payload?.typ === "session" && payload?.verified === true) ||
      (payload?.purpose === "verified_session" && payload?.v === 1));

  if (!ok) throw new Error("invalid");
  return { email };
}

function getBearer(req) {
  const auth = String(req.headers.authorization || "");
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function emailHash(email) {
  return sha256(normEmail(email));
}
function keyVerifiedEmail(email) {
  return `elora:verified:email:${emailHash(email)}`;
}
async function isEmailVerified(email) {
  assertKvConfigured();
  const v = await kv.get(keyVerifiedEmail(email));
  return v === "1" || v === 1 || v === true;
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
function safeParse(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}
async function readIndex(email) {
  const raw = await kv.get(keyIndex(email));
  const parsed = safeParse(raw);
  return Array.isArray(parsed) ? parsed : [];
}
async function writeIndex(email, index) {
  await kv.set(keyIndex(email), JSON.stringify(index));
}
function sanitizeMessages(messages) {
  const arr = Array.isArray(messages) ? messages : [];
  return arr.slice(-80).map((m) => ({
    from: m?.from === "user" ? "user" : "elora",
    text: clampStr(m?.text || "", 6000),
    at: m?.at ? String(m.at) : undefined,
  }));
}

module.exports = async function handler(req, res) {
  try {
    assertKvConfigured();
  } catch {
    return json(res, 503, { ok: false, error: "kv_not_configured" });
  }

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

  if (req.method === "GET" && action !== "list") return json(res, 405, { ok: false, error: "method_not_allowed" });

  if (action === "list") {
    const threads = await readIndex(email).catch(() => []);
    return json(res, 200, { ok: true, threads });
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
    const thread = safeParse(raw);
    if (!thread || thread.owner !== emailHash(email)) return json(res, 404, { ok: false, error: "not_found" });

    return json(res, 200, { ok: true, thread });
  }

  if (action === "set") {
    const id = String(body?.id || "").trim();
    if (!id) return json(res, 400, { ok: false, error: "missing_thread_id" });

    const raw = await kv.get(keyThread(id));
    const thread = safeParse(raw);
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
