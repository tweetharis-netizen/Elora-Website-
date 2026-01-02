const { verifySessionToken } = require("../_lib/tokens");
const { isEmailVerified } = require("../_lib/verificationStore");
const { setRole } = require("../_lib/roleStore");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function parseInviteCodes(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json(res, 401, { ok: false, error: "missing_session" });

  let email = "";
  try {
    email = verifySessionToken(token).email;
  } catch {
    return json(res, 401, { ok: false, error: "invalid_session" });
  }

  // Must be verified to redeem teacher access.
  try {
    const verified = await isEmailVerified(email);
    if (!verified) return json(res, 403, { ok: false, error: "not_verified" });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: e?.code === "kv_not_configured" ? "kv_not_configured" : "verify_check_failed",
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "invalid_json" });
  }

  const code = String(body.code || "").trim();

  // Allow clearing teacher role by submitting an empty code.
  if (!code) {
    try {
      await setRole(email, "regular");
      return json(res, 200, { ok: true, role: "regular" });
    } catch (e) {
      return json(res, 500, {
        ok: false,
        error: e?.code === "kv_not_configured" ? "kv_not_configured" : "persist_failed",
      });
    }
  }

  const allowList = parseInviteCodes(process.env.TEACHER_INVITE_CODES || process.env.ELORA_TEACHER_INVITE_CODES);
  if (!allowList.length) {
    return json(res, 500, { ok: false, error: "teacher_invites_not_configured" });
  }

  if (!allowList.includes(code)) {
    return json(res, 401, { ok: false, error: "invalid_code" });
  }

  try {
    await setRole(email, "teacher");
    return json(res, 200, { ok: true, role: "teacher" });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: e?.code === "kv_not_configured" ? "kv_not_configured" : "persist_failed",
    });
  }
};
