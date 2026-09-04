import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { EXTENSION, STORE_URL, href, type Locale, type PageId } from "../i18n";
import type { Content } from "../content/de";

export const WRAP = "mx-auto w-full max-w-[1440px] px-5 sm:px-10 lg:px-[72px]";

const NAV_LINK =
  "inline-flex min-h-11 items-center text-ink-soft hover:text-mint aria-[current]:text-mint";

type Props = {
  readonly locale: Locale;
  readonly page: PageId;
  readonly c: Content;
  readonly withMidGlow?: boolean;
  readonly children: ReactNode;
};

export function Layout({ locale, page, c, withMidGlow = false, children }: Props) {
  return (
    <>
      <a
        href="#inhalt"
        className="absolute left-4 -top-16 z-10 rounded-[10px] bg-mint-bright px-[18px] py-3 font-semibold text-on-mint transition-[top] duration-150 focus:top-4"
      >
        {c.common.skipLink}
      </a>

      {/* Clips the decorative radials: their containing block is the ICB, so
          without this they widen the document instead of bleeding off-canvas. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[260px] -right-[180px] size-[820px] rounded-full bg-[radial-gradient(circle,rgb(48_180_130/15%),transparent_68%)]" />
        {withMidGlow && (
          <div className="absolute top-[1900px] -left-[320px] size-[760px] rounded-full bg-[radial-gradient(circle,rgb(34_107_86/10%),transparent_68%)]" />
        )}
      </div>

      <SiteHeader locale={locale} page={page} c={c} />
      <main id="inhalt">{children}</main>
      <SiteFooter locale={locale} page={page} c={c} />
    </>
  );
}

function LanguageSwitch({
  locale,
  page,
  c,
}: {
  readonly locale: Locale;
  readonly page: PageId;
  readonly c: Content;
}) {
  const other: Locale = locale === "de" ? "en" : "de";
  return (
    <a
      href={href(other, page)}
      hrefLang={other}
      lang={other}
      data-lang-switch={other}
      aria-label={c.switchAria}
      className="inline-flex min-h-11 items-center gap-1.75 text-ink-soft hover:text-mint"
    >
      <Icon name="globe" className="size-4" />
      {c.otherLocaleName}
    </a>
  );
}

function SiteHeader({
  locale,
  page,
  c,
}: {
  readonly locale: Locale;
  readonly page: PageId;
  readonly c: Content;
}) {
  const lockup = (
    <>
      <BrandMark />
      <div>
        <p className="text-[9px] font-bold uppercase leading-[1.2] tracking-[.17em] text-ink-dim">
          {c.common.eyebrow}
        </p>
        <p className="font-display text-[19px] font-semibold leading-none tracking-[-.03em]">
          {EXTENSION.name}
        </p>
      </div>
    </>
  );

  return (
    // Static on phones: sticking a wrapped nav plus the CTA would hold ~200px
    // of an 844px viewport. From sm up the bar is one compact row again.
    <header className="relative z-5 border-b border-line bg-bg/[.88] backdrop-blur-md sm:sticky sm:top-0">
      <div
        className={`${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5 sm:min-h-21 sm:flex-nowrap sm:py-3`}
      >
        {page === "index" ? (
          <div className="flex items-center gap-[11px]">{lockup}</div>
        ) : (
          <a href={href(locale, "index")} className="flex items-center gap-[11px] text-ink">
            {lockup}
          </a>
        )}

        <nav
          aria-label={c.common.navAria}
          className="order-3 flex w-full flex-wrap items-center gap-x-5 text-[13.5px] sm:order-none sm:w-auto sm:gap-x-6 sm:text-sm"
        >
          <a href={href(locale, "index", "#features")} className={NAV_LINK}>
            {c.common.nav.features}
          </a>
          <a href={href(locale, "index", "#how")} className={NAV_LINK}>
            {c.common.nav.how}
          </a>
          <a href={href(locale, "index", "#permissions")} className={NAV_LINK}>
            {c.common.nav.permissions}
          </a>
          <a
            href={href(locale, "datenschutz")}
            {...(page === "datenschutz" ? { "aria-current": "page" as const } : {})}
            className={NAV_LINK}
          >
            {c.common.nav.privacy}
          </a>
          <LanguageSwitch locale={locale} page={page} c={c} />
        </nav>

        {/* The hero repeats this call to action full-width right below the fold. */}
        <Button href={STORE_URL} size="sm" className="max-sm:hidden">
          <Icon name="download" className="size-[17px]" />
          {c.common.installShort}
        </Button>
      </div>
    </header>
  );
}

function SiteFooter({
  locale,
  page,
  c,
}: {
  readonly locale: Locale;
  readonly page: PageId;
  readonly c: Content;
}) {
  return (
    <footer className="relative z-1 border-t border-line bg-black/[.14]">
      <div
        className={`${WRAP} flex flex-col items-start justify-between gap-4 pt-8.5 pb-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-10 sm:gap-y-6`}
      >
        <div className="flex items-center gap-[11px]">
          <BrandMark size="sm" />
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[15px] font-semibold tracking-[-.02em]">
              {EXTENSION.name}
            </span>
            <span className="text-[12.5px] text-ink-soft">{c.common.footerTagline}</span>
          </div>
        </div>

        <nav
          aria-label={c.common.footerAria}
          className="flex flex-wrap gap-x-6 gap-y-1 text-[13.5px] max-sm:grid max-sm:grid-cols-2"
        >
          <a href={href(locale, "index", "#features")} className={NAV_LINK}>
            {c.common.nav.features}
          </a>
          <a href={href(locale, "index", "#how")} className={NAV_LINK}>
            {c.common.nav.how}
          </a>
          <a
            href={href(locale, "datenschutz")}
            {...(page === "datenschutz" ? { "aria-current": "page" as const } : {})}
            className={NAV_LINK}
          >
            {c.common.nav.privacy}
          </a>
          <a
            href={href(locale, "impressum")}
            {...(page === "impressum" ? { "aria-current": "page" as const } : {})}
            className={NAV_LINK}
          >
            {c.common.nav.imprint}
          </a>
          <a href="mailto:kontakt@kernelminds.de" className={NAV_LINK}>
            {c.common.nav.contact}
          </a>
          <LanguageSwitch locale={locale} page={page} c={c} />
        </nav>

        <span className="text-[12.5px] text-ink-soft">{c.common.copyright}</span>
      </div>
    </footer>
  );
}
