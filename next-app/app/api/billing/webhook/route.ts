import {NextResponse} from "next/server";
import {getPaymentProvider} from "@/lib/billing/payment-provider";
import {createAdminClient} from "@/lib/supabase/admin";
import {planById} from "@/lib/billing/plans";
import {log} from "@/lib/observability/logger";

/**
 * Paddle Billing webhook.
 *
 * This handler was unreachable until Phase 1: middleware 307-redirected it to
 * the HTML sign-in page, so no subscription could ever activate. Now that it
 * receives events, Phase 3 makes it actually do the work — previously it
 * recorded the event and set a subscription row's status, but never granted
 * the credits the customer had just paid for.
 *
 * Every write uses the service-role client: a webhook carries no Supabase
 * session, and `subscriptions` deliberately has no UPDATE policy so browsers
 * can never write billing state.
 */

/** Events we act on. Anything else is recorded and acknowledged. */
const HANDLED=new Set([
  "subscription.activated",
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "transaction.completed",
  "transaction.payment_failed",
  "adjustment.created"
]);

export async function POST(req:Request){
  const provider=getPaymentProvider();
  if(!provider.configured){
    return NextResponse.json({error:"PAYMENT_PROVIDER_NOT_CONFIGURED"},{status:503});
  }

  const rawBody=await req.text();
  const signature=req.headers.get("paddle-signature");
  if(!provider.verifyWebhookSignature(rawBody,signature)){
    log("warn","billing.webhook_bad_signature",{});
    return NextResponse.json({error:"INVALID_SIGNATURE"},{status:401});
  }

  let event:any;
  try{event=JSON.parse(rawBody)}
  catch{return NextResponse.json({error:"INVALID_JSON"},{status:400})}

  const eventId=String(event.event_id||"");
  const eventType=String(event.event_type||"");
  const data=event.data||{};
  const workspaceId=data?.custom_data?.workspace_id;

  if(!eventId){
    return NextResponse.json({error:"MISSING_EVENT_ID"},{status:400});
  }
  if(!workspaceId){
    // Not an error on Paddle's side — some account-level events carry no
    // custom_data. Acknowledge so Paddle stops retrying, but do nothing.
    log("info","billing.webhook_no_workspace",{event_type:eventType,event_id:eventId});
    return NextResponse.json({ok:true,ignored:"NO_WORKSPACE_IN_CUSTOM_DATA"});
  }

  const supabase=createAdminClient();

  // Idempotency. The insert is the claim: the unique index on
  // (provider, provider_event_id) means a replayed webhook loses the race and
  // returns here rather than granting credits twice. Checking-then-inserting
  // would leave a window where two concurrent deliveries both pass the check.
  const {error:insertErr}=await supabase.from("payment_events").insert({
    workspace_id:workspaceId,
    provider:"paddle",
    provider_event_id:eventId,
    type:eventType,
    amount_cents:data?.details?.totals?.total?Number(data.details.totals.total):null,
    currency:data?.currency_code||"usd",
    status:data?.status||"received",
    raw:event
  });

  if(insertErr){
    if((insertErr as any).code==="23505"){
      return NextResponse.json({ok:true,duplicate:true});
    }
    log("error","billing.webhook_record_failed",{event_type:eventType,message:insertErr.message});
    return NextResponse.json({error:insertErr.message},{status:500});
  }

  if(!HANDLED.has(eventType)){
    return NextResponse.json({ok:true,recorded:true});
  }

  try{
    await handleEvent(supabase,eventType,data,workspaceId,eventId);
  }catch(e:any){
    // Return 500 so Paddle retries. The payment_events row already exists, so
    // the retry will be treated as a duplicate — which is why recovery for a
    // genuinely failed handler is the reconciliation query in
    // PICBO_PRODUCTION_ENV_CHECKLIST, not an automatic replay.
    log("error","billing.webhook_handler_failed",{event_type:eventType,event_id:eventId,message:e?.message});
    return NextResponse.json({error:"HANDLER_FAILED"},{status:500});
  }

  return NextResponse.json({ok:true});
}

