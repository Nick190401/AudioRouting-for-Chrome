import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import type { Locale, PageId } from "./i18n";
import { PageView } from "./pages/registry";

/** Called by prerender.mjs after the client build to bake each page into its HTML. */
export function render(locale: Locale, page: PageId): string {
  return renderToString(
    <StrictMode>
      <PageView locale={locale} page={page} />
    </StrictMode>,
  );
}
