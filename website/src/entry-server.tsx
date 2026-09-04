import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import type { PageId } from "./site";
import { PAGES } from "./pages/registry";

/** Called by prerender.mjs after the client build to bake each page into its HTML. */
export function render(page: PageId): string {
  const Page = PAGES[page];
  return renderToString(
    <StrictMode>
      <Page />
    </StrictMode>,
  );
}
