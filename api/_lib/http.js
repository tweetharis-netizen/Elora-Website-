const { URL } = require("url");

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readStream(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function readJson(req) {
  // Vercel Node functions sometimes provide req.body already.
  if (req && typeof req.body === "object" && req.body !== null) return req.body;

  const raw = await readStream(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("invalid_json");
    err.code = "invalid_json";
    throw err;
  }
}

function parseCookies(req) {
  const header = String(req?.headers?.cookie || "");
  const out = {};
  header.split(";").forEach((part) => {
    const p = part.trim();
    if (!p) return;
    const idx = p.indexOf("=");
    if (idx === -1) return;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function appendSetCookie(res, value) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", value);
    return;
  }
  if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, value]);
    return;
  }
  res.setHeader("Set-Cookie", [String(prev), value]);
}

function isHttps(req) {
  const proto = String(req?.headers?.["x-forwarded-proto"] || "").toLowerCase();
  if (proto) return proto === "https";
  return process.env.NODE_ENV === "production";
}

function makeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(String(value || ""))}`];

  if (opts.maxAgeSeconds != null)
    parts.push(`Max-Age=${Math.max(0, Number(opts.maxAgeSeconds) || 0)}`);
  parts.push(`Path=${opts.path || "/"}`);

  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");

  const sameSite = opts.sameSite || "Lax";
  parts.push(`SameSite=${sameSite}`);

  if (opts.domain) parts.push(`Domain=${opts.domain}`);

  return parts.join("; ");
}

const SESSION_COOKIE = "elora_session";

function setSessionCookie(req, res, token, { maxAgeSeconds = 60 * 60 * 24 * 30 } = {}) {
  const secure = isHttps(req);
  const cookie = makeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAgeSeconds,
  });
  appendSetCookie(res, cookie);
}

function clearSessionCookie(req, res) {
  const secure = isHttps(req);
  const cookie = makeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAgeSeconds: 0,
  });
  appendSetCookie(res, cookie);
}

function frontendUrl() {
  return String(process.env.ELORA_FRONTEND_URL || "").replace(/\/$/, "");
}

function getBaseUrl(req) {
  const env = String(process.env.ELORA_BACKEND_URL || "").replace(/\/$/, "");
  if (env) return env;

  const host = String(req?.headers?.host || "");
  if (!host) return "";
  const proto = String(req?.headers?.["x-forwarded-proto"] || "https");
  return `${proto}://${host}`;
}

function applyCors(req, res) {
  const allowOrigin = frontendUrl();
  const origin = String(req?.headers?.origin || "");
  if (allowOrigin && origin === allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}

function readQuery(req) {
  // req.url is like "/api/...?..."; need a base
  const u = new URL(String(req?.url || ""), "http://local");
  return u.searchParams;
}

function redirect(res, location, code = 302) {
  res.statusCode = code;
  res.setHeader("Location", location);
  res.end();
}

module.exports = {
  json,
  readJson,
  parseCookies,
  SESSION_COOKIE,
  setSessionCookie,
  clearSessionCookie,
  frontendUrl,
  getBaseUrl,
  applyCors,
  readQuery,
  redirect,
};
