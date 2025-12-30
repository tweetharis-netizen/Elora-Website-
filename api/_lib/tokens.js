const jwt = require("jsonwebtoken");
const { randomId } = require("./crypto");

function verifySecret() {
  return (
    process.env.ELORA_VERIFY_JWT_SECRET ||
    process.env.ELORA_VERIFY_SECRET ||
    process.env.VERIFY_TOKEN_SECRET ||
    ""
  );
}

function sessionSecret() {
  return (
    process.env.ELORA_SESSION_JWT_SECRET ||
    process.env.JWT_SECRET ||
    ""
  );
}

function signVerifyToken({ email, ttlSeconds = 15 * 60 }) {
  const secret = verifySecret();
  if (!secret) throw new Error("Missing ELORA_VERIFY_JWT_SECRET.");

  const jti = randomId(16);
  const token = jwt.sign(
    { sub: email, jti, typ: "verify" },
    secret,
    {
      expiresIn: ttlSeconds,
      issuer: "elora-website",
      audience: "elora",
    }
  );
  return { token, jti, ttlSeconds };
}

function verifyVerifyToken(token) {
  const secret = verifySecret();
  if (!secret) throw new Error("Missing ELORA_VERIFY_JWT_SECRET.");

  const payload = jwt.verify(token, secret, {
    issuer: "elora-website",
    audience: "elora",
    clockTolerance: 120, // tolerate skew
  });

  if (payload?.typ !== "verify") throw new Error("Invalid token type.");
  return payload; // { sub=email, jti, ... }
}

function signSessionToken({ email, ttlSeconds = 60 * 60 * 24 * 30 }) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Missing ELORA_SESSION_JWT_SECRET (or JWT_SECRET).");

  return jwt.sign(
    { sub: email, verified: true, typ: "session" },
    secret,
    {
      expiresIn: ttlSeconds,
      issuer: "elora-website",
      audience: "elora-verification-ui",
    }
  );
}

function verifySessionToken(token) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Missing ELORA_SESSION_JWT_SECRET (or JWT_SECRET).");

  const payload = jwt.verify(token, secret, {
    issuer: "elora-website",
    audience: "elora-verification-ui",
    clockTolerance: 120,
  });

  if (payload?.typ !== "session") throw new Error("Invalid session token type.");
  return payload; // { sub=email, verified:true }
}

module.exports = {
  signVerifyToken,
  verifyVerifyToken,
  signSessionToken,
  verifySessionToken,
};
