const { kv } = require("@vercel/kv");

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function assertKvConfigured() {
  if (!isKvConfigured()) {
    const err = new Error("KV not configured (KV_REST_API_URL / KV_REST_API_TOKEN missing).");
    err.code = "kv_not_configured";
    throw err;
  }
}

module.exports = { kv, isKvConfigured, assertKvConfigured };
