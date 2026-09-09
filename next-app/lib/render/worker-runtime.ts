export type WorkerJob = {
  id:string;
  workspace_id:string;
  video_project_id:string;
  input_manifest:any;
  attempts:number;
};

export type WorkerConfig = {
  workerId:string;
  leaseSeconds:number;
  maxAttempts:number;
};

export function nextRetryDelay(attempt:number){
  return Math.min(300, Math.max(5, 5 * Math.pow(2, Math.max(0,attempt-1))));
}

export function canRetry(attempt:number,maxAttempts:number){
  return attempt < maxAttempts;
}

export function leasePayload(workerId:string,leaseSeconds:number){
  return {
    worker_id:workerId,
    lease_expires_at:new Date(Date.now()+leaseSeconds*1000).toISOString()
  };
}
