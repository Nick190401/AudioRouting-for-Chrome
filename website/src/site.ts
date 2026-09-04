export const STORE_URL =
  "https://chromewebstore.google.com/detail/audioroute-%E2%80%93-tab-audio-ou/hmiaeghocchhbighaoapdepaeicddkmf";

export const EXTENSION = {
  name: "AudioRoute",
  storeName: "AudioRoute – Tab Audio Output",
  eyebrow: "Chrome Audio Router",
  version: "1.1.3",
  minChrome: 116,
} as const;

export const COMPANY = {
  legalName: "KernelMinds GbR",
  street: "Berliner Str. 26",
  city: "64579 Gernsheim",
  country: "Deutschland",
  partners: ["Nick Kleinjohann", "Felix Schulz"],
  vatId: "DE454127933",
  phone: "+49 152 22532619",
  phoneHref: "tel:+4915222532619",
  email: "kontakt@kernelminds.de",
  emailHref: "mailto:kontakt@kernelminds.de",
  copyright: "© 2026 KernelMinds GbR",
} as const;

export type PageId = "index" | "impressum" | "datenschutz";

export type NavLink = { readonly label: string; readonly href: string };

/** Landing-page anchors need the file prefix when linked from a legal page. */
export function mainNav(page: PageId): readonly NavLink[] {
  const home = page === "index" ? "" : "index.html";
  return [
    { label: "Funktionen", href: `${home}#funktionen` },
    { label: "So funktioniert es", href: `${home}#ablauf` },
    { label: "Berechtigungen", href: `${home}#berechtigungen` },
    { label: "Datenschutz", href: "datenschutz.html" },
  ];
}

export function footerNav(page: PageId): readonly NavLink[] {
  const home = page === "index" ? "" : "index.html";
  return [
    { label: "Funktionen", href: `${home}#funktionen` },
    { label: "So funktioniert es", href: `${home}#ablauf` },
    { label: "Datenschutz", href: "datenschutz.html" },
    { label: "Impressum", href: "impressum.html" },
    { label: "Kontakt", href: COMPANY.emailHref },
  ];
}
