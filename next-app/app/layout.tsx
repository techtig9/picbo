import type {Metadata} from "next";
import "./globals.css";

export const metadata:Metadata={
  title:{default:"Picbo.ai — AI Product-to-Advertising Platform",template:"%s · Picbo.ai"},
  description:"Turn a single product photo into photoshoots, ads, video and Shorts with AI.",
  robots:{index:false,follow:false} // this app is entirely behind auth — there is no public content to index
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
