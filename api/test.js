export default function handler(req, res) {
  const envs = [
    "OPENROUTER_API_KEY",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_ELORA_ACCESS_CODE"
  ];

  const result = envs.reduce((acc, key) => {
    acc[key] = process.env[key] ? "✅ Set" : "❌ Missing";
    return acc;
  }, {});

  res.status(200).json(result);
}
