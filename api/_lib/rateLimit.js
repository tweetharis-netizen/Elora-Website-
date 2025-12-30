const { db } = require("./firebaseAdmin");
const { sha256 } = require("./crypto");

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

async function enforceRateLimit({ req, email, cooldownSeconds = 60, maxPerHour = 5 }) {
  const firestore = db();
  const ip = getClientIp(req);
  const now = Date.now();

  const emailKey = sha256(String(email).toLowerCase());
  const ipKey = sha256(ip);

  const col = firestore.collection("verification_rate");

  const emailRef = col.doc(`email_${emailKey}`);
  const ipRef = col.doc(`ip_${ipKey}`);

  await firestore.runTransaction(async (tx) => {
    const [emailSnap, ipSnap] = await Promise.all([tx.get(emailRef), tx.get(ipRef)]);

    const apply = (snap, ref) => {
      const data = snap.exists ? snap.data() : {};
      const windowStart = Number(data.windowStart || now);
      const count = Number(data.count || 0);
      const lastSentAt = Number(data.lastSentAt || 0);

      const hourMs = 60 * 60 * 1000;
      const inWindow = now - windowStart < hourMs;

      const nextWindowStart = inWindow ? windowStart : now;
      const nextCount = inWindow ? count : 0;

      if (lastSentAt && now - lastSentAt < cooldownSeconds * 1000) {
        const wait = Math.ceil((cooldownSeconds * 1000 - (now - lastSentAt)) / 1000);
        const err = new Error(`Please wait ${wait}s before requesting another email.`);
        err.code = "cooldown";
        throw err;
      }

      if (nextCount >= maxPerHour) {
        const err = new Error("Too many requests. Please try again later.");
        err.code = "rate_limited";
        throw err;
      }

      tx.set(
        ref,
        {
          windowStart: nextWindowStart,
          count: nextCount + 1,
          lastSentAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    };

    apply(emailSnap, emailRef);
    apply(ipSnap, ipRef);
  });

  return { ip };
}

module.exports = { enforceRateLimit, getClientIp };
