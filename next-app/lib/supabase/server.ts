import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

/**
 * Request-scoped Supabase client.
 *
 * Degrades instead of crashing when credentials are absent.
 *
 * `createServerClient(undefined!, undefined!)` throws
 * "Your project's URL and Key are required to create a Supabase client!" —
 * and because every server page calls this, a deployment without env vars
 * showed Next's default white "Application error: a server-side exception has
 * occurred" screen on the landing page. Nothing on that screen tells the
 * operator what is wrong, and a visitor just sees a broken site.
 *
 * Note this is NOT the same failure as the middleware one fixed alongside it:
 * that was `MIDDLEWARE_INVOCATION_FAILED` at the edge, this is the page
 * render itself. Guarding middleware fixed the routes that never touch
 * Supabase (`/pricing` is fully static); it did nothing for `/`, which reads
 * the session to decide whether to redirect a signed-in user to the dashboard.
 *
 * When unconfigured, callers get a client that reports "signed out" and
 * returns a named error for any query, so pages render their logged-out state
 * and anything needing data fails loudly with a message that says why.
 */

export function isSupabaseConfigured():boolean{
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export const SUPABASE_NOT_CONFIGURED={
  message:"Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.",
  code:"SUPABASE_NOT_CONFIGURED",
  details:"",
  hint:"See /api/health/check for the full list of missing variables."
} as const;

/**
 * Stand-in used only when credentials are missing.
 *
 * Every query resolves to `{data:null, error:SUPABASE_NOT_CONFIGURED}` rather
 * than throwing, and `auth.getUser()` reports no user — which is truthful:
 * without credentials nobody *can* be signed in. It deliberately does not
 * pretend a query succeeded, so a misconfigured production deploy surfaces a
 * real error instead of rendering as an empty-but-working app.
 */
function unconfiguredClient(){
  const failure=Promise.resolve({data:null,error:SUPABASE_NOT_CONFIGURED});

  // Any chained query builder call returns the same thenable, so
  // `.from(x).select(y).eq(...).maybeSingle()` resolves to the error at
  // whatever depth the caller stops chaining.
  const builder:any=new Proxy(function(){} as any,{
    get(_target,prop){
      if(prop==="then")return failure.then.bind(failure);
      if(prop==="catch")return failure.catch.bind(failure);
      if(prop==="finally")return failure.finally.bind(failure);
      return ()=>builder;
    },
    apply(){return builder}
  });

  return {
    auth:{
      getUser:async()=>({data:{user:null},error:SUPABASE_NOT_CONFIGURED}),
      getSession:async()=>({data:{session:null},error:SUPABASE_NOT_CONFIGURED}),
      signInWithPassword:async()=>({data:{user:null,session:null},error:SUPABASE_NOT_CONFIGURED}),
      signInWithOAuth:async()=>({data:{url:null,provider:"google"},error:SUPABASE_NOT_CONFIGURED}),
      signUp:async()=>({data:{user:null,session:null},error:SUPABASE_NOT_CONFIGURED}),
      signOut:async()=>({error:null}),
      exchangeCodeForSession:async()=>({data:{session:null,user:null},error:SUPABASE_NOT_CONFIGURED}),
      verifyOtp:async()=>({data:{session:null,user:null},error:SUPABASE_NOT_CONFIGURED}),
      resetPasswordForEmail:async()=>({data:null,error:SUPABASE_NOT_CONFIGURED}),
      updateUser:async()=>({data:{user:null},error:SUPABASE_NOT_CONFIGURED})
    },
    from:()=>builder,
    rpc:async()=>({data:null,error:SUPABASE_NOT_CONFIGURED}),
    storage:{
      from:()=>({
        upload:async()=>({data:null,error:SUPABASE_NOT_CONFIGURED}),
        remove:async()=>({data:null,error:SUPABASE_NOT_CONFIGURED}),
        list:async()=>({data:null,error:SUPABASE_NOT_CONFIGURED}),
        createSignedUrl:async()=>({data:null,error:SUPABASE_NOT_CONFIGURED}),
        createSignedUrls:async()=>({data:null,error:SUPABASE_NOT_CONFIGURED})
      })
    }
  };
}

/**
 * Builds the real client. Split out so its return type can be *inferred* and
 * reused below.
 *
 * Annotating createClient() as `ReturnType<typeof createServerClient>` looked
 * equivalent but was not: that resolves the function's generic defaults, so
 * `.select()` came back as `any` and every `.map(r => …)` callback across the
 * app lost its parameter type under `noImplicitAny`. Inferring from a concrete
 * call keeps the precise instantiation callers had before.
 */
function realClient(cookieStore:Awaited<ReturnType<typeof cookies>>){
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies:{
        getAll(){return cookieStore.getAll()},
        setAll(cookiesToSet){
          try{
            cookiesToSet.forEach(({name,value,options})=>cookieStore.set(name,value,options));
          }catch{
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        }
      }
    }
  );
}

type ServerClient=ReturnType<typeof realClient>;

export async function createClient(){
  // Read cookies on BOTH paths, even though the unconfigured stub does not use
  // them. Touching a dynamic API is what tells Next.js this render cannot be
  // prerendered — skipping it on the unconfigured path made pages that call
  // requireUser() eligible for static prerendering, and the build then failed
  // with "Error: UNAUTHENTICATED" while generating them. Keeping the call here
  // preserves each route's original dynamic/static classification whether or
  // not credentials are present.
  const cookieStore=await cookies();

  if(!isSupabaseConfigured()){
    // Cast rather than widen: callers keep the real client's types, and the
    // stub only has to satisfy the shape they actually use.
    return unconfiguredClient() as unknown as ServerClient;
  }
  return realClient(cookieStore);
}
