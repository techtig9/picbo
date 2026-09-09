import { NextResponse } from "next/server";
import { queueVideoRender } from "@/app/create/video/render-actions";
import { validateRenderManifest } from "@/app/create/video/render-manifest";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.videoProjectId) {
      return NextResponse.json(
        { error: "videoProjectId is required" },
        { status: 400 }
      );
    }

    const manifest = body.assets || body.scenes ? validateRenderManifest(body) : undefined;
    const result = await queueVideoRender(
      body.videoProjectId,
      String(body.idempotencyKey || crypto.randomUUID()),
      manifest
    );

    return NextResponse.json(result);
  } catch (error: any) {
    const message = error?.message || "UNKNOWN_ERROR";

    return NextResponse.json(
      { error: message },
      {
        status:
          message === "UNAUTHENTICATED"
            ? 401
            : message === "INSUFFICIENT_CREDITS"
              ? 402
              : 500,
      }
    );
  }
}
