import test from "node:test";
import assert from "node:assert/strict";
import {creditCostForTask,TASK_CREDIT_COSTS} from "../lib/billing/credits";
import {classifyJobFailure} from "../lib/ai/jobs";
import {NoOutputError} from "../lib/generation/persist-output";
import {MediaValidationError} from "../lib/generation/media-validation";

/**
 * The credit price used to come from the request body
 * (`Number(body.creditCost||1)`), so a client could request a 10-credit video
 * and charge itself 1. These pin the server-side price list.
 */

test("a video costs more than an image, which costs more than text",()=>{
  assert.ok(creditCostForTask("video")>creditCostForTask("image"));
  assert.ok(creditCostForTask("image")>creditCostForTask("chat"));
});

test("video is priced at its real cost, not the old client-supplied 1",()=>{
  assert.equal(creditCostForTask("video"),10);
});

test("every task has a price of at least 1",()=>{
  // reserve_credits() raises INVALID_CREDIT_AMOUNT on a non-positive amount,
  // so a zero-priced task would fail at submission rather than be free.
  for(const task of Object.keys(TASK_CREDIT_COSTS) as Array<keyof typeof TASK_CREDIT_COSTS>){
    assert.ok(creditCostForTask(task)>=1,`${task} must cost at least 1 credit`);
  }
});

test("an unknown task falls back to a positive price",()=>{
  assert.ok(creditCostForTask("something_new" as any)>=1);
});

test("the price is a pure function of the task — no client input reaches it",()=>{
  assert.equal(creditCostForTask("image"),creditCostForTask("image"));
  assert.equal(creditCostForTask.length,1);
});

/**
 * Failure messages reach the studio directly, so they must be actionable and
 * must never leak the provider chain. The old UI surfaced raw strings like
 * "ALL_PROVIDERS_FAILED: groq/gpt-oss-120b (attempt 1): ...".
 */

test("no output is reported as a refunded failure, not a success",()=>{
  const {code,message}=classifyJobFailure(new NoOutputError("no images"));
  assert.equal(code,"NO_OUTPUT");
  assert.match(message,/refunded/i);
});

test("a provider chain failure is explained without naming the chain",()=>{
  const err=Object.assign(new Error("All eligible AI providers failed: groq/x | cerebras/y"),{code:"ALL_PROVIDERS_FAILED"});
  const {code,message}=classifyJobFailure(err);
  assert.equal(code,"ALL_PROVIDERS_FAILED");
  assert.match(message,/refunded/i);
  assert.ok(!message.includes("groq"),"must not leak provider/model internals to the user");
  assert.ok(!message.includes("cerebras"));
});

test("a media validation failure keeps its specific, user-readable cause",()=>{
  const {code,message}=classifyJobFailure(
    new MediaValidationError("The provider returned a text response instead of an image or video.","UNSUPPORTED_FORMAT")
  );
  assert.equal(code,"UNSUPPORTED_FORMAT");
  assert.match(message,/text response/);
  assert.match(message,/refunded/i);
});

test("a storage quota failure tells the user what to do",()=>{
  const {code,message}=classifyJobFailure(new Error("STORAGE_QUOTA_EXCEEDED: using 1.00GB of 1GB on the free plan. Upgrade or free up space to continue."));
  assert.equal(code,"STORAGE_QUOTA_EXCEEDED");
  assert.match(message,/Upgrade/);
  assert.ok(!message.includes("STORAGE_QUOTA_EXCEEDED:"),"internal code prefix should be stripped");
});

test("an unrecognised error still promises the refund that actually happened",()=>{
  const {message}=classifyJobFailure(new Error("socket hang up"));
  assert.match(message,/refunded/i);
  assert.ok(!message.includes("socket hang up"),"raw internal errors are for logs, not users");
});
