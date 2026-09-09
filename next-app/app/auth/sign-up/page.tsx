import Link from "next/link";
import {signUp} from "../actions";
import {GoogleButton} from "@/components/auth/GoogleButton";

export const metadata={title:"Create your account",robots:{index:false,follow:false}};

export default async function SignUp({searchParams}:{searchParams:Promise<{error?:string;next?:string}>}){
  const q=await searchParams;
  const next=q.next||"";

  return <main className="auth">
    <div className="auth-card">
      <div className="logo" aria-hidden="true">P</div>
      <h1>Create your Picbo.ai account</h1>
      <p className="muted">Start creating product content and campaigns.</p>

      {q.error&&<div className="notice error" role="alert">{q.error}</div>}

      <div style={{marginTop:24}}>
        <GoogleButton next={next} label="Sign up with Google"/>
      </div>

      <div className="divider"><span>or</span></div>

      <form action={signUp} className="form">
        <input type="hidden" name="next" value={next}/>
        <label>Name<input name="name" type="text" autoComplete="name" placeholder="Optional"/></label>
        <label>Email<input name="email" type="email" required autoComplete="email"/></label>
        <label>Password<input name="password" type="password" minLength={8} required autoComplete="new-password"/></label>
        <button className="btn primary" type="submit">Create account</button>
      </form>

      <p className="muted">
        Already have an account?{" "}
        <Link href={next?`/auth/sign-in?next=${encodeURIComponent(next)}`:"/auth/sign-in"}>Sign in</Link>
      </p>
    </div>
  </main>;
}
