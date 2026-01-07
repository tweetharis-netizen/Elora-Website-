const { verifySessionToken } = require("./tokens");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function getBearerToken(req) {
  const h = String(req?.headers?.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1] || "").trim() : "";
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Auth is session token in Authorization: Bearer <token>.
 * Returns email if valid; otherwise responds and returns null.
 */
function requireSessionEmail(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    json(res, 401, { ok: false, error: "missing_session" });
    return null;
  }

  try {
    const { email } = verifySessionToken(token);
    return email;
  } catch (e) {
    const code = e?.name === "TokenExpiredError" ? "session_expired" : "invalid_session";
    json(res, 401, { ok: false, error: code });
    return null;
  }
}

module.exports = {
  json,
  readJsonBody,
  requireSessionEmail,
};
