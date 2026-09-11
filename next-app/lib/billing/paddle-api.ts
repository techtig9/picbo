import {log} from "@/lib/observability/logger";

/**
 * Paddle Billing API client.
 *
 * The previous checkout built a URL in the **Paddle Classic** format:
 *   https://checkout.paddle.com/checkout?items=[...]&customer_email=...
 * while the webhook handler implements **Paddle Billing** (Paddle-Signature
 * `ts=…;h1=…`, `subscription.activated`, `custom_data`). Those are two
 * different products with different APIs — that URL does not open a valid
 * Paddle Billing checkout, so no customer could ever have paid.
 *
 * Paddle Billing does not take a checkout URL built from query parameters.
 * A transaction is created server-side and the customer is sent to the
 * checkout URL Paddle returns for it. That also keeps price and plan
 * server-authoritative: the browser never states what it is buying.
 */

export interface PaddleErrorShape{
  code?:string;
  detail?:string;
  status?:number;
}

export class PaddleApiError extends Error{
  constructor(message:string,public code:string,public status?:number){
    super(message);
    this.name="PaddleApiError";
  }
}

/** Sandbox and production are separate hosts with separate keys. */
export function paddleApiBase():string{
  return process.env.PADDLE_ENVIRONMENT==="sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export function isPaddleConfigured():boolean{
  return Boolean(process.env.PADDLE_API_KEY&&process.env.PADDLE_WEBHOOK_SECRET);
}

const REQUEST_TIMEOUT_MS=15_000;

/**
 * One authenticated Paddle request. Never leaks the API key into a thrown
 * message or a log line.
 */
export async function paddleRequest<T=any>(
  path:string,
  init:{method?:string;body?:unknown}={}
):Promise<T>{
  const apiKey=process.env.PADDLE_API_KEY;
  if(!apiKey)throw new PaddleApiError("Paddle is not configured.","PAYMENT_PROVIDER_NOT_CONFIGURED");

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);

  try{
    const res=await fetch(`${paddleApiBase()}${path}`,{
      method:init.method||"GET",
      headers:{
        authorization:`Bearer ${apiKey}`,
        "content-type":"application/json"
      },
      body:init.body===undefined?undefined:JSON.stringify(init.body),
      signal:controller.signal,
      cache:"no-store"
    });

    const payload=await res.json().catch(()=>null);

    if(!res.ok){
      const detail=payload?.error?.detail||payload?.error?.code||`HTTP ${res.status}`;
      const code=payload?.error?.code||"PADDLE_REQUEST_FAILED";
      log("error","billing.paddle_request_failed",{path,status:res.status,code});
      throw new PaddleApiError(String(detail),String(code),res.status);
    }

    return payload?.data as T;
  }catch(e:any){
    if(e instanceof PaddleApiError)throw e;
    if(e?.name==="AbortError"){
      throw new PaddleApiError("Paddle did not respond in time.","PADDLE_TIMEOUT");
    }
    throw new PaddleApiError(`Could not reach Paddle: ${e?.message||"network error"}`,"PADDLE_UNREACHABLE");
  }finally{
    clearTimeout(timer);
  }
}

export interface CreateTransactionParams{
  priceId:string;
  workspaceId:string;
  planId:string;
  period:"monthly"|"annual";
  customerEmail:string;
  /** Returned to us on the webhook; also where the customer lands after paying. */
  returnUrl:string;
}

export interface PaddleTransaction{
  id:string;
  checkoutUrl:string|null;
}

/**
 * Creates a Paddle Billing transaction and returns its hosted checkout URL.
 *
 * `custom_data` is how the webhook later identifies the workspace and plan.
 * It is set here, server-side, from values we looked up ourselves — never
 * from the request body — so a customer cannot check out as another
 * workspace or on a plan they did not pay for.
 */
export async function createTransaction(params:CreateTransactionParams):Promise<PaddleTransaction>{
  const data=await paddleRequest<any>("/transactions",{
    method:"POST",
    body:{
      items:[{price_id:params.priceId,quantity:1}],
      custom_data:{
        workspace_id:params.workspaceId,
        plan:params.planId,
        period:params.period
      },
      checkout:{url:params.returnUrl}
    }
  });

  // Paddle returns checkout.url only when a default payment link is set on the
  // seller account. Without it there is nowhere to send the customer, and
  // silently returning a broken link would look like a working checkout.
  const checkoutUrl=data?.checkout?.url??null;
  if(!checkoutUrl){
    throw new PaddleApiError(
      "Paddle accepted the transaction but returned no checkout URL. Set a default payment link in Paddle > Checkout settings.",
      "PADDLE_NO_CHECKOUT_URL"
    );
  }

  return {id:String(data.id),checkoutUrl:String(checkoutUrl)};
}

export type CancellationTiming="immediately"|"next_billing_period";

/**
 * Cancels a subscription at Paddle.
 *
 * Defaults to next_billing_period: the customer keeps what they already paid
 * for until the period ends, which is both fairer and what the billing page
 * tells them will happen.
 */
export async function cancelSubscriptionAtPaddle(
  subscriptionId:string,
  effectiveFrom:CancellationTiming="next_billing_period"
):Promise<{status:string;canceledAt:string|null;scheduledChange:unknown}>{
  const data=await paddleRequest<any>(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,{
    method:"POST",
    body:{effective_from:effectiveFrom}
  });
  return {
    status:String(data?.status||"unknown"),
    canceledAt:data?.canceled_at??null,
    scheduledChange:data?.scheduled_change??null
  };
}

/** Cancels a scheduled cancellation, putting the subscription back to active. */
export async function resumeSubscriptionAtPaddle(subscriptionId:string):Promise<{status:string}>{
  const data=await paddleRequest<any>(`/subscriptions/${encodeURIComponent(subscriptionId)}`,{
    method:"PATCH",
    body:{scheduled_change:null}
  });
  return {status:String(data?.status||"unknown")};
}

/**
 * Resolves the Paddle price id for a plan and billing period.
 *
 * Kept as a lookup over environment variables rather than hardcoded ids so the
 * same build runs against sandbox and production.
 */
export function priceIdFor(planId:string,period:"monthly"|"annual"):string{
  const key=`PADDLE_PRICE_${planId.toUpperCase()}_${period.toUpperCase()}`;
  const priceId=process.env[key];
  if(!priceId){
    throw new PaddleApiError(
      `No Paddle price configured for the ${planId} plan billed ${period}. Create the price in Paddle and set ${key}.`,
      "PADDLE_PRICE_NOT_CONFIGURED"
    );
  }
  return priceId;
}
