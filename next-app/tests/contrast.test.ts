import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Contrast is computed from the real token file, not from a copy of the
 * values. If someone edits tokens.css and drops a colour below the WCAG 2.2
 * threshold, this fails.
 *
 * The audit found semantic colours being used directly as body text:
 * #16A34A measures 3.4:1 on white, #F59E0B 2.2:1, #EF4444 3.8:1 — all below
 * the 4.5:1 AA floor. The `-fg` variants exist to fix exactly that, so they
 * are the ones pinned here.
 */

const tokensCss=fs.readFileSync(path.join(process.cwd(),"app/tokens.css"),"utf8");

/** Reads a custom property from the :root block (the light theme). */
function token(name:string):string{
  const lightBlock=tokensCss.slice(0,tokensCss.indexOf("@media (prefers-color-scheme: dark)"));
  const match=lightBlock.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match,`token --${name} not found in tokens.css`);
  return match![1].trim();
}

function srgbToLinear(channel:number):number{
  const c=channel/255;
  return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
}

/** WCAG 2.x relative luminance. */
export function luminance(hex:string):number{
  const clean=hex.replace("#","").trim();
  assert.match(clean,/^[0-9a-fA-F]{6}$/,`"${hex}" is not a 6-digit hex colour`);
  const r=parseInt(clean.slice(0,2),16);
  const g=parseInt(clean.slice(2,4),16);
  const b=parseInt(clean.slice(4,6),16);
  return 0.2126*srgbToLinear(r)+0.7152*srgbToLinear(g)+0.0722*srgbToLinear(b);
}

export function contrastRatio(a:string,b:string):number{
  const la=luminance(a),lb=luminance(b);
  const light=Math.max(la,lb),dark=Math.min(la,lb);
  return (light+0.05)/(dark+0.05);
}

function assertContrast(fg:string,bg:string,min:number,label:string){
  const ratio=contrastRatio(fg,bg);
  assert.ok(
    ratio>=min,
    `${label}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, below the ${min}:1 requirement`
  );
}

// Sanity-check the maths itself before trusting it on real values.
test("the contrast formula is correct",()=>{
  assert.equal(Math.round(contrastRatio("#000000","#FFFFFF")),21);
  assert.equal(Math.round(contrastRatio("#FFFFFF","#FFFFFF")),1);
});

test("body text meets AA on both surface and canvas",()=>{
  assertContrast(token("text"),token("surface"),4.5,"--text on --surface");
  assertContrast(token("text"),token("canvas"),4.5,"--text on --canvas");
});

test("secondary text meets AA for body copy",()=>{
  assertContrast(token("text-secondary"),token("surface"),4.5,"--text-secondary on --surface");
});

test("muted text still clears the AA floor",()=>{
  // 4.76:1 — used for labels and metadata only, but it must still pass,
  // because "small grey text" is where contrast failures always hide.
  assertContrast(token("text-muted"),token("surface"),4.5,"--text-muted on --surface");
  assertContrast(token("text-muted"),token("canvas"),4.5,"--text-muted on --canvas");
});

test("semantic text variants meet AA — the bug this file exists for",()=>{
  assertContrast(token("success-fg"),token("surface"),4.5,"--success-fg");
  assertContrast(token("warning-fg"),token("surface"),4.5,"--warning-fg");
  assertContrast(token("danger-fg"),token("surface"),4.5,"--danger-fg");
  assertContrast(token("accent-fg"),token("surface"),4.5,"--accent-fg");
});

test("the raw semantic colours would NOT pass as text",()=>{
  // Documents why the -fg variants exist. If someone "simplifies" by pointing
  // -fg at the base colour, the test above starts failing and this one
  // explains why.
  assert.ok(contrastRatio("#16A34A","#FFFFFF")<4.5,"success base should fail as text");
  assert.ok(contrastRatio("#F59E0B","#FFFFFF")<4.5,"warning base should fail as text");
  assert.ok(contrastRatio("#EF4444","#FFFFFF")<4.5,"danger base should fail as text");
});

test("primary button text meets AA against the brand fill",()=>{
  assertContrast("#FFFFFF",token("brand-500"),4.5,"white on --brand-500");
});

test("the focus ring is distinguishable from its surroundings",()=>{
  // 3:1 is the non-text contrast requirement (WCAG 1.4.11) — a focus ring
  // nobody can see is the same as no focus ring.
  const ring=token("focus-ring")==="var(--brand-500)"?token("brand-500"):token("focus-ring");
  assert.ok(
    contrastRatio(ring,token("surface"))>=3,
    `focus ring ${ring} must reach 3:1 against --surface`
  );
});

test("borders are visible enough to read as structure",()=>{
  // Not a hard WCAG failure for decorative borders, but a border below ~1.3:1
  // is invisible and the card system stops reading as cards.
  assert.ok(contrastRatio(token("border-strong"),token("surface"))>=1.3);
});

test("dark theme text also meets AA",()=>{
  const darkBlock=tokensCss.slice(tokensCss.indexOf(':root[data-theme="dark"]'));
  const darkToken=(name:string)=>{
    const m=darkBlock.match(new RegExp(`--${name}:\\s*([^;]+);`));
    assert.ok(m,`dark token --${name} not found`);
    return m![1].trim();
  };
  assertContrast(darkToken("text"),darkToken("surface"),4.5,"dark --text");
  assertContrast(darkToken("text-secondary"),darkToken("surface"),4.5,"dark --text-secondary");
  assertContrast(darkToken("text-muted"),darkToken("surface"),4.5,"dark --text-muted");
});
