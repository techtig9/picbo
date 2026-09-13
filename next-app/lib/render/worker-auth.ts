import crypto from "crypto";

/**
 * Verifies the shared secret an external render worker presents.
 *
 * Fails closed: with no RENDER_WORKER_SECRET configured, no worker callback is
 * accepted at all, so an unconfigured deployment cannot be driven by anyone
 * who guesses the endpoint.
 *
 * The comparison is constant-time. The previous version used
 * `provided.length===secret.length && provided===secret`, and JavaScript
 * string equality short-circuits on the first differing byte — which leaks the
 * length outright and, over enough requests, the secret itself.
 */
export function verifyRenderWorkerSecret(req:Request):boolean{
  const secret=process.env.RENDER_WORKER_SECRET;
  if(!secret)return false;
  const provided=req.headers.get("x-render-worker-secret");
  if(!provided)return false;

  const a=Buffer.from(provided,"utf8");
  const b=Buffer.from(secret,"utf8");
  // timingSafeEqual throws on a length mismatch, so hash both sides first:
  // equal-length digests keep the comparison itself constant-time.
  const ha=crypto.createHash("sha256").update(a).digest();
  const hb=crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha,hb);
}
