import {headers} from "next/headers";

/**
 * Resolves the absolute origin to build OAuth/email redirect URLs from.
 *
 * NEXT_PUBLIC_APP_URL is authoritative when set, because it is the value that
 * must also be registered in Supabase Auth's redirect allow-list and in the
 * Google OAuth client — deriving the origin from request headers alone would
 * let a spoofed Host/X-Forwarded-Host header steer where the auth code is
 * delivered. Header derivation is only a development convenience fallback.
 */
export async function getAppOrigin():Promise<string>{
  const configured=process.env.NEXT_PUBLIC_APP_URL?.trim();
  if(configured)return configured.replace(/\/+$/,"");

  const h=await headers();
  const host=h.get("x-forwarded-host")||h.get("host");
  if(!host)return "http://localhost:3000";
  const proto=h.get("x-forwarded-proto")||(host.startsWith("localhost")||host.startsWith("127.0.0.1")?"http":"https");
  return `${proto}://${host}`;
}
