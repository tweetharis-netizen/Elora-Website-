module.exports = async function handler(req, res) {
  res.statusCode = 410;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({
    ok: false,
    error: "Deprecated. Use /api/verification/* endpoints."
  }));
};
