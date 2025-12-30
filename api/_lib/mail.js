const nodemailer = require("nodemailer");

function getTransport() {
  // Support both old env names and new ones
  const host = process.env.EMAIL_SMTP_HOST;
  const port = Number(process.env.EMAIL_SMTP_PORT || "465");
  const secure = String(process.env.EMAIL_SMTP_SECURE || "true") === "true";

  const user =
    process.env.EMAIL_SMTP_USER ||
    process.env.EMAIL_USER ||
    "";
  const pass =
    process.env.EMAIL_SMTP_PASS ||
    process.env.EMAIL_PASS ||
    "";

  const service = process.env.EMAIL_SMTP_SERVICE; // optional (e.g. "gmail")

  if (service) {
    if (!user || !pass) throw new Error("Missing EMAIL_SMTP_USER/EMAIL_SMTP_PASS for service transport.");
    return nodemailer.createTransport({ service, auth: { user, pass } });
  }

  if (!host) throw new Error("Missing EMAIL_SMTP_HOST (or set EMAIL_SMTP_SERVICE=gmail).");
  if (!user || !pass) throw new Error("Missing EMAIL_SMTP_USER/EMAIL_SMTP_PASS (or EMAIL_USER/EMAIL_PASS).");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function getFrom() {
  return (
    process.env.EMAIL_FROM ||
    process.env.EMAIL_SMTP_USER ||
    process.env.EMAIL_USER ||
    ""
  );
}

async function sendMail({ to, subject, html, text }) {
  const transport = getTransport();
  const from = getFrom();
  if (!from) throw new Error("Missing EMAIL_FROM (or EMAIL_SMTP_USER/EMAIL_USER).");

  await transport.sendMail({
    from: `Elora <${from}>`,
    to,
    subject,
    html,
    text,
  });
}

module.exports = { sendMail };
