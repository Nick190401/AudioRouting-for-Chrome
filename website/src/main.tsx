import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import "./styles.css";
import { PAGES, isPageId } from "./pages/registry";

const root = document.getElementById("root");
const page = root?.dataset["page"];

if (root && isPageId(page)) {
  const Page = PAGES[page];
  hydrateRoot(
    root,
    <StrictMode>
      <Page />
    </StrictMode>,
  );
}
