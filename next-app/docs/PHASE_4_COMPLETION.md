# Phase 4 completion — Frontend and product excellence

Date: 2026-09-12
Branch: `claude/picbo-audit-plan-uxl86j`
Scope: Phase 4 of 5, per `Picbo_Master_Audit_and_Claude_Code_Command.md` §7 and the
Master Frontend Design Directive.

---

## 1. Evidence

| Check | Result |
|---|---|
| Typecheck (strict) | **PASS** — 0 errors |
| Production build | **PASS** |
| Unit tests | **PASS 124/124** (was 100) |
| HTTP smoke tests | **PASS 52/52** (was 40) |
| Production audit | **PASS 52/52** (was 40) |
| Figma-sourced design research | **not done — YELLOW**, see §2 |

Two smoke failures occurred during this phase and both were **my own test bugs**, worth
recording because they are the kind that produce false confidence in either direction:
the CSS minifier strips attribute-selector quotes (`data-theme=dark`, not
`data-theme="dark"`), and the probe helper truncated response bodies at 20KB while the
CSS bundle is 27KB — so assertions about rules near the end of the file were reading a
file that stopped early. Both fixed in the harness, not by weakening the assertions.

---

## 2. The Figma step could not be done

The directive requires researching and scoring 3–5 Figma references before touching
frontend code. **This did not happen, and the decision document says so in its first
section rather than burying it.**

The connection authenticates (account `Saad Saad Ali`, **View** seat, starter tier), but
every read tool requires a `fileKey`, there is no file-listing capability, no Picbo design
file or UI kit was provided, and a View seat cannot create one. Fabricating a comparison
table of files I never opened would be precisely the failure mode this engagement exists
to eliminate.

**To unblock:** a Figma file URL, a community UI-kit file key, or an upgraded seat.

The direction implemented is derived from the two sources I could read directly: the
directive's own explicit specification, and the measured state of the codebase.

---

## 3. What was actually wrong

| Finding | Evidence |
|---|---|
| No design system | 37 lines of minified CSS, **7** custom properties, dark-only |
| No scales | No spacing, radius, type, shadow, motion or z-index tokens of any kind |
| Ad-hoc styling | **44** component files using inline `style={{}}` with hardcoded hex |
| Wrong theme | Dark-only; the directive specifies light-first + premium dark |
| Wrong IA | 23 sidebar items against the specified 13 |
| A control that lied | Search placeholder read "⌘ K" — **no handler, no results, no shortcut** |
| Fake data in chrome | Avatar hardcoded `"SA"` for every user |
| Missing chrome | No workspace switcher, no credit balance — both required |
| Accessibility | No skip link, no focus trap on the mobile drawer, no `aria-current`; keyboard users could tab into an off-screen sidebar |
| Contrast | `#16A34A` = **3.4:1** on white, `#F59E0B` = **2.2:1**, `#EF4444` = **3.8:1** — all below the 4.5:1 AA floor, all used as text |

---

## 4. What was built

### Token system (`app/tokens.css`)
Colour, type, space, radius, shadow, motion, z-index and layout — one source of truth.
Light-first, with dark as a **designed** theme rather than an inversion: brand violet is
lifted (`#6D5EF8` → `#8B7CFF`) because saturated colour vibrates on dark grounds, and
elevation moves from shadow to surface value because shadows are invisible there.

Applied before first paint by an inline script. Doing it in `useEffect` flashes the wrong
theme on every navigation.

### The contrast fix, and why it extends the palette
The directive's success/warning/error colours fail AA as body text. Rather than ship
inaccessible text or abandon the specified palette, base colours are kept for **fills,
borders and icons** (3:1 applies) and darkened `-fg` variants added for **text**:

| Role | Fill | Text | On white |
|---|---|---|---|
| Success | `#16A34A` | `#15803D` | 4.60:1 |
| Warning | `#F59E0B` | `#B45309` | 4.71:1 |
| Error | `#EF4444` | `#DC2626` | 4.83:1 |
| Accent | `#06B6D4` | `#0E7490` | 4.53:1 |

