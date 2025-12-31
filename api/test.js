const { isKvConfigured } = require("./_lib/kv");

module.exports = async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");

  res.end(
    JSON.stringify(
      {
        ELORA_FRONTEND_URL: process.env.ELORA_FRONTEND_URL ? "✅ Set" : "❌ Missing",
        ELORA_VERIFY_JWT_SECRET: process.env.ELORA_VERIFY_JWT_SECRET || process.env.JWT_SECRET ? "✅ Set" : "❌ Missing",
        ELORA_SESSION_JWT_SECRET: process.env.ELORA_SESSION_JWT_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET ? "✅ Set" : "❌ Missing",

        KV_OR_UPSTASH: isKvConfigured()
          ? "✅ Set"
          : "❌ Missing (KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN)",

        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? "✅ Set" : "⚠️ Missing",
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? "✅ Set" : "⚠️ Missing",

        KV_REST_API_URL: process.env.KV_REST_API_URL ? "✅ Set" : "⚠️ Missing",
        KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "✅ Set" : "⚠️ Missing",

        SMTP_USER: process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER ? "✅ Set" : "❌ Missing",
        SMTP_PASS: process.env.EMAIL_SMTP_PASS || process.env.EMAIL_PASS ? "✅ Set" : "❌ Missing",
        SMTP_SERVICE: process.env.EMAIL_SMTP_SERVICE ? "✅ Set" : "⚠️ Optional",
        SMTP_HOST: process.env.EMAIL_SMTP_HOST ? "✅ Set" : "⚠️ Optional",
        EMAIL_FROM: process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER ? "✅ Set" : "❌ Missing",
      },
      null,
      2
    )
  );
};
