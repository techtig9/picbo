import {NextResponse} from "next/server";
import {getPaymentProvider} from "@/lib/billing/payment-provider";
import {createAdminClient} from "@/lib/supabase/admin";

/**
 * Paddle webhook receiver. Verifies the signature, then processes the event
 * idempotently via payment_events' unique(provider,provider_event_id) —
 * a replayed webhook is a no-op, never a double-grant.
 *
 * Uses the service-role client (not the per-request cookie client) because
 * webhooks arrive with no authenticated Supabase session.
 */
export async function POST(req:Request){
  const provider=getPaymentProvider();
  if(!provider.configured){
    return NextResponse.json({error:"PAYMENT_PROVIDER_NOT_CONFIGURED"},{status:503});
  }

  const rawBody=await req.text();
  const signature=req.headers.get("paddle-signature");
  if(!provider.verifyWebhookSignature(rawBody,signature)){
    return NextResponse.json({error:"INVALID_SIGNATURE"},{status:401});
  }

  let event:any;
  try{event=JSON.parse(rawBody)}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400})}

  const eventId=String(event.event_id||"");
  const eventType=String(event.event_type||"");
  const data=event.data||{};
  const workspaceId=data?.custom_data?.workspace_id;
  if(!eventId||!workspaceId)return NextResponse.json({error:"MISSING_EVENT_ID_OR_WORKSPACE"},{status:400});

  const supabase=createAdminClient();

  // Idempotency: if we've already recorded this exact provider event, do nothing further.
  const {data:existing}=await supabase.from("payment_events").select("id").eq("provider","paddle").eq("provider_event_id",eventId).maybeSingle();
  if(existing)return NextResponse.json({ok:true,duplicate:true});

  const {error:insertErr}=await supabase.from("payment_events").insert({
    workspace_id:workspaceId,provider:"paddle",provider_event_id:eventId,type:eventType,
    amount_cents:data?.details?.totals?.total?Number(data.details.totals.total):null,
    currency:data?.currency_code||"usd",status:data?.status||"received",raw:event
  });
  if(insertErr)return NextResponse.json({error:insertErr.message},{status:500});

  if(eventType==="subscription.activated"||eventType==="subscription.updated"){
    const plan=data?.custom_data?.plan;
    const period=data?.custom_data?.period;
    await supabase.from("subscriptions").upsert({
      workspace_id:workspaceId,
      plan:plan||"starter",
      billing_period:period||"monthly",
      status:"active",
      provider:"paddle",
      provider_subscription_id:data?.id||null,
      current_period_end:data?.current_billing_period?.ends_at||null,
      cancel_at_period_end:false,
      updated_at:new Date().toISOString()
    });
  }
  if(eventType==="subscription.canceled"){
    await supabase.from("subscriptions").update({status:"canceled",updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId);
  }
  if(eventType==="subscription.past_due"){
    await supabase.from("subscriptions").update({status:"past_due",updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId);
  }

  return NextResponse.json({ok:true});
}
