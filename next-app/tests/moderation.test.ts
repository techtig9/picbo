import {test} from "node:test";
import assert from "node:assert/strict";
import {classifyPromptSafety} from "../lib/moderation/policy";

function jsonResponse(status:number,body:unknown){
  return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
}

test("classifies a benign prompt as not flagged",async()=>{
  process.env.GROQ_API_KEY="test-groq-key";
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async()=>jsonResponse(200,{id:"g1",choices:[{message:{content:'{"flagged": false, "category": null, "reason": null}'}}]})) as any;
  try{
    const result=await classifyPromptSafety("A bright, clean product photo of a ceramic mug on a marble countertop");
    assert.equal(result.flagged,false);
  }finally{globalThis.fetch=originalFetch}
});

test("classifies a flagged prompt correctly and surfaces category/reason",async()=>{
  process.env.GROQ_API_KEY="test-groq-key";
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async()=>jsonResponse(200,{id:"g2",choices:[{message:{content:'{"flagged": true, "category": "weapons", "reason": "requests explosive device instructions"}'}}]})) as any;
  try{
    const result=await classifyPromptSafety("some request");
    assert.equal(result.flagged,true);
    assert.equal(result.category,"weapons");
  }finally{globalThis.fetch=originalFetch}
});

test("fails open (never flags) when the classifier call itself fails",async()=>{
  delete process.env.GROQ_API_KEY;
  delete process.env.CEREBRAS_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const result=await classifyPromptSafety("anything at all");
  assert.equal(result.flagged,false);
});

test("empty prompt is never flagged without calling any provider",async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async()=>{throw new Error("should not be called for empty prompt")}) as any;
  try{
    const result=await classifyPromptSafety("   ");
    assert.equal(result.flagged,false);
  }finally{globalThis.fetch=originalFetch}
});
