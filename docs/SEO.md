# Picbo.ai — SEO Setup

## Already in the frontend
- `index.html` ships a descriptive `<title>`, meta description, Open Graph
  tags, and a `SoftwareApplication` JSON-LD block.
- Semantic HTML: one `<h1>` in the hero, `<h2>` per section, landmark tags.
- `legal.html` and `404.html` are marked `noindex` — they shouldn't compete
  with real marketing pages in search results.
- Mobile responsive layout throughout.

## Still needed before launch

1. **robots.txt**:
   ```
   User-agent: *
   Allow: /
   Disallow: /dashboard.html
   Disallow: /admin.html
   Disallow: /billing.html
   Disallow: /referrals.html
   Disallow: /team.html
   Sitemap: https://picbo.ai/sitemap.xml
   ```
   Dashboard, admin, billing, referrals, and team are logged-in surfaces.

2. **sitemap.xml** — public marketing pages only: `/`, `/help.html`,
   `/login.html`, `/register.html`, `/legal.html`.

3. **Canonical tags** on every public page.

4. **Per-page metadata** for `login.html`/`register.html` — set
   `<meta name="robots" content="noindex, nofollow">` on both, since
   they're not useful search landing pages (mirrors what `legal.html` and
   `404.html` already do).

5. **Performance**
   - Replace every `picsum.photos` placeholder (hero thumbnails, category
     cards, testimonial/team avatars, the founder photo) with real,
     optimized assets (WebP/AVIF) served from a CDN — the single biggest
     Core Web Vitals lever here.
   - Self-host or preload the Google Fonts used (`Fraunces`, `Plus Jakarta
     Sans`, `IBM Plex Mono`).
   - Lazy-load below-the-fold images (`loading="lazy"` on gallery/category
     grids).

6. **Structured data extensions**
   - `Product`/`Offer` schema per plan (Free/Starter/Pro/Business/Agency)
     so pricing can surface directly in search results.
   - `FAQPage` schema mirroring the FAQ sections already on `index.html`
     and `help.html`.

7. **Open Graph image** — a real 1200×630 asset once brand imagery exists.

8. **Analytics & Search Console** — verify the domain, submit the
   sitemap, and wire up privacy-respecting analytics behind the cookie
   consent banner described in `legal.html`.

9. **Content depth** — once real generation is live, a `/gallery` or
   `/examples` page with genuine (not placeholder) outputs and prompts,
   plus lightweight "how to prompt for X" content, tends to outperform the
   landing page itself for organic search in this category.
