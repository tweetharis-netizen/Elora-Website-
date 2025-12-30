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
