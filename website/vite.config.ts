import { resolve } from "node:path";
import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/** Mirrors FILES in src/i18n.ts — kept here so the config has no app imports. */
const PAGES = [
  { page: "index", de: "/index.html", en: "/en/index.html" },
  { page: "impressum", de: "/impressum.html", en: "/en/legal-notice.html" },
  { page: "datenschutz", de: "/datenschutz.html", en: "/en/privacy.html" },
] as const;

/**
 * Injects the CSP plus canonical and hreflang links at build time.
 *
 * The link tags cannot live in the HTML shells: Vite resolves `<link href>` as
 * an asset, which turns each hreflang target into a hashed copy under assets/.
 * The CSP is build-only because the dev server needs inline scripts and a
 * websocket for HMR. `frame-ancestors` is header-only — see README.md.
 */
function htmlHead(): Plugin {
  return {
    name: "audioroute-html-head",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html, ctx) => {
        const path = ctx.path.startsWith("/") ? ctx.path : `/${ctx.path}`;
        const entry = PAGES.find((candidate) => candidate.de === path || candidate.en === path);

        const tags: HtmlTagDescriptor[] = [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
            injectTo: "head-prepend",
          },
        ];

        if (entry) {
          tags.push(
            { tag: "link", attrs: { rel: "canonical", href: path }, injectTo: "head" },
            { tag: "link", attrs: { rel: "alternate", hreflang: "de", href: entry.de }, injectTo: "head" },
            { tag: "link", attrs: { rel: "alternate", hreflang: "en", href: entry.en }, injectTo: "head" },
            {
              tag: "link",
              attrs: { rel: "alternate", hreflang: "x-default", href: entry.de },
              injectTo: "head",
            },
          );
        }

        return { html, tags };
      },
    },
  };
}

// Multi-page build: one real HTML document per route and locale, so every URL
// resolves on any static host without SPA rewrite rules.
export default defineConfig({
  plugins: [react(), tailwindcss(), htmlHead()],
  build: {
    // The polyfill is injected as an inline <script>, which the CSP above
    // rejects. Every browser we target supports modulepreload natively.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        "de-index": resolve(import.meta.dirname, "index.html"),
        "de-impressum": resolve(import.meta.dirname, "impressum.html"),
        "de-datenschutz": resolve(import.meta.dirname, "datenschutz.html"),
        "en-index": resolve(import.meta.dirname, "en/index.html"),
        "en-legal-notice": resolve(import.meta.dirname, "en/legal-notice.html"),
        "en-privacy": resolve(import.meta.dirname, "en/privacy.html"),
      },
    },
  },
});
