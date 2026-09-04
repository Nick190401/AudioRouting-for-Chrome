import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import "./styles.css";
import { isLocale, isPageId } from "./i18n";
import { PageView } from "./pages/registry";

const root = document.getElementById("root");
const page = root?.dataset["page"];
const locale = root?.dataset["locale"];

if (root && isPageId(page) && isLocale(locale)) {
  hydrateRoot(
    root,
    <StrictMode>
      <PageView locale={locale} page={page} />
    </StrictMode>,
  );
}
