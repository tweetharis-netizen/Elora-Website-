const { kv, assertKvConfigured } = require("./kv");

const KEY_PREFIX = "elora:chat:v1:";
const MAX_MESSAGES = 80;
const MAX_TEXT = 6000;

function key(email) {
  return `${KEY_PREFIX}${String(email || "").trim().toLowerCase()}`;
}

function sanitizeMessages(input) {
  if (!Array.isArray(input)) return [];

  const out = [];
  for (const m of input) {
    const from = m?.from === "user" ? "user" : m?.from === "elora" ? "elora" : null;
    if (!from) continue;

    let text = String(m?.text || "").trim();
    if (!text) continue;

    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);

    const ts = Number(m?.ts || Date.now());
    out.push({ from, text, ts });
  }

  // Keep the newest items only
  return out.slice(-MAX_MESSAGES);
}

async function getChat(email) {
  assertKvConfigured();
  const data = await kv.get(key(email));
  if (!data || typeof data !== "object") return { messages: [], updatedAt: 0 };

  const messages = sanitizeMessages(data.messages);
  const updatedAt = Number(data.updatedAt || 0) || 0;

  return { messages, updatedAt };
}

async function setChat(email, messages) {
  assertKvConfigured();
  const clean = sanitizeMessages(messages);
  const payload = { messages: clean, updatedAt: Date.now() };
  await kv.set(key(email), payload);
  return payload;
}

async function clearChat(email) {
  assertKvConfigured();
  await kv.del(key(email));
  return true;
}

module.exports = {
  getChat,
  setChat,
  clearChat,
};