async function handleEvent(
  supabase:ReturnType<typeof createAdminClient>,
  eventType:string,
  data:any,
  workspaceId:string,
  eventId:string
){
  const planId=data?.custom_data?.plan||"starter";
  const period=data?.custom_data?.period||"monthly";
  // subscriptions.workspace_id is the primary key: one subscription row per
  // workspace, so every update below scopes on workspace_id alone.
  const subscriptionId=data?.id||null;

  switch(eventType){
    case "subscription.created":
    case "subscription.activated":
    case "subscription.resumed":
    case "subscription.updated":{
      const status=eventType==="subscription.updated"?(data?.status||"active"):"active";
      await supabase.from("subscriptions").upsert({
        workspace_id:workspaceId,
        plan:planId,
        billing_period:period,
        status,
        provider:"paddle",
        provider_subscription_id:subscriptionId,
        current_period_end:data?.current_billing_period?.ends_at||null,
        // Paddle tells us directly whether a cancellation is scheduled; trust
        // that over our local flag, which can be stale if a customer cancelled
        // or resumed from Paddle's own portal rather than in-app.
        cancel_at_period_end:data?.scheduled_change?.action==="cancel",
        provider_canceled_at:null,
        updated_at:new Date().toISOString()
      },{onConflict:"workspace_id"});

      if(eventType==="subscription.activated"||eventType==="subscription.created"){
        await grantPlanCredits(supabase,workspaceId,planId,`paddle:${eventId}:grant`,subscriptionId);
      }
      break;
    }

    case "subscription.canceled":{
      await supabase.from("subscriptions").update({
        status:"canceled",
        cancel_at_period_end:true,
        provider_canceled_at:data?.canceled_at||new Date().toISOString(),
        updated_at:new Date().toISOString()
      }).eq("workspace_id",workspaceId);
      break;
    }

    case "subscription.past_due":
    case "subscription.paused":{
      await supabase.from("subscriptions").update({
        status:eventType==="subscription.paused"?"paused":"past_due",
        updated_at:new Date().toISOString()
      }).eq("workspace_id",workspaceId);
      break;
    }

    case "transaction.completed":{
      // A renewal payment. `subscription.activated` fires once at signup; the
      // monthly credit grant rides on the completed transaction thereafter.
      // Keyed on the event id, so a Paddle retry cannot double-grant.
      const linkedSubscription=data?.subscription_id||null;
      if(linkedSubscription){
        await grantPlanCredits(supabase,workspaceId,planId,`paddle:${eventId}:renewal`,linkedSubscription);
        await supabase.from("subscriptions").update({
          status:"active",
          current_period_end:data?.billing_period?.ends_at||null,
          updated_at:new Date().toISOString()
        }).eq("workspace_id",workspaceId);
      }
      break;
    }

    case "transaction.payment_failed":{
      await supabase.from("subscriptions").update({
        status:"past_due",updated_at:new Date().toISOString()
      }).eq("workspace_id",workspaceId);

      await supabase.from("notifications").insert({
        workspace_id:workspaceId,
        user_id:await ownerUserId(supabase,workspaceId),
        type:"payment_failed",
        title:"We couldn't process your payment",
        body:"Your latest Picbo payment didn't go through. Update your payment method to keep your plan active.",
        link:"/billing"
      }).select("id");
      break;
    }

    case "adjustment.created":{
      // A refund or chargeback. Credits granted for the refunded period are
      // clawed back so a refunded customer does not keep spending them.
      const action=String(data?.action||"");
      if(action==="refund"||action==="chargeback"){
        const plan=planById(planId);
        await supabase.rpc("adjust_credits",{
          wid:workspaceId,
          delta:-plan.creditsPerMonth,
          idem:`paddle:${eventId}:clawback`,
          ref:null,
          reason:action
        });
        await supabase.from("subscriptions").update({
          status:action==="chargeback"?"canceled":"past_due",
          updated_at:new Date().toISOString()
        }).eq("workspace_id",workspaceId);
        log("warn","billing.adjustment",{workspace_id:workspaceId,action});
      }
      break;
    }
  }
}

/**
 * Grants a plan's monthly credit allowance.
 *
 * Nothing did this before: a customer could complete checkout, see their plan
 * change, and still have zero credits. The idempotency key is derived from the
 * Paddle event id, so a retried delivery is a no-op at the ledger level rather
 * than a second month of free credits.
 */
async function grantPlanCredits(
  supabase:ReturnType<typeof createAdminClient>,
  workspaceId:string,
  planId:string,
  idempotencyKey:string,
  referenceId:string|null
){
  const plan=planById(planId);
  if(plan.creditsPerMonth<=0)return;

  const {error}=await supabase.rpc("grant_credits",{
    wid:workspaceId,
    amount_to_grant:plan.creditsPerMonth,
    idem:idempotencyKey,
    reason:`${plan.name} plan`
  });
  if(error)throw new Error(`Credit grant failed: ${error.message}`);

  log("info","billing.credits_granted",{
    workspace_id:workspaceId,plan:plan.id,credits:plan.creditsPerMonth,reference:referenceId
  });
}

/** The workspace owner, for billing notifications. */
async function ownerUserId(supabase:ReturnType<typeof createAdminClient>,workspaceId:string){
  const {data}=await supabase.from("workspace_members")
    .select("user_id").eq("workspace_id",workspaceId).eq("role","owner").limit(1).maybeSingle();
  return data?.user_id||null;
}
