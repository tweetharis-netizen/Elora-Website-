const nodemailer = require("nodemailer");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function buildTransport() {
  const service = process.env.EMAIL_SMTP_SERVICE || "";
  const host = process.env.EMAIL_SMTP_HOST || "";
  const port = Number(process.env.EMAIL_SMTP_PORT || "465");
  const secure = String(process.env.EMAIL_SMTP_SECURE || "true") === "true";

  const user = process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER || "";
  const pass = process.env.EMAIL_SMTP_PASS || process.env.EMAIL_PASS || "";

  if (!user || !pass) throw new Error("smtp_auth_missing");

  if (service) {
    return nodemailer.createTransport({ service, auth: { user, pass } });
  }

  if (!host) throw new Error("smtp_host_missing");

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

function classify(e) {
  const msg = String(e?.message || "").toLowerCase();
  const code = String(e?.code || "").toLowerCase();
  if (msg.includes("smtp_auth_missing") || code === "eauth" || msg.includes("535") || msg.includes("password not accepted")) return "smtp_auth_failed";
  if (msg.includes("smtp_host_missing")) return "smtp_config_missing";
  if (code === "esocket" || code === "etimedout" || msg.includes("timeout")) return "smtp_timeout";
  if (msg.includes("enotfound") || msg.includes("econnrefused")) return "smtp_connect_failed";
  return "smtp_check_failed";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "method_not_allowed" });

  try {
    const t = buildTransport();
    await t.verify();
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error("SMTP CHECK FAILED:", e?.message || e);
    return json(res, 200, { ok: false, error: classify(e) });
  }
};
