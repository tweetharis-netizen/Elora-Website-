export default function handler(req, res) {
  res.status(200).json({
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? "✅ Set" : "❌ Missing",
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "✅ Set" : "❌ Missing",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "✅ Set" : "❌ Missing"
  });
}
