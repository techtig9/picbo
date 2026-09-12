import {NextResponse} from "next/server";
import {getShellContext} from "@/lib/ui/shell-context";

/**
 * Workspace name, credit balance and user initials for the app shell.
 *
 * Server-rendered pages pass this straight into <AppShell context={…}>. Client
 * pages (the studios) cannot call a server function, so they fetch it here
 * instead — one small request rather than restructuring 25 routes into a
 * layout group.
 *
 * Behind the session gate, so the workspace is always the caller's own.
 */
export async function GET(){
  const context=await getShellContext();
  return NextResponse.json(context,{
    // Per-user data: must never be held in a shared cache.
    headers:{"cache-control":"private, no-store"}
  });
}
