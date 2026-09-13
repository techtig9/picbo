import type {NextConfig} from "next";

/**
 * Security headers.
 *
 * There were none. Every one below closes a real, testable gap, and each is
 * scoped to what this app actually needs rather than copied wholesale:
 *
 * - Picbo renders user-supplied and AI-generated images from signed Supabase
 *   Storage URLs, so `img-src` has to allow that origin but nothing else.
 * - Paddle's checkout runs in an iframe it owns, so `frame-src` allows Paddle
 *   and nothing else.
 * - `frame-ancestors 'none'` is the clickjacking control. It replaces
 *   X-Frame-Options, which is kept alongside it only for older browsers.
 *
 * `'unsafe-inline'` on script-src is a real, acknowledged weakening: Next's
 * App Router inlines hydration bootstrap, and the pre-paint theme script must
 * run inline to avoid a flash of the wrong theme. Removing it requires
 * per-request nonces threaded through middleware, which is worth doing and is
 * recorded in PICBO_REMAINING_ISSUES.md rather than quietly skipped.
 */

const supabaseOrigin=(()=>{
  try{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url?new URL(url).origin:"";
  }catch{return ""}
})();

const contentSecurityPolicy=[
  "default-src 'self'",
  // See note above on 'unsafe-inline'.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // blob: covers client-side previews of a file the user just picked, before
  // it has been uploaded.
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  `media-src 'self' blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} https://api.paddle.com https://sandbox-api.paddle.com`.trim(),
  "frame-src 'self' https://*.paddle.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  // Stops a stolen form action from posting credentials off-site.
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
].join("; ");

const securityHeaders=[
  {key:"Content-Security-Policy",value:contentSecurityPolicy},
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"X-Frame-Options",value:"DENY"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  // Nothing in Picbo needs these; denying them means a compromised dependency
  // cannot silently request them either.
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), interest-cohort=()"},
  // Two years, with preload eligibility. Only meaningful over HTTPS, which is
  // where this ships.
  {key:"Strict-Transport-Security",value:"max-age=63072000; includeSubDomains; preload"},
  {key:"X-DNS-Prefetch-Control",value:"off"}
];

const nextConfig:NextConfig={
  reactStrictMode:true,
  // Do not advertise the framework and version to anyone scanning for
  // known-vulnerable releases.
  poweredByHeader:false,
  async headers(){
    return [
      {source:"/:path*",headers:securityHeaders},
      {
        // Signed URLs and per-user JSON must never be held in a shared cache.
        source:"/api/:path*",
        headers:[{key:"Cache-Control",value:"no-store, max-age=0"}]
      }
    ];
  }
};

export default nextConfig;
