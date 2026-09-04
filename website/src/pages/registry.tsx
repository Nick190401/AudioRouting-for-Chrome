import type { ReactElement } from "react";
import type { Locale, PageId } from "../i18n";
import type { Content } from "../content/de";
import { de } from "../content/de";
import { en } from "../content/en";
import { Home } from "./Home";
import { Impressum } from "./Impressum";
import { Datenschutz } from "./Datenschutz";

export const CONTENT: Record<Locale, Content> = { de, en };

const PAGES: Record<PageId, (props: { locale: Locale; c: Content }) => ReactElement> = {
  index: Home,
  impressum: Impressum,
  datenschutz: Datenschutz,
};

export function PageView({ locale, page }: { readonly locale: Locale; readonly page: PageId }) {
  const Page = PAGES[page];
  return <Page locale={locale} c={CONTENT[locale]} />;
}
