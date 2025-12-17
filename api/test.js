
export default function handler(req, res) {
  res.status(200).json({
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? "✅ Set" : "❌ Missing",
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "✅ Set" : "❌ Missing",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "✅ Set" : "❌ Missing",
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "✅ Set" : "❌ Missing",
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "✅ Set" : "❌ Missing",
    RESEND_SENDER_EMAIL: process.env.RESEND_SENDER_EMAIL ? "✅ Set" : "❌ Missing"
  });
}
