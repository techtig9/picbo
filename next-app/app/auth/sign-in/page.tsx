import Link from "next/link";
import {signIn} from "../actions";

export default async function SignIn({searchParams}:{searchParams:Promise<{error?:string;message?:string;next?:string}>}){
  const q=await searchParams;
  return <main className="auth">
    <div className="auth-card">
      <div className="logo">P</div>
      <h1>Welcome to Picbo.ai</h1>
      <p className="muted">Sign in to your creative workspace.</p>
      {q.error&&<div className="notice error">{q.error}</div>}
      {q.message&&<div className="notice">{q.message}</div>}
      <form action={signIn} className="form">
        <input type="hidden" name="next" value={q.next||""}/>
        <label>Email<input name="email" type="email" required autoComplete="email"/></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password"/></label>
        <button className="btn primary" type="submit">Sign in</button>
      </form>
      <p className="muted">Don't have an account? <Link href={q.next?`/auth/sign-up?next=${encodeURIComponent(q.next)}`:"/auth/sign-up"}>Create one</Link></p>
    </div>
  </main>;
}
