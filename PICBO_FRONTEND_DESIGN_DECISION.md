# Picbo frontend design decision

Date: 2026-09-12
Phase: 4 — Frontend and product excellence
Required by: `Picbo_Master_Audit_and_Claude_Code_Command.md` → *Master Frontend Design Directive*

---

## 1. On the Figma research step — read this first

The directive says: *"Before changing frontend code, use the connected Figma environment
to research and compare suitable current SaaS/AI design directions. Shortlist 3–5 strong
Figma references and score them."*

**I could not do this, and I am not going to pretend otherwise.**

What is actually true:

- The Figma MCP connection **authenticates successfully** — account `Saad Saad Ali`,
  team *"Saad Saad Ali's team"*, **seat: View**, tier: starter.
- Every Figma read tool (`get_metadata`, `get_design_context`, `get_screenshot`,
  `get_libraries`, `search_design_system`) **requires a `fileKey`**.
- There is no "list my files" capability in the toolset, and no Picbo design file, UI kit
  or shared library was provided.
- A **View** seat on a starter tier also cannot create files to work in.

So there was no set of Figma references to shortlist or score. Inventing a comparison
table of design directions I never opened would be exactly the kind of unverifiable claim
this whole engagement exists to eliminate.

**Status: YELLOW** — blocked only by a missing input, not by a code problem.

**To unblock it, send any one of:**
1. A Figma file URL (I extract the `fileKey` from it), or
2. A community UI-kit file key to compare against, or
3. An upgraded seat so a working file can be created.

With that, I will do the scored comparison properly and revise this document. In the
meantime, the direction below is derived from the two things I *could* read directly:
the directive's own explicit specification, and the actual state of the codebase.

---

## 2. The direction

**Premium AI creative studio + calm-density SaaS workspace + product-first visual
storytelling** — the target the directive names, implemented as specified.

### Why this is right for Picbo specifically

Picbo's product is *images*. That single fact settles most of the design argument:

1. **The interface must not compete with the work.** A user is judging whether a
   generated product shot is good enough to run as an ad. Saturated chrome around it
   changes their perception of the image itself. This is why the app is now light-first
   with restrained colour, and why violet appears on *actions*, not on every surface.

2. **Density has to stay calm.** The sidebar previously listed 23 destinations across
   four groups. That is more than anyone scans; it makes the product feel like an
   administrative tool rather than a studio.

3. **The dark theme is a real requirement, not a toggle for its own sake.** People
   colour-grade and judge imagery in dark rooms. But *dark-only* — which is what the app
   was — is the wrong default for the daytime marketing manager who is Picbo's actual
   buyer.

---

## 3. What was actually wrong

Measured against the codebase as it stood, not against taste:

| Finding | Evidence |
|---|---|
| No design system | 37 lines of minified CSS, **7** custom properties, dark-only |
| No tokens | No spacing, radius, type, shadow, motion or z-index scale of any kind |
| Ad-hoc styling | **44** component files used inline `style={{}}` with hardcoded hex |
| Wrong theme | Dark-only; the directive specifies light-first with premium dark |
| Wrong IA | 23 sidebar items vs. the 13 the directive specifies |
| Dishonest control | Search box placeholder promised "⌘ K"; it had **no handler at all** |
| Fake data in chrome | Avatar hardcoded to `"SA"` for every user |
| Missing chrome | No workspace switcher, no credit balance — both required by the directive |
| Accessibility | No skip link, no focus trap on the mobile drawer, no `aria-current`, keyboard users could tab into an off-screen sidebar |
| Contrast | Semantic colours used directly as text: `#16A34A` is **3.4:1** on white, `#F59E0B` is **2.2:1**, `#EF4444` is **3.8:1** — all below the 4.5:1 AA floor |

---

## 4. Decisions and their rationale

### 4.1 Light-first, with dark as a designed theme
`data-theme` on `<html>`, defaulting to the OS preference, applied **before first paint**
by an inline script. Doing this in `useEffect` instead produces a flash of the wrong
theme on every navigation.

Dark is not an inversion. Brand violet is lifted (`#6D5EF8` → `#8B7CFF`) because
saturated colour vibrates against dark grounds, and elevation switches from shadow to
surface value, because shadows are nearly invisible on dark.

