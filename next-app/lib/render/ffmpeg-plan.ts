import type { RenderInput } from "./types";
import { outputSpec } from "./types";

export function escapeFilterText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

export function buildFilterPlan(input: RenderInput) {
  const filters: string[] = [];
  let offset = 0;

  for (const scene of input.scenes) {
    const start = (offset / 1000).toFixed(3);
    const end = ((offset + scene.durationMs) / 1000).toFixed(3);

    if (scene.text) {
      filters.push(
        `drawtext=text='${escapeFilterText(scene.text)}':` +
        `x=(w-text_w)/2:y=h*0.78:` +
        `enable='between(t,${start},${end})'`
      );
    }

    offset += scene.durationMs;
  }

  return {
    filters,
    durationMs: offset,
    output: outputSpec(input.width, input.height),
  };
}

/**
 * Produces a render plan only.
 * Actual FFmpeg execution belongs in a worker/container, never in a
 * Next.js request handler.
 */
export function buildRenderCommand(input: RenderInput) {
  const plan = buildFilterPlan(input);

  return {
    inputs: input.scenes.map((scene) => scene.assetUrl).filter(Boolean),
    filterComplex: plan.filters.join(","),
    outputOptions: [
      "-r", "30",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-movflags", "+faststart",
    ],
    durationMs: plan.durationMs,
  };
}
