import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { render } from "./dist-ssr/entry-server.js";

// Bakes each page's markup into its built HTML so the site — the Impressum and
// the privacy policy above all — renders fully without JavaScript. The client
// bundle then hydrates the same tree.
const PAGES = ["index", "impressum", "datenschutz"];
const dist = resolve(import.meta.dirname, "dist");

for (const page of PAGES) {
  const file = resolve(dist, `${page}.html`);
  const html = await readFile(file, "utf8");
  const marker = `<div id="root" data-page="${page}"></div>`;

  if (!html.includes(marker)) {
    throw new Error(`prerender: root marker for "${page}" not found in ${file}`);
  }

  const markup = render(page);
  await writeFile(file, html.replace(marker, `<div id="root" data-page="${page}">${markup}</div>`));
  console.log(`prerendered ${page}.html (${markup.length.toLocaleString("en-US")} chars)`);
}
