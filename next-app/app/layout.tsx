import type {Metadata,Viewport} from "next";
import {ThemeScript} from "@/components/theme-script";
import "./globals.css";

export const metadata:Metadata={
  title:{default:"Picbo.ai — AI Product-to-Advertising Platform",template:"%s · Picbo.ai"},
  description:"Turn a single product photo into photoshoots, ads, video and Shorts with AI.",
  // Public marketing routes (/, /pricing) are indexable and set their own
  // metadata. Authenticated routes are marked noindex centrally in
  // middleware — a blanket noindex here also hid the landing and pricing
  // pages, which is the entire public surface of the site.
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

export const viewport:Viewport={
  width:"device-width",
  initialScale:1,
  // Never lock zoom: pinch-to-zoom is an accessibility requirement
  // (WCAG 2.2 1.4.4), not a layout inconvenience.
  maximumScale:5,
  themeColor:[
    {media:"(prefers-color-scheme: light)",color:"#F8FAFC"},
    {media:"(prefers-color-scheme: dark)",color:"#0A0D14"}
  ]
};

export default function RootLayout({children}:{children:React.ReactNode}){
  // suppressHydrationWarning: ThemeScript sets data-theme on <html> before
  // React hydrates, so server and client markup differ here by design.
  return <html lang="en" suppressHydrationWarning>
    <head><ThemeScript/></head>
    <body>{children}</body>
  </html>;
}
