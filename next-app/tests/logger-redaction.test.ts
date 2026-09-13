import test from "node:test";
import assert from "node:assert/strict";
import {redact} from "../lib/observability/logger";

/**
 * Logs are the one place a secret leaks without anyone noticing — nothing
 * breaks, so nobody looks. Relying on every call site to remember what is
 * sensitive is not a plan, so metadata is scrubbed centrally.
 */

const s=(v:unknown)=>JSON.stringify(redact(v));

test("keys whose name implies a secret are redacted",()=>{
  const out=s({api_key:"sk-abcdef1234567890",password:"hunter2",authorization:"Bearer xyz"});
  assert.ok(!out.includes("sk-abcdef1234567890"));
  assert.ok(!out.includes("hunter2"));
  assert.ok(!out.includes("Bearer xyz"));
  assert.ok(out.includes("[redacted]"));
});

test("secret-shaped values are redacted whatever the key is called",()=>{
  // The dangerous case: someone logs `{detail: err.message}` and the message
  // happens to contain a token.
  assert.ok(!s({detail:"failed with sk-1234567890abcdefgh"}).includes("sk-1234"));
  assert.ok(!s({note:"Bearer eyJhbGciOi.eyJzdWIiOi.sig"}).includes("Bearer"));
  assert.ok(!s({info:"key pk_live_abcdefghij1234567890"}).includes("pk_live_abc"));
});

test("a JWT is redacted",()=>{
  const jwt="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  assert.ok(!s({session:jwt}).includes("eyJhbGciOiJIUzI1NiJ9"));
});

test("a signed URL keeps its path but loses its signature",()=>{
  // The path is useful for debugging; the token is what grants access.
  const url="https://x.supabase.co/storage/v1/object/sign/picbo-assets/ws/a/out.png?token=abc123secret";
  const out=redact({url}) as any;
  assert.ok(out.url.includes("picbo-assets/ws/a/out.png"),"path should survive");
  assert.ok(!out.url.includes("abc123secret"),"signature must not");
});

test("ordinary metadata passes through untouched",()=>{
  const out=redact({job_id:"abc",workspace_id:"ws-1",credit_cost:2,ok:true}) as any;
  assert.equal(out.job_id,"abc");
  assert.equal(out.credit_cost,2);
  assert.equal(out.ok,true);
});

test("nested objects are scrubbed too",()=>{
  const out=s({outer:{inner:{secret:"value"},safe:"visible"}});
  assert.ok(!out.includes('"value"'));
  assert.ok(out.includes("visible"));
});

test("an Error becomes a plain object without its stack",()=>{
  // Stacks belong in captureError, not in every info line.
  const out=redact({cause:new Error("boom")}) as any;
  assert.equal(out.cause.name,"Error");
  assert.equal(out.cause.message,"boom");
  assert.equal(out.cause.stack,undefined);
});

test("long strings are truncated so one line cannot swamp the log",()=>{
  const out=redact({blob:"x".repeat(5000)}) as any;
  assert.ok(out.blob.length<2100);
  assert.ok(out.blob.endsWith("…[truncated]"));
});

test("deeply nested structures terminate rather than recursing forever",()=>{
  let deep:any={};
  let cursor=deep;
  for(let i=0;i<30;i++){cursor.next={};cursor=cursor.next}
  assert.doesNotThrow(()=>redact(deep));
  assert.ok(s(deep).includes("depth-limit"));
});

test("a circular structure does not crash the logger",()=>{
  const a:any={name:"a"};
  a.self=a;
  // redact() bounds by depth, so a cycle terminates rather than overflowing.
  assert.doesNotThrow(()=>redact(a));
});

test("arrays are bounded",()=>{
  const out=redact({items:Array.from({length:500},(_,i)=>i)}) as any;
  assert.ok(out.items.length<=50);
});

test("null and undefined survive as themselves",()=>{
  const out=redact({a:null,b:undefined}) as any;
  assert.equal(out.a,null);
  assert.equal(out.b,undefined);
});
