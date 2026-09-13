# Legacy static prototype — DO NOT DEPLOY

These 19 HTML files are the **original design prototype**. They are kept only as a
visual reference for the Phase 4 design work. They are **not** an application and
must never be served on a Picbo domain.

## Why this directory is quarantined

Until Phase 1 these files sat at the repository root, one static-host misconfiguration
away from being live. They contained working-looking flows that authenticated and
charged nobody:

| File | What it did | Status |
|---|---|---|
| `login.html` | The sign-in form ran `window.location.href='dashboard.html'` on submit. **Any email and any password granted access.** | Neutralised — now links to `/auth/sign-in` |
| `login.html` | "Google" and "Apple" buttons were plain `window.location.href='dashboard.html'`. No OAuth of any kind. | Neutralised — now links to `/auth/sign-in` |
| `billing.html` | The "Upgrade" button fired `picboToast('Switched to Business')`. **Fake payment success.** No money moved, no entitlement changed. | Neutralised — now links to `/billing` |
| all pages | Linked into `dashboard.html`, a mock workspace populated with invented metrics. | Repointed to `/dashboard` |

Every file now opens with a `<!-- QUARANTINED MOCK -->` banner.

## The real application

`next-app/` is the **single source of truth** for Picbo. Everything a user can
actually do lives there:

- Real Supabase authentication, including **real Google OAuth** (`app/auth/oauth-actions.ts`
  → `supabase.auth.signInWithOAuth` → `app/auth/callback/route.ts`)
- Real Paddle billing behind a signature-verified webhook
- Real credit ledger, RLS-enforced per workspace

## If you are looking for the design

Take colours, spacing and layout ideas from here, then implement them in
`next-app/` against the design tokens. Do not copy the markup: it is hand-written
static HTML with no accessibility review, no responsive testing beyond the desktop
breakpoint, and no connection to real data.

## Deployment guard

`next-app/scripts/production-audit.mjs` fails the build if any of these files
reappear outside this directory, or if the quarantine banner is removed. Do not
work around that check — remove the file instead.
