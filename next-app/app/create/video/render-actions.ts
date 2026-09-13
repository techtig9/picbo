 "use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser, getCurrentWorkspace } from "@/lib/auth";
import { estimateVideoCredits } from "@/lib/video/render";
import { assertStorageQuota } from "@/lib/storage/quota";

// Conservative pre-check estimate before the actual output size is known —
// a typical 15-30s H.264 export at social-media bitrates. Real usage is
// tracked exactly once the render completes (lib/render/lifecycle.ts).
const ESTIMATED_RENDER_OUTPUT_BYTES=50*1024*1024;

export async function queueVideoRender(
  videoProjectId: string,
  idempotencyKey: string,
  renderManifest?: any
) {
  const user = await requireUser();
  const workspace = await getCurrentWorkspace();

  if (!workspace?.workspace_id) {
    throw new Error("WORKSPACE_REQUIRED");
  }

  const supabase = await createClient();

  const { data: video, error: videoError } = await supabase
    .from("video_projects")
    .select("id,duration_seconds,aspect_ratio,brief")
    .eq("id", videoProjectId)
    .eq("workspace_id", workspace.workspace_id)
    .single();

  if (videoError || !video) {
    throw new Error("VIDEO_PROJECT_NOT_FOUND");
  }

  const credits = estimateVideoCredits(video.brief);
  await assertStorageQuota(workspace.workspace_id, ESTIMATED_RENDER_OUTPUT_BYTES);

  const { data: job, error: jobError } = await supabase
    .from("render_jobs")
    .insert({
      workspace_id: workspace.workspace_id,
      video_project_id: videoProjectId,
      created_by: user.id,
      engine: "ffmpeg",
      status: "queued",
      progress: 0,
      stage: "preparing",
      input_manifest: {
        durationSeconds: video.duration_seconds,
        aspectRatio: video.aspect_ratio,
        brief: video.brief,
        ...(renderManifest || {}),
        // After the spread on purpose: estimatedCredits is what failRenderJob
        // refunds, so a client-supplied manifest key must never be able to
        // overwrite the server's own estimate.
        estimatedCredits: credits,
      },
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (jobError) {
    if (jobError.code === "23505") {
      const { data: existing } = await supabase
        .from("render_jobs")
        .select("id,status,progress,stage")
        .eq("workspace_id", workspace.workspace_id)
        .eq("idempotency_key", idempotencyKey)
        .single();

      return existing;
    }

    throw jobError;
  }

  // Reserve credits before the long-running worker starts.
  const { error: creditError } = await supabase.rpc("reserve_credits", {
    wid: workspace.workspace_id,
    amount_to_charge: credits,
    idem: `render:${job.id}:charge`,
    ref: job.id,
  });

  if (creditError) {
    await supabase
      .from("render_jobs")
      .update({
        status: "failed",
        error_code: "INSUFFICIENT_CREDITS",
        error_message: creditError.message,
      })
      .eq("id", job.id);

    throw new Error("INSUFFICIENT_CREDITS");
  }

  await supabase.from("render_events").insert({
    render_job_id: job.id,
    stage: "preparing",
    progress: 5,
    message: "Render queued",
  });

  return {
    renderJobId: job.id,
    estimatedCredits: credits,
        ...(renderManifest || {}),
  };
}
