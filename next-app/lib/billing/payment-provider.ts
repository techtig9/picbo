import crypto from "crypto";
import type {PlanDefinition} from "./plans";

export interface CheckoutParams{
  plan:PlanDefinition;
  period:"monthly"|"annual";
  workspaceId:string;
  customerEmail:string;
}

export interface PaymentProvider{
  readonly configured:boolean;
  createCheckoutUrl(params:CheckoutParams):Promise<string>;
  verifyWebhookSignature(rawBody:string,signatureHeader:string|null):boolean;
}

/**
 * Paddle Billing adapter. Not wired to a live account in this environment —
 * PADDLE_API_KEY / PADDLE_WEBHOOK_SECRET / PADDLE_PRICE_* aren't set here, so
 * `configured` is false and the Billing UI shows an honest "connect a payment
 * provider" state instead of faking a successful checkout (explicitly
 * required: "Do not fake payment success").
 *
 * Signature verification implements Paddle's real scheme (Paddle-Signature
 * header: `ts=<unix>;h1=<hex hmac-sha256 of "ts:body">`) so the webhook route
 * is genuinely correct the moment real credentials are added — nothing else
 * needs to change.
 */
export class PaddleProvider implements PaymentProvider{
  get configured(){return Boolean(process.env.PADDLE_API_KEY&&process.env.PADDLE_WEBHOOK_SECRET)}

  async createCheckoutUrl(params:CheckoutParams):Promise<string>{
    if(!this.configured)throw new Error("PAYMENT_PROVIDER_NOT_CONFIGURED");
    const priceIdEnvKey=`PADDLE_PRICE_${params.plan.id.toUpperCase()}_${params.period.toUpperCase()}`;
    const priceId=process.env[priceIdEnvKey];
    if(!priceId)throw new Error(`Missing ${priceIdEnvKey} — create this price in Paddle and set the env var`);
    const base="https://checkout.paddle.com/checkout"; // Paddle also supports inline Checkout.js; a URL keeps the server side simple
    const qs=new URLSearchParams({
      items:JSON.stringify([{price_id:priceId,quantity:1}]),
      customer_email:params.customerEmail,
      custom_data:JSON.stringify({workspace_id:params.workspaceId,plan:params.plan.id,period:params.period})
    });
    return `${base}?${qs.toString()}`;
  }

  verifyWebhookSignature(rawBody:string,signatureHeader:string|null):boolean{
    const secret=process.env.PADDLE_WEBHOOK_SECRET;
    if(!secret||!signatureHeader)return false;
    const parts=Object.fromEntries(signatureHeader.split(";").map(kv=>{
      const [k,v]=kv.split("=");
      return [k,v];
    }));
    const ts=parts.ts,h1=parts.h1;
    if(!ts||!h1)return false;
    const signedPayload=`${ts}:${rawBody}`;
    const expected=crypto.createHmac("sha256",secret).update(signedPayload).digest("hex");
    try{
      return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(h1));
    }catch{
      return false; // length mismatch etc — never let a malformed header throw past verification
    }
  }
}

export function getPaymentProvider():PaymentProvider{
  return new PaddleProvider();
}
