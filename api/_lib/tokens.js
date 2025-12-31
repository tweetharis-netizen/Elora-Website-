const jwt = require("jsonwebtoken");
const { randomId } = require("./crypto");

function verifySecret() {
  return process.env.ELORA_VERIFY_JWT_SECRET || process.env.JWT_SECRET || "";
}

function sessionSecret() {
  return process.env.ELORA_SESSION_JWT_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || "";
}

function signVerifyToken({ email, ttlSeconds = 45 * 60 }) {
  const secret = verifySecret();
  if (!secret) throw new Error("missing_verify_secret");

  const e = String(email || "").trim().toLowerCase();
  const jti = randomId(16);

  const token = jwt.sign(
    { typ: "verify", purpose: "verify", email: e, sub: e, jti },
    secret,
    { expiresIn: ttlSeconds, issuer: "elora-website", audience: "elora" }
  );

  return { token, jti, ttlSeconds };
}

function verifyVerifyToken(token) {
  const secret = verifySecret();
  if (!secret) throw new Error("missing_verify_secret");

  const payload = jwt.verify(token, secret, {
    issuer: "elora-website",
    audience: "elora",
    clockTolerance: 120,
  });

  const email = String(payload?.email || payload?.sub || "").trim().toLowerCase();
  const jti = String(payload?.jti || "").trim();

  const ok = (payload?.typ === "verify" || payload?.purpose === "verify") && email && jti;
  if (!ok) throw new Error("invalid");

  return { email, jti, payload };
}

function signSessionToken({ email, ttlSeconds = 60 * 60 * 24 * 30 }) {
  const secret = sessionSecret();
  if (!secret) throw new Error("missing_session_secret");

  const e = String(email || "").trim().toLowerCase();

  return jwt.sign(
    { typ: "session", purpose: "verified_session", v: 1, verified: true, email: e, sub: e },
    secret,
    { expiresIn: ttlSeconds, issuer: "elora-website", audience: "elora-verification-ui" }
  );
}

function verifySessionToken(token) {
  const secret = sessionSecret();
  if (!secret) throw new Error("missing_session_secret");

  const payload = jwt.verify(token, secret, {
    issuer: "elora-website",
    audience: "elora-verification-ui",
    clockTolerance: 120,
  });

  const email = String(payload?.email || payload?.sub || "").trim().toLowerCase();
  const ok =
    !!email &&
    ((payload?.typ === "session" && payload?.verified === true) ||
      (payload?.purpose === "verified_session" && payload?.v === 1));

  if (!ok) throw new Error("invalid");
  return { email, payload };
}

module.exports = {
  signVerifyToken,
  verifyVerifyToken,
  signSessionToken,
  verifySessionToken,
};
