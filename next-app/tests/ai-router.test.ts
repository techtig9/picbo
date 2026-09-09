import {test} from "node:test";
import assert from "node:assert/strict";
import {generateWithFallback} from "../lib/ai/router";
import type {ProviderAttempt} from "../lib/ai/types";

function jsonResponse(status:number,body:unknown){
  return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
}

test("falls back from Groq to Cerebras after Groq exhausts retries on a retryable error",async()=>{
  process.env.GROQ_API_KEY="test-groq-key";
  process.env.CEREBRAS_API_KEY="test-cerebras-key";
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const calls:string[]=[];
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async(url:any)=>{
    const u=String(url);
    calls.push(u);
    if(u.includes("api.groq.com")){
      return jsonResponse(429,{error:{message:"rate limited"}});
    }
    if(u.includes("api.cerebras.ai")){
      return jsonResponse(200,{id:"cb-1",choices:[{message:{content:"hello from cerebras"}}]});
    }
    throw new Error(`unexpected fetch to ${u}`);
  }) as any;

  try{
    const attempts:ProviderAttempt[]=[];
    const result=await generateWithFallback(
      {task:"chat",quality:"fast",prompt:"hi"},
      {onAttempt:async(a)=>{attempts.push(a)}}
    );
    assert.equal(result.provider,"cerebras");
    assert.equal(result.output,"hello from cerebras");
    // Groq should have been retried (2 attempts) before moving to Cerebras.
    const groqAttempts=attempts.filter(a=>a.provider==="groq");
    const cerebrasAttempts=attempts.filter(a=>a.provider==="cerebras");
    assert.equal(groqAttempts.length,2);
    assert.ok(groqAttempts.every(a=>a.status==="failed"&&a.errorCode==="RATE_LIMIT"));
    assert.equal(cerebrasAttempts.length,1);
    assert.equal(cerebrasAttempts[0].status,"succeeded");
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test("a permanent error (401) skips retries and moves straight to the next provider",async()=>{
  process.env.GROQ_API_KEY="test-groq-key";
  process.env.CEREBRAS_API_KEY="test-cerebras-key";
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async(url:any)=>{
    const u=String(url);
    if(u.includes("api.groq.com"))return jsonResponse(401,{error:{message:"invalid api key"}});
    if(u.includes("api.cerebras.ai"))return jsonResponse(200,{id:"cb-2",choices:[{message:{content:"ok"}}]});
    throw new Error(`unexpected fetch to ${u}`);
  }) as any;

  try{
    const attempts:ProviderAttempt[]=[];
    const result=await generateWithFallback(
      {task:"chat",quality:"fast",prompt:"hi"},
      {onAttempt:async(a)=>{attempts.push(a)}}
    );
    assert.equal(result.provider,"cerebras");
    const groqAttempts=attempts.filter(a=>a.provider==="groq");
    assert.equal(groqAttempts.length,1,"a 401 must not be retried");
    assert.equal(groqAttempts[0].errorCode,"AUTH_ERROR");
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test("an unconfigured provider (no API key) is skipped without being called",async()=>{
  delete process.env.GROQ_API_KEY;
  process.env.CEREBRAS_API_KEY="test-cerebras-key";
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const calls:string[]=[];
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async(url:any)=>{
    calls.push(String(url));
    return jsonResponse(200,{id:"cb-3",choices:[{message:{content:"ok"}}]});
  }) as any;

  try{
    const result=await generateWithFallback({task:"chat",quality:"fast",prompt:"hi"});
    assert.equal(result.provider,"cerebras");
    assert.ok(calls.every(u=>!u.includes("api.groq.com")),"Groq must not be called when GROQ_API_KEY is absent");
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test("Claude is never called unless ANTHROPIC_API_KEY is set, even when everything else fails",async()=>{
  process.env.GROQ_API_KEY="test-groq-key";
  process.env.CEREBRAS_API_KEY="test-cerebras-key";
  process.env.OPENROUTER_API_KEY="test-openrouter-key";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async(url:any)=>{
    const u=String(url);
    if(u.includes("anthropic.com"))throw new Error("Claude must never be called without a configured key");
    return jsonResponse(500,{error:{message:"down"}});
  }) as any;

  try{
    await assert.rejects(
      generateWithFallback({task:"chat",quality:"fast",prompt:"hi"}),
      /ALL_PROVIDERS_FAILED|All eligible AI providers failed/
    );
  }finally{
    globalThis.fetch=originalFetch;
  }
});
