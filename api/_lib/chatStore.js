// api/_lib/chatStore.js
// KV-backed chat history store for Elora.
// - Only for VERIFIED sessions (server-side truth).
// - Keeps a small index per user + per-thread payload.
// - Defensive limits to prevent KV bloat.

const { kv, assertKvConfigured } = require("./kv");
const { sha256, randomId } = require("./crypto");

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailHash(email) {
  return sha256(normEmail(email));
}

function keyIndex(email) {
  return `elora:chat:index:${emailHash(email)}`;
}

function keyThread(threadId) {
  return `elora:chat:thread:${String(threadId || "").trim()}`;
}

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
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
  const trimmed = arr.slice(-maxMessages).map((m) => ({
    from: m?.from === "user" ? "user" : "elora",
    text: clampStr(m?.text || "", maxText),
    at: m?.at ? String(m.at) : undefined,
  }));
  return trimmed;
}

async function readIndex(email) {
  assertKvConfigured();
  const raw = await kv.get(keyIndex(email));
  if (!raw) return [];
  const parsed = typeof raw === "string" ? safeParseJSON(raw) : raw;
  return Array.isArray(parsed) ? parsed : [];
}

async function writeIndex(email, index) {
  assertKvConfigured();
  await kv.set(keyIndex(email), JSON.stringify(index));
}

async function listThreads(email) {
  const index = await readIndex(email);
  // newest first already
  return index.map((t) => ({
    id: t.id,
    title: t.title || "Chat",
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

async function createThread(email, { title = "New chat" } = {}) {
  assertKvConfigured();
  const e = normEmail(email);
  const id = randomId(12);
  const createdAt = nowIso();
  const thread = {
    id,
    owner: emailHash(e),
    title: clampStr(title || "New chat", 80),
    createdAt,
    updatedAt: createdAt,
    messages: [],
  };

  await kv.set(keyThread(id), JSON.stringify(thread));

  const index = await readIndex(e);
  const nextIndex = [
    { id, title: thread.title, createdAt: thread.createdAt, updatedAt: thread.updatedAt },
    ...index.filter((t) => t?.id !== id),
  ].slice(0, 30); // limit threads per user

  await writeIndex(e, nextIndex);

  return { id, thread };
}

async function getThread(email, threadId) {
  assertKvConfigured();
  const e = normEmail(email);
  const id = String(threadId || "").trim();
  if (!id) return null;

  const raw = await kv.get(keyThread(id));
  const parsed = typeof raw === "string" ? safeParseJSON(raw) : raw;
  if (!parsed || parsed.owner !== emailHash(e)) return null;

  return parsed;
}

async function setThread(email, threadId, patch = {}) {
  assertKvConfigured();
  const e = normEmail(email);
  const id = String(threadId || "").trim();
  if (!id) return { ok: false, error: "missing_thread_id" };

  const existing = await getThread(e, id);
  if (!existing) return { ok: false, error: "not_found" };

  const next = { ...existing };
  if (typeof patch.title === "string") next.title = clampStr(patch.title, 80);
  if (patch.messages) next.messages = sanitizeMessages(patch.messages);
  next.updatedAt = nowIso();

  await kv.set(keyThread(id), JSON.stringify(next));

  // Update index meta
  const index = await readIndex(e);
  const meta = {
    id,
    title: next.title || "Chat",
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  };

  const nextIndex = [meta, ...index.filter((t) => t?.id !== id)].slice(0, 30);
  await writeIndex(e, nextIndex);

  return { ok: true, thread: next };
}

module.exports = {
  listThreads,
  createThread,
  getThread,
  setThread,
};
