 "use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
export async function signIn(formData:FormData){
 const email=String(formData.get("email")||"");const password=String(formData.get("password")||"");
 const next=String(formData.get("next")||"");
 const safeNext=next.startsWith("/")&&!next.startsWith("//")?next:"/dashboard";
 const supabase=await createClient();const {error}=await supabase.auth.signInWithPassword({email,password});
 if(error)redirect("/auth/sign-in?error="+encodeURIComponent(error.message)+(next?`&next=${encodeURIComponent(next)}`:""));
 redirect(safeNext);
}
export async function signUp(formData:FormData){
 const email=String(formData.get("email")||"");const password=String(formData.get("password")||"");
 const supabase=await createClient();const {error}=await supabase.auth.signUp({email,password});
 if(error)redirect("/auth/sign-up?error="+encodeURIComponent(error.message));
 redirect("/auth/sign-in?message=Check your email to confirm your account");
}
export async function signOut(){const supabase=await createClient();await supabase.auth.signOut();redirect("/auth/sign-in");}
