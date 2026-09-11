import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {PaddleProvider,WEBHOOK_MAX_AGE_SECONDS} from "../lib/billing/payment-provider";
import {paddleApiBase,priceIdFor,PaddleApiError,isPaddleConfigured} from "../lib/billing/paddle-api";

/**
 * Webhook signature verification is the only thing standing between a
 * stranger's HTTP request and a credit grant, so it gets the most scrutiny
 * here. Phase 1 made this handler reachable at all (middleware was
 * 307-redirecting it to the sign-in page); Phase 3 made it grant credits, so
 * a forged event is now worth money.
 */

const SECRET="pdl_ntfset_test_secret_value";

function sign(body:string,secret=SECRET,tsSeconds=Math.floor(Date.now()/1000)){
  const h1=crypto.createHmac("sha256",secret).update(`${tsSeconds}:${body}`).digest("hex");
  return `ts=${tsSeconds};h1=${h1}`;
}

function withSecret<T>(fn:()=>T):T{
  const prev=process.env.PADDLE_WEBHOOK_SECRET;
  process.env.PADDLE_WEBHOOK_SECRET=SECRET;
  try{return fn()}finally{
    if(prev===undefined)delete process.env.PADDLE_WEBHOOK_SECRET;
    else process.env.PADDLE_WEBHOOK_SECRET=prev;
  }
}

const body=JSON.stringify({event_id:"evt_1",event_type:"subscription.activated"});

test("a correctly signed webhook is accepted",()=>{
  withSecret(()=>{
    assert.equal(new PaddleProvider().verifyWebhookSignature(body,sign(body)),true);
  });
});

test("a tampered body is rejected",()=>{
  withSecret(()=>{
    const signature=sign(body);
    const tampered=JSON.stringify({event_id:"evt_1",event_type:"subscription.activated",extra:"injected"});
    assert.equal(new PaddleProvider().verifyWebhookSignature(tampered,signature),false);
  });
});

test("a signature made with the wrong secret is rejected",()=>{
  withSecret(()=>{
    assert.equal(new PaddleProvider().verifyWebhookSignature(body,sign(body,"not-the-secret")),false);
  });
});

test("a stale timestamp is rejected even when the HMAC is valid",()=>{
  // Without a freshness check, a webhook captured once stays replayable
  // forever. Idempotency makes a replay a no-op, but it is a second line of
  // defence, not a reason to accept an arbitrarily old signature.
  withSecret(()=>{
    const old=Math.floor(Date.now()/1000)-(WEBHOOK_MAX_AGE_SECONDS+60);
    assert.equal(new PaddleProvider().verifyWebhookSignature(body,sign(body,SECRET,old)),false);
  });
});

test("a timestamp from the near future is tolerated (clock skew)",()=>{
  withSecret(()=>{
    const skewed=Math.floor(Date.now()/1000)+30;
    assert.equal(new PaddleProvider().verifyWebhookSignature(body,sign(body,SECRET,skewed)),true);
  });
});

test("a far-future timestamp is rejected",()=>{
  withSecret(()=>{
    const future=Math.floor(Date.now()/1000)+(WEBHOOK_MAX_AGE_SECONDS+60);
    assert.equal(new PaddleProvider().verifyWebhookSignature(body,sign(body,SECRET,future)),false);
  });
});

test("a missing or malformed signature header is rejected without throwing",()=>{
  withSecret(()=>{
    const p=new PaddleProvider();
    assert.equal(p.verifyWebhookSignature(body,null),false);
    assert.equal(p.verifyWebhookSignature(body,""),false);
    assert.equal(p.verifyWebhookSignature(body,"garbage"),false);
    assert.equal(p.verifyWebhookSignature(body,"ts=;h1="),false);
    assert.equal(p.verifyWebhookSignature(body,"ts=notanumber;h1=abcd"),false);
    // Wrong length and non-hex must not throw out of timingSafeEqual.
    assert.equal(p.verifyWebhookSignature(body,"ts=1;h1=zz"),false);
    assert.equal(p.verifyWebhookSignature(body,`ts=${Math.floor(Date.now()/1000)};h1=aa`),false);
  });
});

test("verification fails closed when no secret is configured",()=>{
  const prev=process.env.PADDLE_WEBHOOK_SECRET;
  delete process.env.PADDLE_WEBHOOK_SECRET;
  try{
    assert.equal(new PaddleProvider().verifyWebhookSignature(body,sign(body)),false);
  }finally{
    if(prev!==undefined)process.env.PADDLE_WEBHOOK_SECRET=prev;
  }
});

/**
 * Checkout used to build a Paddle **Classic** URL while the webhook
 * implemented Paddle **Billing** — two different products. These pin the
 * Billing configuration so that mismatch cannot come back.
 */

test("sandbox and production use different API hosts",()=>{
  const prev=process.env.PADDLE_ENVIRONMENT;
  try{
    process.env.PADDLE_ENVIRONMENT="sandbox";
    assert.equal(paddleApiBase(),"https://sandbox-api.paddle.com");
    process.env.PADDLE_ENVIRONMENT="production";
    assert.equal(paddleApiBase(),"https://api.paddle.com");
    delete process.env.PADDLE_ENVIRONMENT;
    assert.equal(paddleApiBase(),"https://api.paddle.com","production is the safe default");
  }finally{
    if(prev===undefined)delete process.env.PADDLE_ENVIRONMENT;
    else process.env.PADDLE_ENVIRONMENT=prev;
  }
});

test("a price id is resolved per plan and period",()=>{
  process.env.PADDLE_PRICE_PRO_MONTHLY="pri_monthly_123";
  process.env.PADDLE_PRICE_PRO_ANNUAL="pri_annual_456";
  try{
    assert.equal(priceIdFor("pro","monthly"),"pri_monthly_123");
    assert.equal(priceIdFor("pro","annual"),"pri_annual_456");
  }finally{
    delete process.env.PADDLE_PRICE_PRO_MONTHLY;
    delete process.env.PADDLE_PRICE_PRO_ANNUAL;
  }
});

test("a missing price fails loudly and names the variable to set",()=>{
  delete process.env.PADDLE_PRICE_AGENCY_ANNUAL;
  assert.throws(
    ()=>priceIdFor("agency","annual"),
    (e:any)=>e instanceof PaddleApiError
      &&e.code==="PADDLE_PRICE_NOT_CONFIGURED"
      &&e.message.includes("PADDLE_PRICE_AGENCY_ANNUAL")
  );
});

test("Paddle is only considered configured with both key and webhook secret",()=>{
  const prevKey=process.env.PADDLE_API_KEY,prevSecret=process.env.PADDLE_WEBHOOK_SECRET;
  try{
    delete process.env.PADDLE_API_KEY;
    delete process.env.PADDLE_WEBHOOK_SECRET;
    assert.equal(isPaddleConfigured(),false);

    process.env.PADDLE_API_KEY="pdl_live_x";
    assert.equal(isPaddleConfigured(),false,"an API key without a webhook secret cannot verify events");

    process.env.PADDLE_WEBHOOK_SECRET=SECRET;
    assert.equal(isPaddleConfigured(),true);
  }finally{
    if(prevKey===undefined)delete process.env.PADDLE_API_KEY; else process.env.PADDLE_API_KEY=prevKey;
    if(prevSecret===undefined)delete process.env.PADDLE_WEBHOOK_SECRET; else process.env.PADDLE_WEBHOOK_SECRET=prevSecret;
  }
});
