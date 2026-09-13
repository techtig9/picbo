import {createClient} from "@/lib/supabase/server";
export function safeAssetPath(workspaceId:string,assetId:string,fileName:string){const clean=fileName.replace(/[^a-zA-Z0-9._-]/g,"-");return `${workspaceId}/${assetId}/${crypto.randomUUID()}-${clean}`;}
export async function createSignedAssetUrl(path:string,expiresIn=3600){const supabase=await createClient();const {data,error}=await supabase.storage.from("picbo-assets").createSignedUrl(path,expiresIn);if(error)throw error;return data.signedUrl;}
