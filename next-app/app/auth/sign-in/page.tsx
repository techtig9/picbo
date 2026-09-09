import Link from "next/link";
import {signIn} from "../actions";
import {GoogleButton} from "@/components/auth/GoogleButton";

export const metadata={title:"Sign in",robots:{index:false,follow:false}};

export default async function SignIn({searchParams}:{searchParams:Promise<{error?:string;message?:string;next?:string}>}){
  const q=await searchParams;
  const next=q.next||"";

  return <main className="auth">
    <div className="auth-card">
      <div className="logo" aria-hidden="true">P</div>
      <h1>Welcome to Picbo.ai</h1>
      <p className="muted">Sign in to your creative workspace.</p>

      {q.error&&<div className="notice error" role="alert">{q.error}</div>}
      {q.message&&<div className="notice" role="status">{q.message}</div>}

      <div style={{marginTop:24}}>
        <GoogleButton next={next} label="Sign in with Google"/>
      </div>

      <div className="divider"><span>or</span></div>

      <form action={signIn} className="form">
        <input type="hidden" name="next" value={next}/>
        <label>Email<input name="email" type="email" required autoComplete="email"/></label>
        <label>
          <span className="label-row">
            Password
            <Link href="/auth/forgot-password" className="label-link">Forgot?</Link>
          </span>
          <input name="password" type="password" required autoComplete="current-password"/>
        </label>
        <button className="btn primary" type="submit">Sign in</button>
      </form>

      <p className="muted">
        Don&apos;t have an account?{" "}
        <Link href={next?`/auth/sign-up?next=${encodeURIComponent(next)}`:"/auth/sign-up"}>Create one</Link>
      </p>
    </div>
  </main>;
}
