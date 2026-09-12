"use client";
import {useEffect,useState} from "react";
import {Moon,Sun} from "lucide-react";

type Theme="light"|"dark";

/**
 * Light/dark toggle.
 *
 * The app was dark-only; the design directive asks for light-first with a
 * premium dark mode. The chosen theme is stored per browser and applied before
 * first paint by ThemeScript, so this component only has to keep the button
 * label in sync with what is already on the page.
 */
export function ThemeToggle(){
  const [theme,setTheme]=useState<Theme|null>(null);

  useEffect(()=>{
    // Read from the DOM, not from storage: ThemeScript has already resolved
    // "explicit choice vs OS preference", so the attribute is authoritative.
    const explicit=document.documentElement.getAttribute("data-theme") as Theme|null;
    if(explicit==="dark"||explicit==="light"){setTheme(explicit);return}
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
  },[]);

  function toggle(){
    const next:Theme=theme==="dark"?"light":"dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme",next);
    try{localStorage.setItem("picbo-theme",next)}catch{}
  }

  // Render the control immediately but without a committed icon, so its
  // position in the toolbar never shifts once the theme resolves.
  const isDark=theme==="dark";

  return <button
    type="button"
    className="icon"
    onClick={toggle}
    aria-label={theme===null?"Toggle theme":isDark?"Switch to light theme":"Switch to dark theme"}
    title={isDark?"Light theme":"Dark theme"}
  >
    {theme===null?null:isDark?<Sun size={16} aria-hidden="true"/>:<Moon size={16} aria-hidden="true"/>}
  </button>;
}
