export type RenderEngine = "ffmpeg" | "video_provider";

export interface RenderInput {
  videoProjectId: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  scenes: Array<{
    assetUrl?: string;
    durationMs: number;
    motion: string;
    transition: string;
    text?: string;
  }>;
  audio?: { musicUrl?: string; voiceUrl?: string };
  captions?: Array<{ startMs: number; endMs: number; text: string }>;
  logoUrl?: string;
}

export interface RenderArtifact {
  path: string;
  mimeType: string;
  width: number;
  height: number;
  durationMs: number;
  engine: RenderEngine;
}

export interface RenderProgress {
  stage:
    | "preparing"
    | "compositing"
    | "audio"
    | "encoding"
    | "uploading"
    | "completed"
    | "failed";
  percent: number;
  message: string;
}

export function outputSpec(width: number, height: number) {
  return {
    width,
    height,
    fps: 30,
    videoCodec: "libx264",
    audioCodec: "aac",
    pixelFormat: "yuv420p",
    format: "mp4",
  };
}
