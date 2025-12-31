const { kv } = require("@vercel/kv");

// Vercel KV native uses KV_REST_*
// Upstash Redis via Vercel Marketplace injects UPSTASH_REDIS_REST_*
function isKvConfigured() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

function assertKvConfigured() {
  if (!isKvConfigured()) {
    const err = new Error(
      "KV not configured. Set KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN."
    );
    err.code = "kv_not_configured";
    throw err;
  }
}

module.exports = { kv, isKvConfigured, assertKvConfigured };
