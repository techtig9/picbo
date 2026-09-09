export const RETRYABLE_PROVIDER_ERRORS=[
  "RATE_LIMIT","TIMEOUT","TEMPORARY_UNAVAILABLE","OVERLOADED","QUOTA_EXCEEDED","UPSTREAM_ERROR"
] as const;
export const PERMANENT_PROVIDER_ERRORS=[
  "MISSING_KEY","INVALID_KEY","AUTH_ERROR","INSUFFICIENT_BALANCE","MODEL_UNAVAILABLE","UNSUPPORTED_TASK","EMPTY_OUTPUT"
] as const;
export function isRetryableProviderError(code:string){return (RETRYABLE_PROVIDER_ERRORS as readonly string[]).includes(code)}

/**
 * Normalizes a provider HTTP response into a standardized error code.
 * Distinguishes transient failures (worth retrying / falling back) from
 * permanent ones (skip straight to the next provider, don't burn retries).
 */
export function classifyProviderHttpError(status:number,bodyText?:string):{code:string;retryable:boolean}{
  const text=(bodyText||"").toLowerCase();
  if(status===401||status===403)return {code:"AUTH_ERROR",retryable:false};
  if(status===402||text.includes("insufficient")&&text.includes("balance"))return {code:"INSUFFICIENT_BALANCE",retryable:false};
  if(status===404)return {code:"MODEL_UNAVAILABLE",retryable:false};
  if(status===429){
    if(text.includes("quota")||text.includes("monthly")||text.includes("daily"))return {code:"QUOTA_EXCEEDED",retryable:true};
    return {code:"RATE_LIMIT",retryable:true};
  }
  if(status===408)return {code:"TIMEOUT",retryable:true};
  if(status===503)return {code:"OVERLOADED",retryable:true};
  if(status>=500)return {code:"TEMPORARY_UNAVAILABLE",retryable:true};
  if(status>=400)return {code:"UPSTREAM_ERROR",retryable:false};
  return {code:"UPSTREAM_ERROR",retryable:true};
}

export function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms))}

/** Exponential backoff delay (with jitter) for retry attempt N (0-indexed). */
export function backoffDelayMs(attempt:number){
  const base=300*Math.pow(2,attempt);
  const jitter=Math.floor(Math.random()*100);
  return Math.min(base+jitter,4000);
}

