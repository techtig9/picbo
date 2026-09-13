import crypto from "crypto";
import type {PlanDefinition} from "./plans";
import {createTransaction,priceIdFor,isPaddleConfigured} from "./paddle-api";

export interface CheckoutParams{
  plan:PlanDefinition;
  period:"monthly"|"annual";
  workspaceId:string;
  customerEmail:string;
  returnUrl:string;
}

export interface PaymentProvider{
  readonly configured:boolean;
  createCheckoutUrl(params:CheckoutParams):Promise<string>;
  verifyWebhookSignature(rawBody:string,signatureHeader:string|null):boolean;
}

/**
 * Paddle Billing adapter.
 *
 * Checkout previously built a Paddle **Classic** URL
 * (`https://checkout.paddle.com/checkout?items=…`) while the webhook
 * implemented Paddle **Billing**. Those are different products with
 * incompatible APIs, so that link could never have opened a real checkout.
 * A transaction is now created through the Billing API and the customer is
 * sent to the checkout URL Paddle returns.
 *
 * With no credentials set, `configured` is false and the Billing UI shows an
 * honest "not connected" state. Nothing anywhere fakes a successful payment.
 */
export class PaddleProvider implements PaymentProvider{
  get configured(){return isPaddleConfigured()}

  async createCheckoutUrl(params:CheckoutParams):Promise<string>{
    if(!this.configured)throw new Error("PAYMENT_PROVIDER_NOT_CONFIGURED");
    const priceId=priceIdFor(params.plan.id,params.period);
    const transaction=await createTransaction({
      priceId,
      workspaceId:params.workspaceId,
      planId:params.plan.id,
      period:params.period,
      customerEmail:params.customerEmail,
      returnUrl:params.returnUrl
    });
    return transaction.checkoutUrl!;
  }

  /**
   * Verifies Paddle's `Paddle-Signature: ts=<unix>;h1=<hex>` header, where the
   * HMAC-SHA256 is taken over `<ts>:<raw body>`.
   *
   * The timestamp is also checked for freshness. Without that, a webhook
   * captured once stays replayable forever; the `payment_events` unique index
   * makes a replay a no-op today, but idempotency is a second line of defence,
   * not a reason to accept an arbitrarily old signature.
   */
  verifyWebhookSignature(rawBody:string,signatureHeader:string|null):boolean{
    const secret=process.env.PADDLE_WEBHOOK_SECRET;
    if(!secret||!signatureHeader)return false;

    const parts=Object.fromEntries(
      signatureHeader.split(";").map(kv=>{
        const idx=kv.indexOf("=");
        return idx===-1?[kv,""]:[kv.slice(0,idx),kv.slice(idx+1)];
      })
    );
    const ts=parts.ts,h1=parts.h1;
    if(!ts||!h1)return false;

    const timestamp=Number(ts);
    if(!Number.isFinite(timestamp))return false;
    const ageSeconds=Math.abs(Date.now()/1000-timestamp);
    if(ageSeconds>WEBHOOK_MAX_AGE_SECONDS)return false;

    const expected=crypto.createHmac("sha256",secret).update(`${ts}:${rawBody}`).digest("hex");
    try{
      return crypto.timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(h1,"hex"));
    }catch{
      return false; // malformed hex / length mismatch must never throw past verification
    }
  }
}

/** Five minutes each way, which covers clock skew and Paddle's own retries. */
export const WEBHOOK_MAX_AGE_SECONDS=300;

export function getPaymentProvider():PaymentProvider{
  return new PaddleProvider();
}
