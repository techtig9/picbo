export function verifyRenderWorkerSecret(req:Request):boolean{
  const secret=process.env.RENDER_WORKER_SECRET;
  if(!secret)return false; // fail closed: no secret configured means no worker callbacks are accepted
  const provided=req.headers.get("x-render-worker-secret");
  if(!provided)return false;
  // Constant-time-ish comparison isn't critical here (this isn't a signature
  // over attacker-controlled data), but avoid short-circuiting on length regardless.
  return provided.length===secret.length&&provided===secret;
}
