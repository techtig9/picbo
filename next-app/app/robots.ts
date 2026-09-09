import type {MetadataRoute} from "next";

/**
 * The previous version emitted `Allow: /` and `Disallow: /` at the same time.
 * Google resolves that tie in favour of Allow, but most other crawlers take
 * the restrictive reading and drop the entire site. It also advertised no
 * sitemap.
 *
 * Explicit now: the public marketing surface is crawlable, everything behind
 * authentication is not. Individual app routes additionally set
 * `robots: {index:false}` in their own metadata, so this is defence in depth
 * rather than the only control.
 */
export default function robots():MetadataRoute.Robots{
  const base=process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000";
  return {
    rules:[{
      userAgent:"*",
      allow:["/"],
      disallow:[
        "/api/",
        "/auth/",
        "/dashboard",
        "/admin",
        "/settings",
        "/billing",
        "/team",
        "/developer",
        "/projects",
        "/products",
        "/assets",
        "/campaigns",
        "/brand-kits",
        "/templates",
        "/analytics",
        "/integrations",
        "/create",
        "/lumi",
        "/notifications",
        "/invite/",
        "/share/"
      ]
    }],
    sitemap:`${base}/sitemap.xml`
  };
}
