import test from "node:test";
import assert from "node:assert/strict";
import {PRIMARY_NAV,NAV_DESTINATIONS,isActiveNav} from "../lib/ui/navigation";
import {initialsFor} from "../lib/ui/shell-context";

/**
 * The sidebar listed 23 destinations in four undifferentiated groups. The
 * design directive specifies 13. Cutting it only works if nothing became
 * unreachable — hence the palette-coverage assertions below.
 */

test("the sidebar matches the 13-item IA in the directive",()=>{
  const items=PRIMARY_NAV.flatMap(g=>g.items);
  assert.equal(items.length,13,`expected 13 primary destinations, found ${items.length}`);
  assert.deepEqual(
    items.map(i=>i.label),
    ["Home","Create","Projects","Library","Campaigns","Brand","Analytics",
     "Explore","Team","Integrations","Developer","Billing","Settings"]
  );
});

test("no destination appears twice in the sidebar",()=>{
  const hrefs=PRIMARY_NAV.flatMap(g=>g.items).map(i=>i.href);
  assert.equal(new Set(hrefs).size,hrefs.length,"duplicate nav href");
});

test("every studio dropped from the sidebar is still reachable via the palette",()=>{
  // Removing them from the sidebar must not make them harder to find.
  const paletteHrefs=new Set(NAV_DESTINATIONS.map(d=>d.href));
  for(const href of [
    "/create/image","/create/photoshoot","/create/ads",
    "/create/video","/create/shorts","/create/ugc",
    "/products","/templates","/lumi","/help"
  ]){
    assert.ok(paletteHrefs.has(href),`${href} is in neither the sidebar nor the palette`);
  }
});

test("every sidebar item is also in the palette",()=>{
  const paletteHrefs=new Set(NAV_DESTINATIONS.map(d=>d.href));
  for(const item of PRIMARY_NAV.flatMap(g=>g.items)){
    assert.ok(paletteHrefs.has(item.href),`${item.label} is missing from the palette`);
  }
});

test("search keywords are lowercase so matching actually works",()=>{
  // The palette lowercases the query and compares directly; an uppercase
  // keyword here would silently never match.
  for(const d of NAV_DESTINATIONS){
    for(const k of d.keywords){
      assert.equal(k,k.toLowerCase(),`"${k}" on ${d.label} must be lowercase`);
    }
  }
});

test("natural search terms find the right studio",()=>{
  const find=(q:string)=>NAV_DESTINATIONS.filter(d=>
    d.label.toLowerCase().includes(q)||d.keywords.some(k=>k.includes(q))
  ).map(d=>d.href);

  assert.ok(find("photo").includes("/create/photoshoot"));
  assert.ok(find("upscale").includes("/create/image"));
  assert.ok(find("invoice").includes("/billing"));
  assert.ok(find("tiktok").includes("/create/shorts"));
  assert.ok(find("api").includes("/developer"));
});

/** Active-state matching drives aria-current, which is how a screen reader
 *  announces "you are here". Getting it wrong is worse than omitting it. */

test("Home is only active on the dashboard itself",()=>{
  assert.equal(isActiveNav("/dashboard","/dashboard"),true);
  assert.equal(isActiveNav("/projects","/dashboard"),false);
});

test("a section stays active on its child routes",()=>{
  assert.equal(isActiveNav("/projects/abc-123","/projects"),true);
  assert.equal(isActiveNav("/create/image","/create"),true);
});

test("a prefix match does not leak across sibling routes",()=>{
  // "/create" must not light up for "/createanything" — the boundary matters.
  assert.equal(isActiveNav("/createanything","/create"),false);
  assert.equal(isActiveNav("/team-settings","/team"),false);
});

test("exactly one primary item is active for a given path",()=>{
  for(const path of ["/dashboard","/projects","/assets","/billing","/create/image"]){
    const active=PRIMARY_NAV.flatMap(g=>g.items).filter(i=>isActiveNav(path,i.href));
    assert.equal(active.length,1,`${path} highlighted ${active.length} nav items`);
  }
});

/** The avatar was hardcoded to "SA" for every user. */

test("initials come from a full name when there is one",()=>{
  assert.equal(initialsFor("Ada Lovelace","ada@example.com"),"AL");
  assert.equal(initialsFor("Grace Brewster Hopper","g@example.com"),"GH");
});

test("a single-word name uses its first two letters",()=>{
  assert.equal(initialsFor("Prince","p@example.com"),"PR");
});

test("initials fall back to the email local part",()=>{
  assert.equal(initialsFor(null,"ada@example.com"),"AD");
  assert.equal(initialsFor("   ","zoe@example.com"),"ZO");
});

test("initials never crash on missing data",()=>{
  assert.equal(initialsFor(null,null),"·");
  assert.equal(initialsFor("",""),"·");
});
