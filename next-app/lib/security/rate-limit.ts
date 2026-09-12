import {createAdminClient} from "@/lib/supabase/admin";
import {log} from "@/lib/observability/logger";

/**
 * Per-user rate limiting for authenticated routes.
 *
 * Only the developer API had a limit. Everything a signed-in user can call —
 * generation, Lumi, uploads — was unbounded. Credits cap *spend*, but they do
 * not cap request volume: a script can hammer /api/lumi/chat until it runs out
 * of credits, and uploads cost no credits at all, so nothing stopped a
 * workspace filling storage as fast as its connection allowed.
 *
 * Counted in Postgres rather than in memory: a serverless instance's
 * in-process counter resets on every cold start, which silently stops
 * limiting exactly when traffic is highest.
 */

export interface RateLimitRule{
  /** Stable identifier used as part of the counter key. */
  action:string;
  limit:number;
  windowSeconds:number;
}

export const RATE_LIMITS={
  /** Generation is credit-gated too; this stops burst abuse and runaway loops. */
  generate:{action:"generate",limit:30,windowSeconds:60},
  /** Lumi costs a credit per turn, but a chat loop can still be scripted. */
  lumi:{action:"lumi",limit:20,windowSeconds:60},
  /** Uploads cost no credits, so volume is the only control. */
  upload:{action:"upload",limit:40,windowSeconds:300},
  /** Password reset: limits both inbox flooding and account enumeration. */
  passwordReset:{action:"password_reset",limit:5,windowSeconds:900}
} as const satisfies Record<string,RateLimitRule>;

export interface RateLimitResult{
  allowed:boolean;
  limit:number;
  remaining:number;
  resetSeconds:number;
}

/**
 * Consumes one unit against a rule.
 *
 * Fails **open** on an infrastructure error. That is a deliberate trade: a
 * rate limiter that cannot reach its store would otherwise take the whole
 * product down, and the failure is logged so it is visible rather than silent.
 */
export async function consumeRateLimit(
  subjectId:string,
  rule:RateLimitRule
):Promise<RateLimitResult>{
  const base={limit:rule.limit,remaining:rule.limit-1,resetSeconds:rule.windowSeconds};

  try{
    const supabase=createAdminClient();
    const {data,error}=await supabase.rpc("consume_rate_limit",{
      subject:subjectId,
      action_name:rule.action,
      max_requests:rule.limit,
      window_seconds:rule.windowSeconds
    });

    if(error){
      log("error","rate_limit.store_unavailable",{action:rule.action,message:error.message});
      return {allowed:true,...base};
    }

    const used=Number(data??0);
    const allowed=used<=rule.limit;
    if(!allowed){
      log("warn","rate_limit.exceeded",{action:rule.action,subject:subjectId,used});
    }

    return {
      allowed,
      limit:rule.limit,
      remaining:Math.max(0,rule.limit-used),
      resetSeconds:rule.windowSeconds
    };
  }catch(e:any){
    log("error","rate_limit.error",{action:rule.action,message:e?.message});
    return {allowed:true,...base};
  }
}

/** Standard headers so a client can back off before it gets a 429. */
export function rateLimitHeaders(r:RateLimitResult):Record<string,string>{
  const headers:Record<string,string>={
    "x-ratelimit-limit":String(r.limit),
    "x-ratelimit-remaining":String(r.remaining),
    "x-ratelimit-reset":String(r.resetSeconds)
  };
  if(!r.allowed)headers["retry-after"]=String(r.resetSeconds);
  return headers;
}

export const TOO_MANY_REQUESTS_MESSAGE=
  "You're sending requests faster than we can process them. Wait a moment and try again.";
