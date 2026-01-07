const { verifySessionToken } = require("../_lib/tokens");
const { isEmailVerified } = require("../_lib/verificationStore");
const { createThread } = require("../_lib/chatStore");
const { isKvConfigured } = require("../_lib/kv");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

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

  let body = {};
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch {
    body = {};
  }

  const title = typeof body.title === "string" ? body.title : "New chat";
  const created = await createThread(email, { title });

  return json(res, 200, { ok: true, id: created.id, thread: created.thread });
};
