export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { role, message } = req.body;

  if (!role || !message) {
    return res.status(400).json({ error: "Missing data" });
  }

  let systemPrompt = "";

  if (role === "teacher" || role === "tutor") {
    systemPrompt = `
You are Elora, an AI teaching assistant for educators.
You help create lesson plans, teaching strategies, and structured content.
Be professional, clear, and helpful.
    `;
  } else {
    systemPrompt = `
You are Elora, an AI learning assistant for students and parents.
You explain concepts clearly and give hints.
You must NOT give direct answers to homework or exams.
Guide understanding instead of solving.
    `;
  }

  // 🔒 TEMPORARY MOCK (GENESIS SAFE)
  // Replace with OpenAI later
  const reply =
    role === "teacher" || role === "tutor"
      ? `Educator mode response:\n\nI can help you design a lesson around "${message}".`
      : `Learning mode response:\n\nLet’s think about "${message}" step by step. What do you already know about it?`;

  return res.status(200).json({ reply });
}
