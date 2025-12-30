export default function handler(req, res) {
  res.status(410).json({
    ok: false,
    error: "Deprecated. Use /api/verification/confirm via frontend confirm link.",
  });
}
