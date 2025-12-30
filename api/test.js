module.exports = async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({
    ELORA_FRONTEND_URL: process.env.ELORA_FRONTEND_URL ? "✅ Set" : "❌ Missing",
    ELORA_VERIFY_JWT_SECRET: process.env.ELORA_VERIFY_JWT_SECRET ? "✅ Set" : "❌ Missing",
    ELORA_SESSION_JWT_SECRET: process.env.ELORA_SESSION_JWT_SECRET ? "✅ Set" : "❌ Missing",
    SMTP: (process.env.EMAIL_SMTP_SERVICE || process.env.EMAIL_SMTP_HOST) ? "✅ Set" : "❌ Missing",
    EMAIL_FROM: process.env.EMAIL_FROM ? "✅ Set" : "❌ Missing"
  }));
};
