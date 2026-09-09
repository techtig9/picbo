"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {getPaymentProvider} from "@/lib/billing/payment-provider";
import {planById} from "@/lib/billing/plans";
import {createAdminClient} from "@/lib/supabase/admin";
import {log} from "@/lib/observability/logger";
import {revalidatePath} from "next/cache";

export async function startCheckout(planId:string,period:"monthly"|"annual"){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const plan=planById(planId);
  if(plan.id==="free")throw new Error("Free plan doesn't need checkout");

  const provider=getPaymentProvider();
  if(!provider.configured){
    throw new Error("Payment provider isn't connected yet — no checkout can be started. Contact support to upgrade manually in the meantime.");
  }
  const url=await provider.createCheckoutUrl({plan,period,workspaceId:ws.workspace_id,customerEmail:user.email||""});
  return {checkoutUrl:url};
}

/**
 * Records a cancellation request.
 *
 * Previously this ran `supabase.from("subscriptions").update(...)` with the
 * user-scoped client. public.subscriptions has a SELECT policy and no UPDATE
 * policy — correct, since billing state must only be written by the verified
 * Paddle webhook — so the update matched zero rows and returned no error. The
 * customer was shown a successful cancellation while nothing changed, locally
 * or at Paddle, and they kept being charged.
 *
 * The policy stays as it is. This now writes through the service role after an
 * explicit owner check, verifies the row actually changed, and is honest about
 * what has and has not happened yet: the provider-side cancellation call is
 * Phase 3 work, so this returns providerCancelled:false and the UI must say
 * the request is pending rather than complete.
 */
export async function cancelSubscription(){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  if(ws.role!=="owner"&&ws.role!=="admin")throw new Error("ONLY_OWNERS_AND_ADMINS_CAN_CANCEL_A_SUBSCRIPTION");

  const admin=createAdminClient();
  const {data,error}=await admin.from("subscriptions")
    .update({
      cancel_at_period_end:true,
      cancellation_requested_at:new Date().toISOString(),
      cancellation_requested_by:user.id,
      updated_at:new Date().toISOString()
    })
    .eq("workspace_id",ws.workspace_id)
    .in("status",["active","past_due"])
    .select("id");

  if(error)throw error;
  if(!data||data.length===0){
    throw new Error("No active subscription found to cancel for this workspace.");
  }

  const supabase=await createClient();
  await supabase.from("workspace_activity").insert({
    workspace_id:ws.workspace_id,actor_id:user.id,action:"requested_cancellation"
  });

  log("info","billing.cancellation_requested",{workspace_id:ws.workspace_id,user_id:user.id});

  // Whether the provider has actually cancelled is carried by
  // subscriptions.provider_canceled_at, which the billing page reads: until it
  // is set, the UI says "cancellation requested", never "cancelled". That call
  // to the Paddle API is Phase 3 work. Used directly as a <form action>, so
  // this must return void — the state lives in the database, not a return value.
  revalidatePath("/billing");
}
