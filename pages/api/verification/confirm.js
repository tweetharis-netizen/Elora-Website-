function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

function getCookieDomainFromHost(host) {
  // Persist sessions across Vercel preview deployments within the same base domain.
  // Example:
  //   elora-verification-xxxxx-haris-projects-20c5a383.vercel.app
  // => Domain=.haris-projects-20c5a383.vercel.app
  //
  // NOTE: Do NOT set Domain=.vercel.app (public suffix; browsers reject it).
  const h = String(host || "").trim().toLowerCase();
  if (!h) return null;
  if (h.startsWith("localhost")) return null;

  const parts = h.split(".");
  if (parts.length < 3) return null; // needs at least subdomain + domain + tld
  if (parts.slice(-2).join(".") === "vercel.app") {
    // Use the team base domain (everything except the preview name)
    // e.g. xxxxx-haris-projects-20c5a383.vercel.app -> .haris-projects-20c5a383.vercel.app
    if (parts.length >= 4) return "." + parts.slice(-4).join(".");
    return null;
  }
  // For custom domains, letting the browser default is usually best.
  return null;
}

export default async function handler(req, res) {
  const backend = (process.env.NEXT_PUBLIC_ELORA_BACKEND_URL || "https://elora-website.vercel.app").replace(/\/$/, "");
  const token = typeof req.query.token === "string" ? req.query.token : "";

  if (!token) return res.redirect("/verify?error=invalid");

  try {
    const r = await fetch(`${backend}/api/verification/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok || !data?.ok) {
      const err = data?.error ? String(data.error) : "invalid";
      return res.redirect(`/verify?error=${encodeURIComponent(err)}`);
    }

    const sessionToken = data?.sessionToken || data?.sessionJwt || "";
    if (!sessionToken) return res.redirect("/verify?error=invalid");

    const secure = process.env.NODE_ENV === "production";
    const domain = getCookieDomainFromHost(req.headers.host);

    setCookie(res, "elora_session", sessionToken, {
      path: "/",
      domain: domain || undefined,
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res.redirect(req.query.redirect || `/verified?email=${encodeURIComponent(data.email || "")}`);
  } catch {
    return res.redirect("/verify?error=backend_unreachable");
  }
}
