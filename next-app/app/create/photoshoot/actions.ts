"use server";
import {createClient} from "@/lib/supabase/server";
import {getCurrentWorkspace,requireUser} from "@/lib/auth";
import {buildProductShootPrompt} from "@/lib/creative/prompt";
import type {PhotoshootRequest} from "@/lib/creative/types";
import {submitGenerationJob} from "@/lib/ai/jobs";
import {revalidatePath} from "next/cache";

/**
 * Starts a product photoshoot.
 *
 * Two changes in Phase 2:
 *
 * 1. `image` is a media task, so it now goes through submitGenerationJob and
 *    returns as soon as the job is durably recorded. It previously ran inline
 *    and held the request open for the whole provider round trip.
 *
 * 2. The shoot and its shot items are no longer written as `completed` at
 *    submission time. They used to be marked completed immediately — before
 *    the provider had returned anything — so a shoot that later failed still
 *    showed as a finished photoshoot with no images in it. They start
 *    `queued` and the job's real status drives what the UI shows.
 */
export async function createPhotoshoot(input:PhotoshootRequest){
  const user=await requireUser();
  const ws=await getCurrentWorkspace();
  if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");

  const supabase=await createClient();
  const {data:product}=await supabase.from("products")
    .select("id,name").eq("id",input.productId).eq("workspace_id",ws.workspace_id).maybeSingle();
  if(!product)throw new Error("PRODUCT_NOT_FOUND");

  // If this product has a completed Product Identity analysis, use its real,
  // specific prompt context/negative constraints instead of the generic
  // "preserve identity" boilerplate.
  let identityContext:{promptContext?:string;negativeConstraints?:string}|undefined;
  if(input.preserveProductIdentity){
    const {data:identity}=await supabase.from("product_identity")
      .select("identity_status,prompt_context,negative_constraints")
      .eq("product_id",input.productId).eq("workspace_id",ws.workspace_id).maybeSingle();
    if(identity?.identity_status==="ready"){
      identityContext={
        promptContext:identity.prompt_context||undefined,
        negativeConstraints:identity.negative_constraints||undefined
      };
    }
  }

  const {data:shoot,error}=await supabase.from("creative_shoots").insert({
    workspace_id:ws.workspace_id,product_id:input.productId,created_by:user.id,
    name:`${product.name} AI Photoshoot`,request:input,status:"queued"
  }).select("id").single();
  if(error)throw error;

  const prompt=buildProductShootPrompt(input,identityContext);

  try{
    const submitted=await submitGenerationJob({
      task:"image",
      quality:"balanced",
      prompt,
      aspectRatio:input.aspectRatio,
      productId:input.productId,
      metadata:{shootId:shoot.id,referenceAssetIds:input.referenceAssetIds}
    });

    await supabase.from("creative_shoots").update({status:"running"}).eq("id",shoot.id);

    await supabase.from("creative_shot_items").insert(
      input.shotTypes.flatMap(shot=>
        Array.from({length:Math.max(1,input.variants)},(_,v)=>({
          shoot_id:shoot.id,
          job_id:submitted.jobId,
          shot_type:shot,
          aspect_ratio:input.aspectRatio,
          status:"queued",
          variant_no:v+1,
          prompt
        }))
      )
    );

    revalidatePath("/create/photoshoot");
    return {shootId:shoot.id,jobId:submitted.jobId,creditCost:submitted.creditCost};
  }catch(e){
    await supabase.from("creative_shoots").update({status:"failed"}).eq("id",shoot.id);
    throw e;
  }
}
