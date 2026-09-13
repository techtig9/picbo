import type {
  RenderArtifact,
  RenderInput,
  RenderProgress,
} from "./types";

export interface RenderWorker {
  render(
    input: RenderInput,
    onProgress?: (progress: RenderProgress) => void
  ): Promise<RenderArtifact>;
}

/**
 * Adapter boundary for a real queue/container worker.
 * This deliberately does not execute shell commands from a web request.
 */
export class ExternalRenderWorker implements RenderWorker {
  async render(
    _input: RenderInput,
    onProgress?: (progress: RenderProgress) => void
  ): Promise<RenderArtifact> {
    onProgress?.({
      stage: "preparing",
      percent: 5,
      message: "Preparing render inputs",
    });

    throw new Error("RENDER_WORKER_NOT_CONFIGURED");
  }
}
