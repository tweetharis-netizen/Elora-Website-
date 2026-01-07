const { verifyVerifyToken, signSessionToken } = require("../_lib/tokens");
const { isJtiUsed, markJtiUsed, markEmailVerified } = require("../_lib/verificationStore");

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

function looksLikeJwt(s) {
  return typeof s === "string" && s.split(".").length === 3;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "invalid_json" });
  }

  const code = String(body?.code || "").trim();
  if (!code) return json(res, 400, { ok: false, error: "missing_code" });
  if (!looksLikeJwt(code)) return json(res, 400, { ok: false, error: "invalid" });

  let email, jti;
  try {
    const v = verifyVerifyToken(code);
    email = v.email;
    jti = v.jti;
  } catch (e) {
    const msg = e?.name === "TokenExpiredError" ? "expired" : "invalid";
    return json(res, 400, { ok: false, error: msg });
  }

  try {
    if (await isJtiUsed(jti)) return json(res, 400, { ok: false, error: "used" });
    await markJtiUsed(jti);
    await markEmailVerified(email);
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: e?.code === "kv_not_configured" ? "kv_not_configured" : "persist_failed",
    });
  }

  const sessionToken = signSessionToken({ email });
  return json(res, 200, { ok: true, email, sessionToken });
};
