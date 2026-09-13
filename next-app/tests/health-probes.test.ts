import test from "node:test";
import assert from "node:assert/strict";
import {stateForStatus,probeTaskCapability,probeConfiguration,rollup,type ProbeResult} from "../lib/health/probes";

/**
 * RED-12: the health check reported the AI chain as `ok` whenever one of three
 * environment variables was a non-empty string, without ever contacting a
 * provider. A revoked, expired or quota-exhausted key read GREEN — worse than
 * having no health check, because it actively says the broken thing is fine.
 */

function withEnv<T>(vars:Record<string,string|undefined>,fn:()=>T):T{
  const prev:Record<string,string|undefined>={};
  for(const [k,v] of Object.entries(vars)){
    prev[k]=process.env[k];
    if(v===undefined)delete process.env[k];
    else process.env[k]=v;
  }
  try{return fn()}finally{
    for(const [k,v] of Object.entries(prev)){
      if(v===undefined)delete process.env[k];
      else process.env[k]=v;
    }
  }
}

test("a rejected credential is unauthenticated, not ok",()=>{
  // The exact case the old check called healthy.
  assert.equal(stateForStatus(401),"unauthenticated");
  assert.equal(stateForStatus(403),"unauthenticated");
});

test("quota exhaustion is distinguished from an auth failure",()=>{
  assert.equal(stateForStatus(429),"quota_exhausted");
  assert.equal(stateForStatus(402),"quota_exhausted");
});

test("a provider 5xx is unreachable, not merely degraded",()=>{
  assert.equal(stateForStatus(500),"unreachable");
  assert.equal(stateForStatus(503),"unreachable");
});

test("only a 2xx is ok",()=>{
  assert.equal(stateForStatus(200),"ok");
  assert.equal(stateForStatus(204),"ok");
  assert.equal(stateForStatus(404),"degraded");
});

test("capability is about what can be served, not which keys exist",()=>{
  // A text-only key cannot generate an image, and the health endpoint must
  // say so rather than reporting a green chain.
  const textOnly=withEnv(
    {GROQ_API_KEY:"x",CEREBRAS_API_KEY:undefined,OPENROUTER_API_KEY:undefined,
     ANTHROPIC_API_KEY:undefined,GEMINI_API_KEY:undefined,FAL_KEY:undefined},
    ()=>probeTaskCapability()
  );
  const servable=textOnly.metadata?.servable as Record<string,boolean>;
  assert.equal(servable.chat,true,"a text key should serve chat");
  assert.equal(servable.image,false,"a text key cannot serve image generation");
  assert.equal(textOnly.state,"degraded");
  assert.match(String(textOnly.detail),/image/);
});

test("losing text capability is an error, not a degradation",()=>{
  // Without text, Lumi, ad copy and prompt enhancement all fail.
  const nothing=withEnv(
    {GROQ_API_KEY:undefined,CEREBRAS_API_KEY:undefined,OPENROUTER_API_KEY:undefined,
     ANTHROPIC_API_KEY:undefined,GEMINI_API_KEY:undefined,FAL_KEY:undefined},
    ()=>probeTaskCapability()
  );
  assert.equal(nothing.state,"error");
});

test("configuration reports missing required variables as an error",()=>{
  const result=withEnv({SUPABASE_SERVICE_ROLE_KEY:undefined},()=>probeConfiguration());
  assert.equal(result.state,"error");
  assert.match(String(result.detail),/SUPABASE_SERVICE_ROLE_KEY/);
});

test("configuration never echoes a secret's value",()=>{
  const result=withEnv(
    {NEXT_PUBLIC_SUPABASE_URL:"https://x.supabase.co",
     NEXT_PUBLIC_SUPABASE_ANON_KEY:"anon-value",
     SUPABASE_SERVICE_ROLE_KEY:"super-secret-service-role-value"},
    ()=>probeConfiguration()
  );
  const serialised=JSON.stringify(result);
  assert.ok(!serialised.includes("super-secret-service-role-value"),"leaked a secret value");
  assert.ok(!serialised.includes("anon-value"),"leaked a key value");
});

test("an unconfigured optional feature is reported, not treated as broken",()=>{
  const result=withEnv(
    {NEXT_PUBLIC_SUPABASE_URL:"https://x.supabase.co",
     NEXT_PUBLIC_SUPABASE_ANON_KEY:"a",SUPABASE_SERVICE_ROLE_KEY:"b",
     RESEND_API_KEY:undefined},
    ()=>probeConfiguration()
  );
  assert.equal(result.state,"ok","a missing optional feature is not a health failure");
  assert.ok((result.metadata?.featuresDisabled as string[]).includes("email"));
});

/** The rollup decides what a load balancer sees. */

const probe=(service:string,state:ProbeResult["state"]):ProbeResult=>({service,state});

test("a healthy system rolls up to ok",()=>{
  assert.equal(rollup([
    probe("configuration","ok"),probe("database","ok"),
    probe("task_capability","ok"),probe("ai:groq","ok")
  ]),"ok");
});

test("an unconfigured provider alone does not make the system unhealthy",()=>{
  // Optional providers are expected to be absent in some environments.
  assert.equal(rollup([
    probe("configuration","ok"),probe("database","ok"),
    probe("task_capability","ok"),probe("ai:anthropic","not_configured")
  ]),"ok");
});

test("a rejected provider credential degrades the system",()=>{
  assert.equal(rollup([
    probe("configuration","ok"),probe("database","ok"),
    probe("task_capability","ok"),probe("ai:groq","unauthenticated")
  ]),"degraded");
});

test("a database failure is an error, not a degradation",()=>{
  assert.equal(rollup([
    probe("configuration","ok"),probe("database","unreachable"),probe("task_capability","ok")
  ]),"error");
});

test("losing all task capability is an error",()=>{
  assert.equal(rollup([
    probe("configuration","ok"),probe("database","ok"),probe("task_capability","error")
  ]),"error");
});
