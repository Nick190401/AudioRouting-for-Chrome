import type { FunctionComponent } from "react";
import type { PageId } from "../site";
import { Home } from "./Home";
import { Impressum } from "./Impressum";
import { Datenschutz } from "./Datenschutz";

export const PAGES = {
  index: Home,
  impressum: Impressum,
  datenschutz: Datenschutz,
} as const satisfies Record<PageId, FunctionComponent>;

export const PAGE_IDS = Object.keys(PAGES) as PageId[];

export function isPageId(value: string | undefined): value is PageId {
  return value !== undefined && value in PAGES;
}
