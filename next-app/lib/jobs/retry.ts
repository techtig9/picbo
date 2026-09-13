export interface RetryPolicy{maxAttempts:number;baseDelayMs:number;maxDelayMs:number;}
export const DEFAULT_RETRY_POLICY:RetryPolicy={maxAttempts:3,baseDelayMs:1000,maxDelayMs:30000};
export function retryDelay(attempt:number,p=DEFAULT_RETRY_POLICY){
  const exp=Math.min(p.maxDelayMs,p.baseDelayMs*Math.pow(2,Math.max(0,attempt-1)));
  return exp+Math.floor(Math.random()*Math.max(1,Math.floor(exp*.2)));
}
export function canRetry(attempt:number,p=DEFAULT_RETRY_POLICY){return attempt<p.maxAttempts;}