### 4.2 Separate `-fg` variants for semantic colours
The brand's success/warning/error colours fail AA as body text on white. Rather than
quietly ship inaccessible text or abandon the specified palette, the base colours are
kept for **fills, borders and icons** (3:1 applies) and darkened `-fg` variants are used
for **text**:

| Role | Fill | Text variant | Contrast on white |
|---|---|---|---|
| Success | `#16A34A` | `#15803D` | 4.60:1 |
| Warning | `#F59E0B` | `#B45309` | 4.71:1 |
| Error | `#EF4444` | `#DC2626` | 4.83:1 |
| Accent | `#06B6D4` | `#0E7490` | 4.53:1 |

This is the one place the implementation deliberately extends the directive's palette,
and the reason is measurable.

### 4.3 Navigation cut from 23 items to 13
Exactly the directive's IA: Home, Create, Projects, Library, Campaigns, Brand, Analytics,
Explore, Team, Integrations, Developer, Billing, Settings.

The six studios move under the Create hub. **Nothing became harder to reach** — every one
is in the ⌘K palette with keyword aliases, so "photo" finds Product Photoshoot.

### 4.4 The command palette is real now
Focus trap, Escape, arrow-key navigation, `aria-activedescendant` on a combobox/listbox
so a screen reader announces the highlighted result while focus stays in the input, and
focus returns to whatever opened it. A promise the old placeholder made and did not keep.

### 4.5 Motion is purposeful and never load-bearing
Tokens at the specified durations — fast 140ms, normal 210ms, complex 340ms. Transform
and opacity only; nothing animated here triggers layout. `prefers-reduced-motion` removes
all of it, and because no animation carries information, removing it costs nothing.

The signature **creative pulse** is a single calm violet→cyan indicator on active
generation — not a spinner on every element.

### 4.6 Glass is rationed
Refined glass on the command palette and dialogs only. Not on cards. The directive is
explicit, and glass everywhere is the fastest way to make a product look dated.

### 4.7 Cards lift only if they navigate
`a.card` / `button.card` / `.card-interactive` get hover lift. A static container that
rises under the cursor is a promise the UI does not keep.

---

## 5. Accessibility commitments (WCAG 2.2 AA)

| Requirement | Implementation |
|---|---|
| Visible focus | `:focus-visible` declared once app-wide, so no component can ship without it |
| Skip link | First focusable element, jumps to `#main-content` |
| Target size (2.5.8) | 40px minimum on every control — over the 24px floor, sized for thumbs |
| Text contrast (1.4.3) | Body ≥ 4.5:1; `-fg` variants above; muted text at 4.76:1 is used only for labels and metadata |
| Zoom (1.4.4) | `maximumScale: 5` — zoom is never locked |
| Keyboard traps (2.1.2) | Drawer and palette trap focus **only while modal**, and both return focus on close |
| Hidden content | Off-screen sidebar is `inert` below 1000px, so nobody tabs into an invisible menu |
| iOS zoom-on-focus | Inputs at 16px; anything smaller makes Safari zoom the viewport |
| Reduced motion (2.3.3) | Honoured globally |
| Landmarks | `<aside>`, `<header>`, `<main>`, labelled `<nav>` per group |

---

## 6. Honest scorecard

| Area | Before | After | Target |
|---|---:|---:|---:|
| Design tokens | 0/10 | 9/10 | 10 |
| Theme support | 2/10 | 9/10 | 10 |
| Navigation IA | 4/10 | 9/10 | 10 |
| Card system | 3/10 | 8/10 | 10 |
| Motion | 2/10 | 8/10 | 10 |
| Accessibility | 5/10 | 8/10 | 10 |
| Responsive | 4/10 | 8/10 | 10 |
| **Figma-sourced direction** | — | **blocked** | 10 |

Not yet 10/10, and the remaining gap is named rather than glossed:

- **The Figma comparison has not happened** (§1).
- **No visual regression testing.** There is no screenshot baseline, so "looks right" is
  still a human judgement.
- **Per-page polish is partial.** The token system re-themes all 35 routes at once, which
  is the high-leverage 80%. Individual page composition — empty states, table layouts,
  chart styling on Analytics — is still uneven and is honest Phase 5 work.
- **Contrast is calculated, not machine-verified.** The ratios above are computed from
  the palette; an automated axe/Lighthouse pass against the running app has not been run.
