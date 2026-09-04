export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

export type PageId = "index" | "impressum" | "datenschutz";
export const PAGE_IDS: readonly PageId[] = ["index", "impressum", "datenschutz"];

/** German lives at the root; English gets its own prefix and its own file names. */
const FILES: Record<Locale, Record<PageId, string>> = {
  de: { index: "index.html", impressum: "impressum.html", datenschutz: "datenschutz.html" },
  en: { index: "index.html", impressum: "legal-notice.html", datenschutz: "privacy.html" },
};

const PREFIX: Record<Locale, string> = { de: "", en: "/en" };

/** Root-relative URL — the site is served from the document root (see README). */
export function href(locale: Locale, page: PageId, hash = ""): string {
  return `${PREFIX[locale]}/${FILES[locale][page]}${hash}`;
}

/** Path of the built file inside dist/, used by vite.config.ts and prerender.mjs. */
export function distPath(locale: Locale, page: PageId): string {
  return `${locale === "de" ? "" : "en/"}${FILES[locale][page]}`;
}

export function isLocale(value: string | undefined): value is Locale {
  return value === "de" || value === "en";
}

export function isPageId(value: string | undefined): value is PageId {
  return value === "index" || value === "impressum" || value === "datenschutz";
}

export const COMPANY = {
  legalName: "KernelMinds GbR",
  street: "Berliner Str. 26",
  city: "64579 Gernsheim",
  partners: ["Nick Kleinjohann", "Felix Schulz"],
  vatId: "DE454127933",
  phone: "+49 152 22532619",
  phoneHref: "tel:+4915222532619",
  email: "kontakt@kernelminds.de",
  emailHref: "mailto:kontakt@kernelminds.de",
} as const;

export const EXTENSION = {
  name: "AudioRoute",
  storeName: "AudioRoute – Tab Audio Output",
  version: "1.1.3",
  minChrome: 116,
} as const;

export const STORE_URL =
  "https://chromewebstore.google.com/detail/audioroute-%E2%80%93-tab-audio-ou/hmiaeghocchhbighaoapdepaeicddkmf";
