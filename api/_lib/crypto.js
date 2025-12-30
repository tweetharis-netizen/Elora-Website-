const crypto = require("crypto");

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function randomId(bytes = 18) {
  return crypto.randomBytes(bytes).toString("base64url");
}

module.exports = { sha256, randomId };
