import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { render } from "./dist-ssr/entry-server.js";

// Bakes each page's markup into its built HTML so the site — the legal pages
// above all — renders fully without JavaScript. The client bundle then
// hydrates the same tree.
const FILES = {
  de: { index: "index.html", impressum: "impressum.html", datenschutz: "datenschutz.html" },
  en: { index: "en/index.html", impressum: "en/legal-notice.html", datenschutz: "en/privacy.html" },
};

const dist = resolve(import.meta.dirname, "dist");

for (const [locale, pages] of Object.entries(FILES)) {
  for (const [page, relative] of Object.entries(pages)) {
    const file = resolve(dist, relative);
    const html = await readFile(file, "utf8");
    const marker = `<div id="root" data-page="${page}" data-locale="${locale}"></div>`;

    if (!html.includes(marker)) {
      throw new Error(`prerender: root marker for ${locale}/${page} not found in ${file}`);
    }

    const markup = render(locale, page);
    await writeFile(
      file,
      html.replace(
        marker,
        `<div id="root" data-page="${page}" data-locale="${locale}">${markup}</div>`,
      ),
    );
    console.log(`prerendered ${relative} (${markup.length.toLocaleString("en-US")} chars)`);
  }
}
