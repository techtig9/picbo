"use client";
import {useEffect} from "react";
import Link from "next/link";

/**
 * Route-level error boundary.
 *
 * Without this, an unhandled server exception renders Next's default screen:
 * a white page reading "Application error: a server-side exception has
 * occurred (see the server logs for more information)" plus a digest. That
 * tells a visitor nothing and an operator almost nothing.
 *
 * The digest is the one genuinely useful part — it is the key that matches
 * this render to its stack trace in the platform logs — so it is surfaced
 * rather than buried.
 */
export default function ErrorBoundary({
  error,reset
}:{
  error:Error&{digest?:string};
  reset:()=>void;
}){
  useEffect(()=>{
    // Reaches the platform log drain, where it can be correlated with the
    // digest shown below.
    console.error(JSON.stringify({
      level:"error",
      event:"app.unhandled_render_error",
      message:error.message,
      digest:error.digest??null,
      timestamp:new Date().toISOString()
    }));
  },[error]);

  return <main className="auth">
    <div className="auth-card">
      <div className="logo" aria-hidden="true">P</div>
      <h1>Something went wrong</h1>
      <p className="muted">
        This page didn&apos;t load. The error has been logged — trying again often works,
        since most causes are temporary.
      </p>

      {error.digest&&
        <div className="notice" style={{marginTop:16}}>
          <span className="muted small">
            Reference <code>{error.digest}</code> — quote this if you contact support.
          </span>
        </div>
      }

      <div className="form" style={{marginTop:24}}>
        <button className="btn primary" onClick={reset}>Try again</button>
        <Link className="btn" href="/" style={{textAlign:"center"}}>Back to home</Link>
      </div>

      <p className="muted small">
        If you administer this deployment, open{" "}
        <a href="/api/health/check">/api/health/check</a> — it names any missing
        configuration directly.
      </p>
    </div>
  </main>;
}