`tests/contrast.test.ts` parses `tokens.css` itself and computes WCAG relative luminance,
so editing a token below threshold fails the build. It also asserts the *raw* colours
fail — documenting why the variants exist, so nobody "simplifies" them away.

### Stylesheet rebuilt, every route re-themed at once
All existing class names preserved, so the token system lifts **all 35 routes**
simultaneously instead of 35 separate edits. Higher leverage, and no page left on the old
dark-only styling.

### App shell
13-item IA; workspace switcher; live credit balance; real ⌘K palette; theme toggle;
avatar from the actual signed-in user.

Server pages pass shell context directly; client pages (the studios) fetch it from
`/api/me/shell` — one small request rather than restructuring 25 routes into a layout
group.

The six studios left the sidebar but **nothing became harder to reach**: every one is in
the palette with keyword aliases, so "photo" finds Product Photoshoot and "upscale" finds
Image Studio. A test asserts that coverage.

### Motion
Tokens at the specified durations (fast 140ms / normal 210ms / complex 340ms), transform
and opacity only, `prefers-reduced-motion` honoured globally. No animation carries
information, so removing it costs nothing. The signature **creative pulse** is one calm
violet→cyan indicator on active generation, not a spinner per element.

### Accessibility
Skip link; global `:focus-visible`; 40px minimum targets; focus traps on the drawer and
palette that **restore focus on close**; `inert` on the off-screen drawer below 1000px;
`aria-current="page"`; `aria-activedescendant` combobox/listbox in the palette; 16px
inputs so iOS Safari does not zoom the viewport; `maximumScale: 5`.

---

## 5. Not done, and not claimed

- **Figma research** — §2.
- **No automated accessibility scan.** Contrast is computed from the tokens; a real
  axe/Lighthouse run against the running app has not happened. Structural a11y is
  asserted by unit and smoke tests, which is weaker than a live audit.
- **No visual regression baseline.** "Looks right" is still human judgement.
- **No real-device responsive testing.** Breakpoints are implemented at the specified
  widths (320/375/390/430/768/1024/1280/1440/1920+) and tables scroll inside their own
  container, but this was not opened on a physical phone.
- **Per-page composition is uneven.** The token system is the high-leverage 80%.
  Individual page layout — Analytics chart styling, several empty states, the video
  editor — has not had a per-page pass. Honest Phase 5 work, listed rather than quietly
  skipped.
- **Onboarding does not exist.** The master command lists it under Phase 4. There is no
  first-run flow, and building one properly needs product decisions I would rather put to
  you than invent.

---

## 6. Score movement

| Area | Before | After | Target |
|---|---:|---:|---:|
| Design tokens | 0/10 | 9/10 | 10 |
| Theme support | 2/10 | 9/10 | 10 |
| Navigation IA | 4/10 | 9/10 | 10 |
| Card system | 3/10 | 8/10 | 10 |
| Motion | 2/10 | 8/10 | 10 |
| Accessibility | 5/10 | 8/10 | 10 |
| Responsive | 4/10 | 8/10 | 10 |
| Onboarding | 1/10 | 1/10 | 10 |
| Figma direction | — | blocked | 10 |

---

## 7. Phase 4 exit criteria

- [x] Typecheck, build clean
- [x] 124/124 unit tests
- [x] 52/52 smoke tests
- [x] 52/52 production audit checks
- [x] Centralised design tokens
- [x] Light-first with premium dark mode
- [x] Navigation matches the specified IA
- [x] Card system with all required states
- [x] Shared motion tokens, reduced-motion honoured
- [x] Contrast verified by computation against the real token file
- [ ] **Figma-sourced design direction — blocked on an input (§2)**
- [ ] **Onboarding flow — needs product decisions (§5)**

**Phase 4 is complete except for the two items above, both named rather than
glossed. Ready for Phase 5 (production hardening and launch).**
