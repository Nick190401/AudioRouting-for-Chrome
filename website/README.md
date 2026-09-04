# AudioRoute website

Marketing site for the AudioRoute Chrome extension: React 19 + TypeScript + Tailwind CSS 4,
built with Vite 8. Three pages, no runtime dependencies beyond React, no external requests.

```
website/
├── index.html            Shell for the landing page
├── impressum.html        Shell for the legal notice
├── datenschutz.html      Shell for the privacy policy
├── vite.config.ts        MPA inputs + build-time CSP injection
├── prerender.mjs         Bakes SSR markup into the built HTML
└── src/
    ├── main.tsx          Client entry — hydrates the page named by data-page
    ├── entry-server.tsx  SSR entry used by prerender.mjs
    ├── site.ts           Store URL, company data, navigation
    ├── styles.css        Tailwind theme tokens, @font-face, base layer
    ├── components/       Layout, Button, Icon, BrandMark, PopupPreview
    ├── pages/            Home, Impressum, Datenschutz + registry
    └── assets/fonts/     Self-hosted woff2 + OFL licences
```

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run typecheck  # tsc -b over app + node configs
npm run build      # typecheck → client build → SSR build → prerender
npm run preview    # serve dist/
```

Deploy the contents of `dist/` as the document root.

## Why a multi-page build instead of a router

Each route is a real HTML document, so `/impressum.html` and `/datenschutz.html` resolve on
any static host without SPA rewrite rules — and `prerender.mjs` bakes the rendered markup
into each file before it ships. The legal pages are therefore fully readable with
JavaScript disabled or blocked, which for an Impressum is a requirement rather than a nicety.
The client bundle hydrates the same tree afterwards.

Adding a page means: a new `<page>.html` shell with `data-page="<page>"`, a component in
`src/pages/`, an entry in `src/pages/registry.ts` and in `vite.config.ts`'s `input`, plus the
page id in `prerender.mjs`.

## Content Security Policy

`vite.config.ts` injects `default-src 'none'; script-src 'self'; style-src 'self'; img-src
'self'; font-src 'self'; base-uri 'none'; form-action 'none'` into every built page. It is
injected at build time only — the dev server needs inline scripts and a websocket for HMR.

Two consequences worth knowing before editing components:

- **No inline `style` props.** `style-src 'self'` blocks them. Bar heights and opacities are
  class names for this reason (see `BrandMark.tsx` and `WAVE` in `Home.tsx`).
- **No inline scripts.** `build.modulePreload.polyfill` is off because Vite injects that
  polyfill inline.

`frame-ancestors` and HSTS cannot be set from a meta tag. Configure them on the host:

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

## Fonts

Space Grotesk and IBM Plex Sans/Mono ship from `src/assets/fonts/`, latin subset, variable
woff2 (83 KB total), fingerprinted by Vite. Both are SIL Open Font License 1.1; the licence
texts sit next to the files.

Self-hosting is a requirement, not a preference: `Datenschutz.tsx` § 8 states that no
connection to Google Fonts is made. Do not move these to a CDN without rewriting that section.

## Before going live

1. **Fill the two placeholders** in `src/pages/Datenschutz.tsx` § 8 — hosting provider with
   full company name and address, and the server-log retention period. Both render orange
   via the `Placeholder` component.
2. **Delete the orange to-do box** at the end of `Datenschutz.tsx` once step 1 is done.
3. **Drop `<meta name="robots" content="noindex">`** from `impressum.html` and
   `datenschutz.html` only if you want the legal pages indexed. They are excluded by default
   so the landing page ranks instead.

## Relationship to the extension

The site is not part of the extension package: `scripts/build-release.ps1` and
`scripts/validate.mjs` both use explicit file allowlists, so `website/` never enters the
Chrome Web Store ZIP.

The design tokens in `src/styles.css` (`@theme`) and the popup reproduction in
`PopupPreview.tsx` are lifted from `popup/popup.css`. Change them together.
