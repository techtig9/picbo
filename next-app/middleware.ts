import {NextResponse,type NextRequest} from "next/server";
import {createServerClient} from "@supabase/ssr";
export async function middleware(request:NextRequest){
 let response=NextResponse.next({request});
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
  cookies:{getAll(){return request.cookies.getAll()},setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}
 });
 const {data:{user}}=await supabase.auth.getUser();
 const path=request.nextUrl.pathname;
 const publicPath=path==="/"||path==="/pricing"||path.startsWith("/invite/")||path.startsWith("/share/")||path.startsWith("/auth")||path.startsWith("/api/auth");
 if(!user&&!publicPath)return NextResponse.redirect(new URL("/auth/sign-in",request.url));
 if(user&&path.startsWith("/auth"))return NextResponse.redirect(new URL("/dashboard",request.url));
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
