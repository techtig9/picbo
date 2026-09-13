import type {MetadataRoute} from "next";

/**
 * Only genuinely public, indexable routes belong here. Listing an
 * authenticated route in a sitemap invites crawlers to request it, which
 * produces a stream of redirects to /auth/sign-in and dilutes crawl budget.
 */
export default function sitemap():MetadataRoute.Sitemap{
  const base=(process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000").replace(/\/+$/,"");
  const lastModified=new Date();
  return [
    {url:`${base}/`,lastModified,changeFrequency:"weekly",priority:1},
    {url:`${base}/pricing`,lastModified,changeFrequency:"weekly",priority:0.8},
    {url:`${base}/legal/privacy`,lastModified,changeFrequency:"yearly",priority:0.3},
    {url:`${base}/legal/terms`,lastModified,changeFrequency:"yearly",priority:0.3}
  ];
}
