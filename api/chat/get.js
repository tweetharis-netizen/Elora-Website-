const { verifySessionToken } = require("../_lib/tokens");
const { isEmailVerified } = require("../_lib/verificationStore");
const { getThread } = require("../_lib/chatStore");
const { isKvConfigured } = require("../_lib/kv");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "method_not_allowed" });

  if (!isKvConfigured()) return json(res, 503, { ok: false, error: "kv_not_configured" });

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json(res, 401, { ok: false, error: "missing_session" });

  let email = "";
  try {
    email = verifySessionToken(token).email;
  } catch {
    return json(res, 401, { ok: false, error: "invalid_session" });
  }

  const verified = await isEmailVerified(email).catch(() => false);
  if (!verified) return json(res, 403, { ok: false, error: "not_verified" });

  const threadId = String(req.query?.id || "").trim();
  if (!threadId) return json(res, 400, { ok: false, error: "missing_thread_id" });

  const thread = await getThread(email, threadId);
  if (!thread) return json(res, 404, { ok: false, error: "not_found" });

  return json(res, 200, { ok: true, thread });
};
