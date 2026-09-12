/**
 * Applies the saved theme before first paint.
 *
 * This must run synchronously in <head>, ahead of hydration. Doing it in a
 * useEffect instead produces a flash of the wrong theme on every navigation —
 * the page paints light, then snaps to dark once React runs.
 *
 * Reads localStorage inside try/catch because it throws outright in some
 * privacy modes, and a storage failure must not stop the page rendering.
 */
const script=`
(function(){
  try{
    var stored=localStorage.getItem("picbo-theme");
    if(stored==="dark"||stored==="light"){
      document.documentElement.setAttribute("data-theme",stored);
    }
  }catch(e){}
})();
`;

export function ThemeScript(){
  // Static, self-authored string with no interpolation — there is no path for
  // user input to reach it.
  return <script dangerouslySetInnerHTML={{__html:script}}/>;
}
