// Legacy endpoint kept for compatibility.
// Prefer /api/verification/confirm
const confirm = require("./verification/confirm");

module.exports = async function handler(req, res) {
  // Allow GET token query (old flow) by converting to POST body.
  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token") || "";
    req.method = "POST";
    req.on = (ev, cb) => {
      if (ev === "data") cb(Buffer.from(JSON.stringify({ token })));
      if (ev === "end") cb();
    };
  }
  return confirm(req, res);
};
