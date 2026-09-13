"use client";
import {useEffect} from "react";

/**
 * Last-resort boundary, for failures in the root layout itself.
 *
 * This replaces the whole document, so it must render its own <html> and
 * <body> and cannot rely on the app stylesheet having loaded — which is
 * exactly the situation where a shared stylesheet would be the thing that
 * failed. Hence the inline styles, which are deliberate here and nowhere else.
 */
export default function GlobalError({
  error,reset
}:{
  error:Error&{digest?:string};
  reset:()=>void;
}){
  useEffect(()=>{
    console.error(JSON.stringify({
      level:"error",
      event:"app.global_error",
      message:error.message,
      digest:error.digest??null,
      timestamp:new Date().toISOString()
    }));
  },[error]);

  return <html lang="en">
    <body style={{
      margin:0,minHeight:"100vh",display:"grid",placeItems:"center",padding:24,
      background:"#F8FAFC",color:"#0B1220",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    }}>
      <div style={{maxWidth:420,textAlign:"center"}}>
        <div style={{
          width:40,height:40,margin:"0 auto 20px",borderRadius:10,
          background:"linear-gradient(135deg,#6D5EF8,#06B6D4)",color:"#fff",
          display:"grid",placeItems:"center",fontWeight:800
        }}>P</div>
        <h1 style={{fontSize:22,margin:"0 0 12px"}}>Picbo couldn&apos;t start</h1>
        <p style={{color:"#475569",fontSize:15,lineHeight:1.55,margin:"0 0 8px"}}>
          Something failed before the page could render. This is usually a configuration
          problem rather than anything you did.
        </p>
        {error.digest&&
          <p style={{color:"#64748B",fontSize:13,margin:"0 0 20px"}}>
            Reference <code>{error.digest}</code>
          </p>
        }
        <button
          onClick={reset}
          style={{
            minHeight:40,padding:"0 20px",border:"1px solid #6D5EF8",borderRadius:10,
            background:"#6D5EF8",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"
          }}
        >Try again</button>
        <p style={{color:"#64748B",fontSize:13,marginTop:24}}>
          Administering this deployment? Open{" "}
          <a href="/api/health/check" style={{color:"#5B4BE0"}}>/api/health/check</a>.
        </p>
      </div>
    </body>
  </html>;
}
