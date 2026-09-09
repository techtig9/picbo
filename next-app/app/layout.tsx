import type {Metadata} from "next";
import "./globals.css";

export const metadata:Metadata={
  title:{default:"Picbo.ai — AI Product-to-Advertising Platform",template:"%s · Picbo.ai"},
  description:"Turn a single product photo into photoshoots, ads, video and Shorts with AI.",
  // Public marketing routes (/, /pricing) are indexable and set their own
  // metadata. Authenticated routes opt OUT individually via their own
  // `robots` export — a blanket noindex here also suppressed the landing
  // page and pricing page, which is the entire public surface of the site.
  metadataBase:new URL(process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000"),
  openGraph:{
    type:"website",
    siteName:"Picbo.ai",
    title:"Picbo.ai — AI Product-to-Advertising Platform",
    description:"Turn a single product photo into photoshoots, ads, video and Shorts with AI."
  },
  twitter:{
    card:"summary_large_image",
    title:"Picbo.ai — AI Product-to-Advertising Platform",
    description:"Turn a single product photo into photoshoots, ads, video and Shorts with AI."
  }
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
