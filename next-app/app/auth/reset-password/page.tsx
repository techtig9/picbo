import Link from "next/link";
import {updatePassword} from "../actions";

export const metadata={title:"Set a new password",robots:{index:false,follow:false}};

export default async function ResetPassword({searchParams}:{searchParams:Promise<{error?:string}>}){
  const q=await searchParams;

  return <main className="auth">
    <div className="auth-card">
      <div className="logo" aria-hidden="true">P</div>
      <h1>Set a new password</h1>
      <p className="muted">Choose a password you don&apos;t use anywhere else. At least 8 characters.</p>
      {q.error&&<div className="notice error" role="alert">{q.error}</div>}
      <form action={updatePassword} className="form">
        <label>New password<input name="password" type="password" minLength={8} required autoComplete="new-password" autoFocus/></label>
        <label>Confirm new password<input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password"/></label>
        <button className="btn primary" type="submit">Update password</button>
      </form>
      <p className="muted">Link expired? <Link href="/auth/forgot-password">Request a new one</Link>.</p>
    </div>
  </main>;
}
