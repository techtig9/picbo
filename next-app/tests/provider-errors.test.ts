import {test} from "node:test";
import assert from "node:assert/strict";
import {classifyProviderHttpError,isRetryableProviderError,backoffDelayMs} from "../lib/ai/provider-errors";

test("429 without quota language classifies as retryable RATE_LIMIT",()=>{
  const r=classifyProviderHttpError(429,"rate limit exceeded, please retry");
  assert.equal(r.code,"RATE_LIMIT");
  assert.equal(r.retryable,true);
});

test("429 with quota language classifies as retryable QUOTA_EXCEEDED",()=>{
  const r=classifyProviderHttpError(429,"daily quota exceeded");
  assert.equal(r.code,"QUOTA_EXCEEDED");
  assert.equal(r.retryable,true);
});

test("401/403 classify as permanent AUTH_ERROR",()=>{
  assert.equal(classifyProviderHttpError(401,"").code,"AUTH_ERROR");
  assert.equal(classifyProviderHttpError(401,"").retryable,false);
  assert.equal(classifyProviderHttpError(403,"").retryable,false);
});

test("404 classifies as permanent MODEL_UNAVAILABLE",()=>{
  const r=classifyProviderHttpError(404,"");
  assert.equal(r.code,"MODEL_UNAVAILABLE");
  assert.equal(r.retryable,false);
});

test("5xx classifies as retryable TEMPORARY_UNAVAILABLE",()=>{
  const r=classifyProviderHttpError(500,"");
  assert.equal(r.code,"TEMPORARY_UNAVAILABLE");
  assert.equal(r.retryable,true);
});

test("503 classifies as retryable OVERLOADED",()=>{
  const r=classifyProviderHttpError(503,"");
  assert.equal(r.code,"OVERLOADED");
  assert.equal(r.retryable,true);
});

test("isRetryableProviderError matches the retryable code set only",()=>{
  assert.equal(isRetryableProviderError("RATE_LIMIT"),true);
  assert.equal(isRetryableProviderError("TIMEOUT"),true);
  assert.equal(isRetryableProviderError("AUTH_ERROR"),false);
  assert.equal(isRetryableProviderError("MISSING_KEY"),false);
});

test("backoffDelayMs grows exponentially and stays capped",()=>{
  const d0=backoffDelayMs(0), d1=backoffDelayMs(1), d5=backoffDelayMs(5);
  assert.ok(d0>=300&&d0<400);
  assert.ok(d1>=600&&d1<700);
  assert.ok(d5<=4000);
});
