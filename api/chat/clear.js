const { json, requireSessionEmail } = require("../_lib/auth");
const { clearChat } = require("../_lib/chatStore");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  const email = requireSessionEmail(req, res);
  if (!email) return;

  try {
    await clearChat(email);
    return json(res, 200, { ok: true });
  } catch (e) {
    const code = e?.code === "kv_not_configured" ? "kv_not_configured" : "chat_clear_failed";
    return json(res, 500, { ok: false, error: code });
  }
};
