const { kv, assertKvConfigured } = require("./kv");
const { sha256 } = require("./crypto");

// KV-backed role storage.
// Roles are authoritative server-side; the frontend only reflects these.
//
// Stored by hashed email to avoid leaking emails via KV keys.

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function keyRole(email) {
  const hash = sha256(normEmail(email));
  return `elora:role:email:${hash}`;
}

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  return r === "teacher" ? "teacher" : "regular";
}

async function getRole(email) {
  assertKvConfigured();
  const v = await kv.get(keyRole(email));
  const r = String(v || "").trim().toLowerCase();
  return r === "teacher" ? "teacher" : "regular";
}

async function setRole(email, role) {
  assertKvConfigured();
  await kv.set(keyRole(email), normalizeRole(role));
}

module.exports = { getRole, setRole };
