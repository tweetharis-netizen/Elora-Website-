const { kv } = require("@vercel/kv");

function isKvConfigured() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return Boolean(url && token);
}

function assertKvConfigured() {
  if (!isKvConfigured()) {
    const err = new Error("Vercel KV is not configured. Missing KV_REST_API_URL / KV_REST_API_TOKEN.");
    err.code = "kv_not_configured";
    throw err;
  }
}

module.exports = { kv, isKvConfigured, assertKvConfigured };
