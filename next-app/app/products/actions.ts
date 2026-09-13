 "use server";
import {createClient} from "@/lib/supabase/server";import {requireUser,getCurrentWorkspace} from "@/lib/auth";import {revalidatePath} from "next/cache";
export async function createProduct(formData:FormData){
 const user=await requireUser();const ws=await getCurrentWorkspace();if(!ws?.workspace_id)throw new Error("WORKSPACE_REQUIRED");
 const name=String(formData.get("name")||"").trim();if(!name)throw new Error("PRODUCT_NAME_REQUIRED");
 const supabase=await createClient();const {data,error}=await supabase.from("products").insert({workspace_id:ws.workspace_id,name,sku:String(formData.get("sku")||"").trim()||null,description:String(formData.get("description")||"").trim()||null,brand:String(formData.get("brand")||"").trim()||null,created_by:user.id}).select("id").single();
 if(error)throw error;revalidatePath("/products");return data;
}
