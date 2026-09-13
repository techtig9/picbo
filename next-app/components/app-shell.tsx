"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Menu,X,Plus,ChevronsUpDown,Coins} from "lucide-react";
import {NotificationBell} from "./NotificationBell";
import {ThemeToggle} from "./ThemeToggle";
import {CommandPalette} from "./CommandPalette";
import {signOut} from "@/app/auth/actions";
import {PRIMARY_NAV,isActiveNav} from "@/lib/ui/navigation";

export interface ShellContext{
  workspaceName?:string|null;
  credits?:number|null;
  userInitials?:string;
}

/**
 * Application shell.
 *
 * Rebuilt in Phase 4:
 *  - 13-item navigation IA instead of 23 flat links
 *  - a real workspace switcher and live credit balance, which the design
 *    directive requires in the top bar and which simply were not there
 *  - a working ⌘K palette in place of a search box that had no handler
 *  - the avatar showed a hardcoded "SA" for every user; it now shows the
 *    signed-in person's initials
 *  - the mobile drawer had no focus trap, no Escape, and no aria-current, so
 *    a keyboard user could tab into a sidebar that was translated off-screen
 */
export function AppShell({children,context}:{children:React.ReactNode;context?:ShellContext}){
  const pathname=usePathname();
  const [navOpen,setNavOpen]=useState(false);
  const [fetched,setFetched]=useState<ShellContext|null>(null);

  // Server-rendered pages hand the context in directly. Client pages (the
  // studios) cannot call a server function, so they fetch it once — rather
  // than every authenticated route being restructured into a layout group.
  useEffect(()=>{
    if(context)return;
    let cancelled=false;
    fetch("/api/me/shell")
      .then(r=>r.ok?r.json():null)
      .then(data=>{if(!cancelled&&data)setFetched(data)})
      .catch(()=>{/* chrome detail only — never block the page on it */});
    return ()=>{cancelled=true};
  },[context]);

  const shell=context||fetched||{};
  const sidebarRef=useRef<HTMLElement|null>(null);
  const toggleRef=useRef<HTMLButtonElement|null>(null);

  // Mirrors the 1000px breakpoint in globals.css, where .side becomes an
  // off-canvas drawer. Kept in JS as well because "is this hidden right now"
  // is not something CSS can tell the accessibility tree.
  const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{
    const mq=window.matchMedia("(max-width: 1000px)");
    const sync=()=>setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change",sync);
    return ()=>mq.removeEventListener("change",sync);
  },[]);

  // Close the drawer on navigation — otherwise it stays open over the page
  // the user just chose.
  useEffect(()=>{setNavOpen(false)},[pathname]);

  // Escape closes the drawer and returns focus to the control that opened it.
  useEffect(()=>{
    if(!navOpen)return;
    function onKey(e:KeyboardEvent){
      if(e.key==="Escape"){setNavOpen(false);toggleRef.current?.focus()}
    }
    document.addEventListener("keydown",onKey);
    return ()=>document.removeEventListener("keydown",onKey);
  },[navOpen]);

  // Focus trap while the drawer is a modal overlay.
  useEffect(()=>{
    if(!navOpen)return;
    function onKeyDown(e:KeyboardEvent){
      if(e.key!=="Tab")return;
      const focusable=sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if(!focusable||focusable.length===0)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
    document.addEventListener("keydown",onKeyDown);
    return ()=>document.removeEventListener("keydown",onKeyDown);
  },[navOpen]);

  useEffect(()=>{
    if(!navOpen)return;
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=prev};
  },[navOpen]);

  const workspaceName=shell.workspaceName||"Workspace";
  const initials=shell.userInitials||"·";

  return <div className="shell">
    <a href="#main-content" className="skip-link">Skip to main content</a>

    {navOpen&&<div className="backdrop" onClick={()=>setNavOpen(false)} aria-hidden="true"/>}

    <aside
      ref={sidebarRef}
      id="main-navigation"
      className={`side${navOpen?" open":""}`}
      /* Truly inert while translated off-screen: without this a keyboard user
         tabs into a sidebar they cannot see, and a screen reader reads links
         that are visually absent. Only applies below the desktop breakpoint,
         where the drawer is actually hidden. */
      inert={isMobile&&!navOpen?true:undefined}
    >
      <Link className="brand" href="/dashboard">
        <span className="logo" aria-hidden="true">P</span>
        Picbo
      </Link>

      <Link href="/settings" className="workspace-switcher">
        <span className="workspace-avatar" aria-hidden="true">{workspaceName.slice(0,1).toUpperCase()}</span>
        <span className="workspace-name">{workspaceName}</span>
        <ChevronsUpDown size={14} aria-hidden="true"/>
      </Link>

      {PRIMARY_NAV.map((group,i)=>
        <div key={group.heading||`group-${i}`}>
          {group.heading&&<div className="label" id={`nav-group-${i}`}>{group.heading}</div>}
          <nav className="nav" aria-labelledby={group.heading?`nav-group-${i}`:undefined} aria-label={group.heading?undefined:"Main"}>
            {group.items.map(({label,href,icon:Icon})=>{
              const active=isActiveNav(pathname,href);
              return <Link key={href} href={href} aria-current={active?"page":undefined}>
                <Icon size={16} aria-hidden="true"/>{label}
              </Link>;
            })}
          </nav>
        </div>
      )}

      <div className="bottom">
        <form action={signOut}>
          <button className="btn" style={{width:"100%"}}>Sign out</button>
        </form>
      </div>
    </aside>

    <div className="main">
      <header className="top">
        <button
          ref={toggleRef}
          className="icon mobile"
          aria-label={navOpen?"Close navigation":"Open navigation"}
          aria-expanded={navOpen}
          aria-controls="main-navigation"
          onClick={()=>setNavOpen(o=>!o)}
        >
          {navOpen?<X size={18} aria-hidden="true"/>:<Menu size={18} aria-hidden="true"/>}
        </button>

        <CommandPalette/>

        <div className="actions">
          {typeof shell.credits==="number"&&
            <Link href="/billing" className="credits-pill" title="Credit balance">
              <Coins size={14} aria-hidden="true"/>
              <span>{shell.credits.toLocaleString()}</span>
              <span className="visually-hidden">credits remaining</span>
            </Link>
          }
          <Link className="btn primary" href="/create">
            <Plus size={16} aria-hidden="true"/>
            <span className="create-label">Create</span>
          </Link>
          <ThemeToggle/>
          <NotificationBell/>
          <Link href="/settings" className="avatar" aria-label="Account settings">{initials}</Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
