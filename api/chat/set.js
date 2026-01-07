const { json, readJsonBody, requireSessionEmail } = require("../_lib/auth");
const { setChat } = require("../_lib/chatStore");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  const email = requireSessionEmail(req, res);
  if (!email) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "invalid_json" });
  }

  const messages = body?.messages;

  try {
    const saved = await setChat(email, messages);
    return json(res, 200, { ok: true, count: saved.messages.length, updatedAt: saved.updatedAt });
  } catch (e) {
    const code = e?.code === "kv_not_configured" ? "kv_not_configured" : "chat_set_failed";
    return json(res, 500, { ok: false, error: code });
  }
};
