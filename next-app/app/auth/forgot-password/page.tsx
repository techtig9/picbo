import Link from "next/link";
import {requestPasswordReset} from "../actions";

export const metadata={title:"Reset your password",robots:{index:false,follow:false}};

export default async function ForgotPassword({searchParams}:{searchParams:Promise<{sent?:string}>}){
  const q=await searchParams;

  if(q.sent){
    return <main className="auth">
      <div className="auth-card">
        <div className="logo" aria-hidden="true">P</div>
        <h1>Check your email</h1>
        <p className="muted">
          If an account exists for that address, we&apos;ve sent a link to reset your password.
          The link is valid for one hour and can only be used once.
        </p>
        <p className="muted">Didn&apos;t get it? Check your spam folder, or <Link href="/auth/forgot-password">try again</Link>.</p>
        <div className="form" style={{marginTop:24}}>
          <Link className="btn" href="/auth/sign-in" style={{textAlign:"center"}}>Back to sign in</Link>
        </div>
      </div>
    </main>;
  }

  return <main className="auth">
    <div className="auth-card">
      <div className="logo" aria-hidden="true">P</div>
      <h1>Reset your password</h1>
      <p className="muted">Enter the email address on your account and we&apos;ll send you a link to set a new password.</p>
      <form action={requestPasswordReset} className="form">
        <label>Email<input name="email" type="email" required autoComplete="email" autoFocus/></label>
        <button className="btn primary" type="submit">Send reset link</button>
      </form>
      <p className="muted">Remembered it? <Link href="/auth/sign-in">Sign in</Link></p>
    </div>
  </main>;
}
