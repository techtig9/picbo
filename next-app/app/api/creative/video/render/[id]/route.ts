import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspace = await getCurrentWorkspace();

    if (!workspace?.workspace_id) {
      return NextResponse.json(
        { error: "WORKSPACE_REQUIRED" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("render_jobs")
      .select(
        "id,status,progress,stage,output_manifest,error_code,error_message,created_at,started_at,completed_at"
      )
      .eq("id", id)
      .eq("workspace_id", workspace.workspace_id)
      .single();

    if (error) throw error;

    return NextResponse.json({ job: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}
