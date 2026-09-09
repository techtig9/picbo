export interface RenderQueueMessage {
  renderJobId:string;
  workspaceId:string;
  videoProjectId:string;
  estimatedCredits:number;
}

export function renderQueuePayload(job:any):RenderQueueMessage{
  return {
    renderJobId:job.id,
    workspaceId:job.workspace_id,
    videoProjectId:job.video_project_id,
    estimatedCredits:Number(job.input_manifest?.estimatedCredits||0)
  };
}
