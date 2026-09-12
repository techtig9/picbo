import {
  Home,Sparkles,FolderOpen,Images,Megaphone,Palette,BarChart3,Compass,
  Users,Store,Code2,CreditCard,Settings,Camera,Image as ImageIcon,Brush,
  Video,Film,UserSquare,Wand2,Package,LayoutTemplate,CircleHelp,
  type LucideIcon
} from "lucide-react";

/**
 * Navigation information architecture.
 *
 * The sidebar previously listed 23 destinations in four undifferentiated
 * groups, which is more choices than anyone scans. The design directive
 * specifies a 13-item primary IA:
 *
 *   Home · Create · Projects · Library · Campaigns · Brand · Analytics ·
 *   Explore · Team · Integrations · Developer · Billing · Settings
 *
 * The individual studios are not top-level items any more — they live under
 * the Create hub, which is what the directive describes and what keeps the
 * sidebar scannable. They remain reachable directly from the command palette,
 * so nothing that used to be one click away is now hard to find.
 */

export interface NavItem{
  label:string;
  href:string;
  icon:LucideIcon;
}

export interface NavGroup{
  /** Undefined for the first group, which needs no heading. */
  heading?:string;
  items:NavItem[];
}

export const PRIMARY_NAV:NavGroup[]=[
  {
    items:[
      {label:"Home",href:"/dashboard",icon:Home},
      {label:"Create",href:"/create",icon:Sparkles},
      {label:"Projects",href:"/projects",icon:FolderOpen},
      {label:"Library",href:"/assets",icon:Images}
    ]
  },
  {
    heading:"Grow",
    items:[
      {label:"Campaigns",href:"/campaigns",icon:Megaphone},
      {label:"Brand",href:"/brand-kits",icon:Palette},
      {label:"Analytics",href:"/analytics",icon:BarChart3},
      {label:"Explore",href:"/inspiration",icon:Compass}
    ]
  },
  {
    heading:"Workspace",
    items:[
      {label:"Team",href:"/team",icon:Users},
      {label:"Integrations",href:"/integrations",icon:Store},
      {label:"Developer",href:"/developer",icon:Code2},
      {label:"Billing",href:"/billing",icon:CreditCard},
      {label:"Settings",href:"/settings",icon:Settings}
    ]
  }
];

export interface Destination{
  label:string;
  href:string;
  icon:LucideIcon;
  group:string;
  /** Lowercase search terms, so "photo" finds Product Photoshoot. */
  keywords:string[];
}

/**
 * Everything the command palette can jump to — including the studios that are
 * no longer top-level sidebar items, so removing them from the sidebar does
 * not make them harder to reach.
 */
export const NAV_DESTINATIONS:Destination[]=[
  {label:"Home",href:"/dashboard",icon:Home,group:"Workspace",keywords:["dashboard","overview","start"]},
  {label:"Create",href:"/create",icon:Sparkles,group:"Create",keywords:["new","generate","make"]},

  {label:"Image Studio",href:"/create/image",icon:ImageIcon,group:"Create",keywords:["image","generate","edit","inpaint","upscale","background"]},
  {label:"Product Photoshoot",href:"/create/photoshoot",icon:Camera,group:"Create",keywords:["photo","photoshoot","product","studio","shot"]},
  {label:"Ad Studio",href:"/create/ads",icon:Brush,group:"Create",keywords:["ad","ads","creative","meta","tiktok"]},
  {label:"Video Studio",href:"/create/video",icon:Video,group:"Create",keywords:["video","render","clip"]},
  {label:"Shorts & Reels",href:"/create/shorts",icon:Film,group:"Create",keywords:["shorts","reels","tiktok","vertical"]},
  {label:"UGC & Avatars",href:"/create/ugc",icon:UserSquare,group:"Create",keywords:["ugc","avatar","creator","testimonial"]},

  {label:"Projects",href:"/projects",icon:FolderOpen,group:"Work",keywords:["project","work","drafts"]},
  {label:"Library",href:"/assets",icon:Images,group:"Work",keywords:["assets","library","files","media","images","uploads"]},
  {label:"Products",href:"/products",icon:Package,group:"Work",keywords:["product","catalog","sku","identity"]},
  {label:"Templates",href:"/templates",icon:LayoutTemplate,group:"Work",keywords:["template","preset","recipe"]},

  {label:"Campaigns",href:"/campaigns",icon:Megaphone,group:"Grow",keywords:["campaign","launch","marketing"]},
  {label:"Brand",href:"/brand-kits",icon:Palette,group:"Grow",keywords:["brand","kit","colours","colors","fonts","voice"]},
  {label:"Analytics",href:"/analytics",icon:BarChart3,group:"Grow",keywords:["analytics","stats","performance","metrics"]},
  {label:"Explore",href:"/inspiration",icon:Compass,group:"Grow",keywords:["explore","inspiration","ideas","gallery"]},

  {label:"Lumi Assistant",href:"/lumi",icon:Wand2,group:"Workspace",keywords:["lumi","assistant","ai","help","chat"]},
  {label:"Team",href:"/team",icon:Users,group:"Workspace",keywords:["team","members","invite","roles","agency"]},
  {label:"Integrations",href:"/integrations",icon:Store,group:"Workspace",keywords:["integration","shopify","meta","connect"]},
  {label:"Developer",href:"/developer",icon:Code2,group:"Workspace",keywords:["developer","api","keys","webhooks"]},
  {label:"Billing",href:"/billing",icon:CreditCard,group:"Workspace",keywords:["billing","plan","credits","subscription","invoice","upgrade"]},
  {label:"Settings",href:"/settings",icon:Settings,group:"Workspace",keywords:["settings","account","profile","password"]},
  {label:"Help",href:"/help",icon:CircleHelp,group:"Workspace",keywords:["help","support","docs","faq"]}
];

/**
 * Whether a nav item should be marked as the current page.
 *
 * Exact match for "/dashboard"; prefix match for sections so that
 * /projects/abc still highlights Projects. Prefix matching must compare on a
 * path boundary — a plain startsWith would light up "/create" for
 * "/createanything".
 */
export function isActiveNav(pathname:string,href:string):boolean{
  if(href==="/dashboard")return pathname==="/dashboard";
  return pathname===href||pathname.startsWith(href+"/");
}
