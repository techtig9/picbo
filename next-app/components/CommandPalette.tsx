"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {Search} from "lucide-react";
import {NAV_DESTINATIONS} from "@/lib/ui/navigation";

/**
 * ⌘K command palette.
 *
 * The top bar previously rendered an input whose placeholder read
 * "Search products, projects, assets…  (⌘ K)" and which did nothing at all —
 * it had no handler, no results and no keyboard shortcut. This makes that
 * promise real.
 *
 * Accessibility: a modal dialog with a focus trap, Escape to close, arrow-key
 * navigation, and an aria-activedescendant listbox so a screen reader
 * announces the highlighted result while focus stays in the text field.
 */
export function CommandPalette(){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [active,setActive]=useState(0);
  const inputRef=useRef<HTMLInputElement>(null);
  const dialogRef=useRef<HTMLDivElement>(null);
  const previouslyFocused=useRef<HTMLElement|null>(null);

  const results=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return NAV_DESTINATIONS.slice(0,8);
    return NAV_DESTINATIONS
      .filter(d=>
        d.label.toLowerCase().includes(q)||
        d.keywords.some(k=>k.includes(q))
      )
      .slice(0,8);
  },[query]);

  const close=useCallback(()=>{
    setOpen(false);
    setQuery("");
    setActive(0);
    // Return focus where it came from, or the user is dumped at the top of
    // the document with no idea where they are.
    previouslyFocused.current?.focus();
  },[]);

  // Global shortcut. Meta on macOS, Ctrl elsewhere.
  useEffect(()=>{
    function onKey(e:KeyboardEvent){
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){
        e.preventDefault();
        previouslyFocused.current=document.activeElement as HTMLElement;
        setOpen(o=>!o);
      }
    }
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[]);

  useEffect(()=>{
    if(open)inputRef.current?.focus();
  },[open]);

  // Focus trap: Tab must not escape an open modal dialog.
  useEffect(()=>{
    if(!open)return;
    function onKeyDown(e:KeyboardEvent){
      if(e.key!=="Tab")return;
      const focusable=dialogRef.current?.querySelectorAll<HTMLElement>(
        'input, button, [href], [tabindex]:not([tabindex="-1"])'
      );
      if(!focusable||focusable.length===0)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
    document.addEventListener("keydown",onKeyDown);
    return ()=>document.removeEventListener("keydown",onKeyDown);
  },[open]);

  // Stop the page behind the dialog from scrolling.
  useEffect(()=>{
    if(!open)return;
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=prev};
  },[open]);

  function go(href:string){
    close();
    router.push(href);
  }

  function onInputKeyDown(e:React.KeyboardEvent){
    if(e.key==="Escape"){e.preventDefault();close();return}
    if(e.key==="ArrowDown"){e.preventDefault();setActive(i=>Math.min(i+1,results.length-1));return}
    if(e.key==="ArrowUp"){e.preventDefault();setActive(i=>Math.max(i-1,0));return}
    if(e.key==="Enter"&&results[active]){e.preventDefault();go(results[active].href)}
  }

  return <>
    <button
      type="button"
      className="search search-trigger"
      onClick={()=>{previouslyFocused.current=document.activeElement as HTMLElement;setOpen(true)}}
    >
      <Search size={15} aria-hidden="true"/>
      <span>Search or jump to…</span>
      <kbd aria-hidden="true">⌘K</kbd>
    </button>

    {open&&
      <div className="palette-backdrop" onClick={close}>
        <div
          ref={dialogRef}
          className="palette"
          role="dialog"
          aria-modal="true"
          aria-label="Search and navigate"
          onClick={e=>e.stopPropagation()}
        >
          <div className="palette-input">
            <Search size={16} aria-hidden="true"/>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e=>{setQuery(e.target.value);setActive(0)}}
              onKeyDown={onInputKeyDown}
              placeholder="Search Picbo…"
              aria-label="Search Picbo"
              aria-controls="palette-results"
              aria-activedescendant={results[active]?`palette-option-${active}`:undefined}
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
            />
            <kbd aria-hidden="true">esc</kbd>
          </div>

          <ul id="palette-results" className="palette-results" role="listbox" aria-label="Results">
            {results.length===0&&
              <li className="palette-empty" role="presentation">
                Nothing matches “{query}”.
              </li>
            }
            {results.map((d,i)=>
              <li
                key={d.href}
                id={`palette-option-${i}`}
                role="option"
                aria-selected={i===active}
                className={`palette-option${i===active?" active":""}`}
                onMouseEnter={()=>setActive(i)}
                onClick={()=>go(d.href)}
              >
                <d.icon size={16} aria-hidden="true"/>
                <span>{d.label}</span>
                <span className="muted small">{d.group}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    }
  </>;
}
