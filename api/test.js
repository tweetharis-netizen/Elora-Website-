module.exports = function handler(req, res) {
  res.status(200).json({
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "✅ Set" : "❌ Missing",
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "✅ Set" : "❌ Missing",
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "✅ Set" : "❌ Missing",
    ELORA_VERIFY_JWT_SECRET: process.env.ELORA_VERIFY_JWT_SECRET ? "✅ Set" : "❌ Missing",
    ELORA_SESSION_JWT_SECRET: process.env.ELORA_SESSION_JWT_SECRET ? "✅ Set" : "❌ Missing",
    EMAIL_SMTP_HOST: process.env.EMAIL_SMTP_HOST ? "✅ Set" : "❌ Missing",
    EMAIL_SMTP_USER: (process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER) ? "✅ Set" : "❌ Missing",
  });
};
