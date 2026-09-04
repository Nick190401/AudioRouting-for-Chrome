import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
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

/**
 * Injects the page CSP at build time only — the dev server needs inline scripts
 * and a websocket for HMR, which this policy deliberately forbids.
 * `frame-ancestors` is header-only and is documented in README.md instead.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: "audioroute-csp",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html) => ({
        html,
        tags: [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
            injectTo: "head-prepend",
          },
        ],
      }),
    },
  };
}

// Multi-page build: one real HTML document per route, so /impressum.html and
// /datenschutz.html resolve on any static host without SPA rewrite rules.
export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  build: {
    // The polyfill is injected as an inline <script>, which the CSP above
    // rejects. Every browser we target supports modulepreload natively.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        impressum: resolve(import.meta.dirname, "impressum.html"),
        datenschutz: resolve(import.meta.dirname, "datenschutz.html"),
      },
    },
  },
});
