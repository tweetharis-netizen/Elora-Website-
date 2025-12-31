const { kv } = require("@vercel/kv");

function isKvConfigured() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

function assertKvConfigured() {
  if (!isKvConfigured()) {
    const err = new Error(
      "KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN)."
    );
    err.code = "kv_not_configured";
    throw err;
  }
}

module.exports = { kv, isKvConfigured, assertKvConfigured };
