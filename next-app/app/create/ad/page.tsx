import {redirect} from "next/navigation";
// This route was a duplicate placeholder shell that shipped alongside the
// real Ad Studio at /create/ads and was never linked from navigation (a dead
// page). Redirecting rather than deleting keeps any existing bookmarks/links working.
export default function Page(){
  redirect("/create/ads");
}
