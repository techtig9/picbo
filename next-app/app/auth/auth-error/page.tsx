import Link from "next/link";
import {safeNextPath} from "@/lib/auth/safe-redirect";

/**
 * Every auth failure lands here with an explanation and a way forward.
 *
 * This page exists specifically so that a failed Google sign-in can never
 * again present as a blank screen: previously the callback route did not
 * exist, so the provider redirect hit a 404 that rendered as dark-on-dark
 * emptiness with no message and no recovery action.
 */

const REASONS:Record<string,{title:string;body:string;retry:boolean}>={
  cancelled:{
    title:"Sign-in was cancelled",
    body:"You closed the Google consent screen before finishing. Nothing was changed on your account — you can try again whenever you're ready.",
    retry:true
  },
  provider_error:{
    title:"Google couldn't complete the sign-in",
    body:"Google returned an error instead of signing you in. This is usually temporary. If it keeps happening, try signing in with your email and password instead.",
    retry:true
  },
  missing_code:{
    title:"That sign-in link is incomplete",
    body:"The callback was opened without an authorization code. This happens if the link was truncated, opened directly, or reopened from history. Start the sign-in again from the beginning.",
    retry:true
  },
  exchange_failed:{
    title:"That sign-in link has already been used or expired",
    body:"Sign-in links can only be used once and are valid for a few minutes. This also happens if you started signing in in a different browser or a private window. Please sign in again.",
    retry:true
  },
  session_expired:{
    title:"Your session expired",
    body:"You've been signed out for security. Sign in again to pick up where you left off.",
    retry:true
  },
  not_configured:{
    // Shown by middleware when a deployment has no Supabase credentials yet.
    // Without this the whole app returned an opaque MIDDLEWARE_INVOCATION_FAILED.
    title:"This deployment isn't configured yet",
    body:"Picbo needs its Supabase credentials before anyone can sign in. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in your hosting environment, then redeploy. Open /api/health/check to see exactly what is still missing.",
    retry:false
  }
};

const FALLBACK={
  title:"We couldn't sign you in",
  body:"Something went wrong during authentication. Please try again — if the problem continues, contact support and include the detail shown below.",
  retry:true
};

export const metadata={title:"Sign-in problem",robots:{index:false,follow:false}};

export default async function AuthErrorPage({searchParams}:{searchParams:Promise<{reason?:string;detail?:string;next?:string}>}){
  const q=await searchParams;
  const info=(q.reason&&REASONS[q.reason])||FALLBACK;
  const next=q.next?safeNextPath(q.next):"";
  const retryHref=next?`/auth/sign-in?next=${encodeURIComponent(next)}`:"/auth/sign-in";

  return <main className="auth">
    <div className="auth-card">
      <div className="logo" aria-hidden="true">P</div>
      <h1>{info.title}</h1>
      <p className="muted">{info.body}</p>

      {q.detail&&
        <details className="notice" style={{marginTop:16}}>
          <summary style={{cursor:"pointer"}}>Technical detail</summary>
          <p style={{marginBottom:0,wordBreak:"break-word"}}>{q.detail}</p>
        </details>
      }

      <div className="form" style={{marginTop:24}}>
        {info.retry&&<Link className="btn primary" href={retryHref} style={{textAlign:"center"}}>Try signing in again</Link>}
        <Link className="btn" href="/" style={{textAlign:"center"}}>Back to home</Link>
      </div>

      <p className="muted">Still stuck? <Link href="/help">Get help</Link>.</p>
    </div>
  </main>;
}
