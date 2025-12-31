const { kv, assertKvConfigured } = require("./kv");
const { sha256 } = require("./crypto");

function todayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailHash(email) {
  return sha256(normEmail(email));
}

function ipHash(ip) {
  return sha256(String(ip || "").trim());
}

function keyVerifiedEmail(email) {
  return `elora:verified:email:${emailHash(email)}`;
}

function keyUsedJti(jti) {
  return `elora:verify:usedjti:${String(jti || "").trim()}`;
}

function keyCooldownIp(ip) {
  return `elora:rl:verify_send:ip:${ipHash(ip)}`;
}

function keyCooldownEmail(email) {
  return `elora:rl:verify_send:email:${emailHash(email)}`;
}

function keyDailyIp(ip) {
  return `elora:rl:verify_send:ip_daily:${ipHash(ip)}:${todayKey()}`;
}

function keyDailyEmail(email) {
  return `elora:rl:verify_send:email_daily:${emailHash(email)}:${todayKey()}`;
}

async function ttlSeconds(key) {
  const ttl = await kv.ttl(key);
  return typeof ttl === "number" && ttl > 0 ? ttl : 0;
}

async function setNxEx(key, seconds) {
  const res = await kv.set(key, "1", { nx: true, ex: seconds });
  return res === "OK";
}

async function incrWithExpiry(key, ttl) {
  const n = await kv.incr(key);
  if (n === 1) await kv.expire(key, ttl);
  return n;
}

async function enforceSendLimits({
  ip,
  email,
  cooldownSeconds = 60,
  dailyMaxPerIp = 25,
  dailyMaxPerEmail = 10,
}) {
  assertKvConfigured();

  const okIp = await setNxEx(keyCooldownIp(ip), cooldownSeconds);
  if (!okIp) return { ok: false, error: "rate_limited", retryAfter: (await ttlSeconds(keyCooldownIp(ip))) || cooldownSeconds };

  const okEmail = await setNxEx(keyCooldownEmail(email), cooldownSeconds);
  if (!okEmail) return { ok: false, error: "rate_limited", retryAfter: (await ttlSeconds(keyCooldownEmail(email))) || cooldownSeconds };

  const ipCount = await incrWithExpiry(keyDailyIp(ip), 60 * 60 * 24);
  if (ipCount > dailyMaxPerIp) return { ok: false, error: "rate_limited", retryAfter: (await ttlSeconds(keyDailyIp(ip))) || 60 * 60 * 24 };

  const emailCount = await incrWithExpiry(keyDailyEmail(email), 60 * 60 * 24);
  if (emailCount > dailyMaxPerEmail) return { ok: false, error: "rate_limited", retryAfter: (await ttlSeconds(keyDailyEmail(email))) || 60 * 60 * 24 };

  return { ok: true };
}

async function markEmailVerified(email) {
  assertKvConfigured();
  await kv.set(keyVerifiedEmail(email), "1");
}

async function isEmailVerified(email) {
  assertKvConfigured();
  const v = await kv.get(keyVerifiedEmail(email));
  return v === "1" || v === 1 || v === true;
}

async function isJtiUsed(jti) {
  assertKvConfigured();
  const v = await kv.get(keyUsedJti(jti));
  return v === "1" || v === 1 || v === true;
}

async function markJtiUsed(jti, ttl = 60 * 60 * 24 * 2) {
  assertKvConfigured();
  await kv.set(keyUsedJti(jti), "1", { nx: true, ex: ttl });
}

module.exports = {
  normEmail,
  enforceSendLimits,
  markEmailVerified,
  isEmailVerified,
  isJtiUsed,
  markJtiUsed,
};
