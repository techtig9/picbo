"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {getPaymentProvider} from "@/lib/billing/payment-provider";
import {planById} from "@/lib/billing/plans";
import {cancelSubscriptionAtPaddle,resumeSubscriptionAtPaddle,PaddleApiError} from "@/lib/billing/paddle-api";
import {getAppOrigin} from "@/lib/auth/app-url";
import {log} from "@/lib/observability/logger";

/** Only these roles may change what a workspace is billed. */
function assertBillingRole(role:string|undefined){
  if(role!=="owner"&&role!=="admin"){
    throw new Error("Only workspace owners and admins can change billing.");
  }
}

export async function startCheckout(planId:string,period:"monthly"|"annual"){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  assertBillingRole(ws.role);

  const plan=planById(planId);
  if(plan.id==="free")throw new Error("The Free plan doesn't need a checkout.");

  const provider=getPaymentProvider();
  if(!provider.configured){
    throw new Error("Payment provider isn't connected yet — no checkout can be started. Contact support to upgrade manually in the meantime.");
  }

  const origin=await getAppOrigin();
  const url=await provider.createCheckoutUrl({
    plan,period,
    workspaceId:ws.workspace_id,
    customerEmail:user.email||"",
    returnUrl:`${origin}/billing?checkout=complete`
  });

  log("info","billing.checkout_started",{workspace_id:ws.workspace_id,plan:plan.id,period});
  return {checkoutUrl:url};
}

/**
 * Cancels the workspace subscription — at Paddle, not only in our database.
 *
 * Two bugs were fixed here. First, this used to write with the *user-scoped*
 * client, and public.subscriptions has a SELECT policy and no UPDATE policy,
 * so the update matched zero rows and returned no error: the customer saw a
 * successful cancellation while nothing changed anywhere. Second, even once
 * the local write worked, nothing ever told Paddle — so the customer kept
 * being charged after "cancelling".
 *
 * Now the Paddle call happens first. If Paddle refuses, we do not record a
 * cancellation that did not happen.
 */
export async function cancelSubscription(){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  assertBillingRole(ws.role);

  const admin=createAdminClient();
  const {data:subscription}=await admin.from("subscriptions")
    .select("id,provider,provider_subscription_id,status")
    .eq("workspace_id",ws.workspace_id)
    .in("status",["active","past_due"])
    .maybeSingle();

  if(!subscription){
    throw new Error("No active subscription found to cancel for this workspace.");
  }

  let providerCanceledAt:string|null=null;

  if(subscription.provider_subscription_id){
    try{
      const result=await cancelSubscriptionAtPaddle(subscription.provider_subscription_id,"next_billing_period");
      // Paddle acknowledges the *schedule*; `subscription.canceled` arrives on
      // the webhook when it actually takes effect. Only stamp
      // provider_canceled_at when Paddle says it is already done.
      providerCanceledAt=result.status==="canceled"?(result.canceledAt||new Date().toISOString()):null;
      log("info","billing.paddle_cancellation_scheduled",{
        workspace_id:ws.workspace_id,status:result.status
      });
    }catch(e:any){
      log("error","billing.paddle_cancellation_failed",{
        workspace_id:ws.workspace_id,code:e instanceof PaddleApiError?e.code:"UNKNOWN"
      });
      throw new Error(
        "We couldn't cancel your subscription with the payment provider, so nothing has been changed and you have not been charged differently. Please try again, or contact support."
      );
    }
  }else{
    // A subscription row with no provider id was never linked to Paddle —
    // record the request, but do not imply a provider cancellation happened.
    log("warn","billing.cancellation_without_provider_id",{workspace_id:ws.workspace_id});
  }

  const {data:updated,error}=await admin.from("subscriptions")
    .update({
      cancel_at_period_end:true,
      cancellation_requested_at:new Date().toISOString(),
      cancellation_requested_by:user.id,
      provider_canceled_at:providerCanceledAt,
      updated_at:new Date().toISOString()
    })
    .eq("id",subscription.id)
    .select("id");

  if(error)throw error;
  if(!updated||updated.length===0)throw new Error("Could not record the cancellation. Please contact support.");

  const supabase=await createClient();
  await supabase.from("workspace_activity").insert({
    workspace_id:ws.workspace_id,actor_id:user.id,action:"requested_cancellation"
  });

  revalidatePath("/billing");
}

/** Undoes a scheduled cancellation before it takes effect. */
export async function resumeSubscription(){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  assertBillingRole(ws.role);

  const admin=createAdminClient();
  const {data:subscription}=await admin.from("subscriptions")
    .select("id,provider_subscription_id,cancel_at_period_end,provider_canceled_at")
    .eq("workspace_id",ws.workspace_id)
    .maybeSingle();

  if(!subscription?.cancel_at_period_end){
    throw new Error("This subscription isn't scheduled to cancel.");
  }
  if(subscription.provider_canceled_at){
    throw new Error("This subscription has already been cancelled and can't be resumed — start a new checkout instead.");
  }

  if(subscription.provider_subscription_id){
    try{
      await resumeSubscriptionAtPaddle(subscription.provider_subscription_id);
    }catch(e:any){
      log("error","billing.paddle_resume_failed",{
        workspace_id:ws.workspace_id,code:e instanceof PaddleApiError?e.code:"UNKNOWN"
      });
      throw new Error("We couldn't resume your subscription with the payment provider. Nothing has been changed — please try again or contact support.");
    }
  }

  await admin.from("subscriptions").update({
    cancel_at_period_end:false,
    cancellation_requested_at:null,
    cancellation_requested_by:null,
    updated_at:new Date().toISOString()
  }).eq("id",subscription.id);

  const supabase=await createClient();
  await supabase.from("workspace_activity").insert({
    workspace_id:ws.workspace_id,actor_id:user.id,action:"resumed_subscription"
  });

  revalidatePath("/billing");
}
