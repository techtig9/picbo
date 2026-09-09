"use server";
import {createClient} from "@/lib/supabase/server";
import {requireUser,getCurrentWorkspace} from "@/lib/auth";
import {getPaymentProvider} from "@/lib/billing/payment-provider";
import {planById} from "@/lib/billing/plans";

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

export async function cancelSubscription(){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
  const supabase=await createClient();
  const {error}=await supabase.from("subscriptions").update({cancel_at_period_end:true}).eq("workspace_id",ws.workspace_id);
  if(error)throw error;
  await supabase.from("workspace_activity").insert({workspace_id:ws.workspace_id,actor_id:user.id,action:"requested_cancellation"});
}
