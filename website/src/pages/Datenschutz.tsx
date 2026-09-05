import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import { Layout, WRAP } from "../components/Layout";
import { CARD } from "../components/prose";
import { href, type Locale } from "../i18n";
import type { Content } from "../content/de";

/** Storage keys and API names are locale-independent. */
const STORAGE_KEYS: readonly { key: string; api: string }[] = [
  { key: "preferredOutputDevice", api: "chrome.storage.local" },
  { key: "pendingOutputSelection", api: "chrome.storage.session" },
  { key: "preferredAudioSettings", api: "chrome.storage.local" },
  { key: "audioRouteStudioScenes", api: "chrome.storage.local" },
  { key: "studioFullscreenRecovery", api: "chrome.storage.session" },
];

export function Datenschutz({ locale, c }: { readonly locale: Locale; readonly c: Content }) {
  const t = c.datenschutz;

  const bodies: readonly ReactNode[] = [
    t.s1,
    <div className="flex flex-col gap-4 rounded-[13px] border border-mint-edge surface-mint px-6 py-6 shadow-card md:px-8 md:py-7.5">
      <p className="text-[18px] font-medium leading-[1.55]">{t.summaryLead}</p>
      {t.s2}
    </div>,
    t.s3,
    <>
      {t.s4Intro}
      <dl className={`${CARD} m-0 mt-1.5 overflow-hidden`}>
        <div className="hidden grid-cols-[230px_minmax(0,1fr)_200px] gap-x-7 bg-black/[.14] px-6 py-3.25 text-[9.5px] font-bold uppercase tracking-[.1em] text-ink-soft md:grid">
          <span>{t.storage.colEntry}</span>
          <span>{t.storage.colPurpose}</span>
          <span>{t.storage.colDuration}</span>
        </div>
        {t.storage.rows.map((row, index) => {
          const meta = STORAGE_KEYS[index];
          return (
            <div
              key={meta?.key ?? index}
              className={`grid gap-y-1.5 px-4.5 py-4 md:grid-cols-[230px_minmax(0,1fr)_200px] md:items-start md:gap-x-7 md:px-6 md:py-4.5 ${
                index < t.storage.rows.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <dt className="font-mono text-[12.5px] leading-[1.5] text-mint">
                {meta?.key}
                <small className="block text-[12.5px] text-[#6d8179]">{meta?.api}</small>
              </dt>
              <dd className="m-0 text-[14.5px] leading-[1.55] text-ink-soft">{row.purpose}</dd>
              <dd className="m-0 text-[14.5px] leading-[1.55] text-ink-soft">{row.retention}</dd>
            </div>
          );
        })}
      </dl>
      {t.s4Outro}
    </>,
    t.s5,
    t.s6,
    <>
      <dl className={`${CARD} m-0 overflow-hidden`}>
        {t.permissions.map((permission, index) => (
          <div
            key={permission.name}
            className={`grid gap-y-1.5 px-4.5 py-4 md:grid-cols-[200px_minmax(0,1fr)] md:items-baseline md:gap-x-7 md:px-6 ${
              index < t.permissions.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <dt className="font-mono text-[13px] text-mint">{permission.name}</dt>
            <dd className="m-0 text-[14.5px] leading-[1.55] text-ink-soft">{permission.why}</dd>
          </div>
        ))}
      </dl>
      {t.s7Outro}
    </>,
    t.s8(placeholder),
    t.s9,
    t.s10,
    <>
      {t.s11Intro}
      <ul className="m-0 mt-1 grid list-none gap-x-8 gap-y-3 p-0 md:grid-cols-2">
        {t.rights.map((right) => (
          <li key={right} className="flex gap-3 text-[15px] leading-[1.6] text-ink-soft">
            <span aria-hidden="true" className="mt-2.25 size-[5px] shrink-0 rounded-full bg-mint" />
            {right}
          </li>
        ))}
      </ul>
      {t.s11Outro}
    </>,
    t.s12,
    t.s13,
  ];

  return (
    <Layout locale={locale} page="datenschutz" c={c}>
      <section
        className={`${WRAP} relative z-1 flex flex-col gap-4.5 border-b border-line pt-12 pb-10 md:pt-18 md:pb-12`}
      >
        <a
          href={href(locale, "index")}
          className="inline-flex min-h-11 items-center gap-2 self-start text-[13.5px] text-ink-soft"
        >
          <Icon name="chevronLeft" className="size-[15px]" />
          {c.common.backHome}
        </a>
        <p className="text-[11px] font-semibold uppercase leading-[1.2] tracking-[.17em] text-ink-dim">
          {t.eyebrow}
        </p>
        <h1 className="font-display text-[30px] font-semibold leading-[1.04] tracking-[-.035em] hyphens-auto sm:text-[38px] md:text-[60px]">
          {t.h1}
        </h1>
        <p className="max-w-[70ch] text-[17px] leading-[1.6] text-ink-soft">{t.lead}</p>
        {t.translationNote}
      </section>

      <div
        className={`${WRAP} relative z-1 grid gap-10 pt-10 pb-14 md:pt-14 md:pb-22 lg:grid-cols-[260px_minmax(0,860px)] lg:gap-18`}
      >
        <nav aria-labelledby="toc-title" className="lg:sticky lg:top-27 lg:self-start">
          <p
            id="toc-title"
            className="mb-2 text-[11px] font-semibold uppercase leading-[1.2] tracking-[.17em] text-ink-dim"
          >
            {t.tocTitle}
          </p>
          <ul className="m-0 grid list-none gap-x-6 p-0 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] lg:flex lg:flex-col lg:gap-0">
            {t.toc.map((label, index) => (
              <li key={label}>
                <a
                  href={`#a${index + 1}`}
                  className="block py-1.75 text-sm leading-[1.5] text-ink-soft hover:text-mint"
                >
                  {index + 1} · {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-8.5 md:gap-11">
          {t.titles.map((title, index) => (
            <Article
              key={title}
              id={`a${index + 1}`}
              num={String(index + 1).padStart(2, "0")}
              title={title}
            >
              {bodies[index]}
            </Article>
          ))}

          {/* Remove once the two placeholders in section 8 are filled in. */}
          <div className="flex items-start gap-4 rounded-[13px] border border-amber/30 bg-amber/[.07] px-6 py-5.5">
            <Icon name="info" className="size-5.5 shrink-0 stroke-amber" />
            <div>
              <p className="text-sm font-medium leading-[1.6] text-amber">{t.todo.heading}</p>
              <ol className="mt-2.25 flex list-decimal flex-col gap-2.25 pl-4.5">
                {t.todo.items.map((item) => (
                  <li key={item} className="text-sm leading-[1.6] text-amber">
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function placeholder(text: string): ReactNode {
  return <span className="border-b border-dashed border-amber/45 text-amber">{text}</span>;
}

function Article({
  id,
  num,
  title,
  children,
}: {
  readonly id: string;
  readonly num: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-27 flex-col gap-3.5">
      <span className="font-mono text-[12.5px] tracking-[.08em] text-mint">{num}</span>
      <h2
        id={`${id}-title`}
        className="font-display text-[20px] font-semibold leading-[1.2] tracking-[-.025em] hyphens-auto sm:text-[22px] md:text-[26px]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
