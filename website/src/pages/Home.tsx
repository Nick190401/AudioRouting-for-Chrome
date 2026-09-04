import type { ReactNode } from "react";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { Layout, WRAP } from "../components/Layout";
import { Dot, PopupPreview } from "../components/PopupPreview";
import { CARD, EYEBROW } from "../components/prose";
import { STORE_URL, href, type Locale } from "../i18n";
import type { Content } from "../content/de";

/** Icons and API names are locale-independent, so they stay next to the layout. */
const FEATURE_ICONS: readonly IconName[] = [
  "tabSplit",
  "target",
  "shield",
  "swap",
  "window",
  "fullscreen",
];
const TRUST_ICONS: readonly IconName[] = ["shieldSmall", "serverSlash", "circleSlash"];
const STEP_NUMBERS: readonly string[] = ["01", "02", "03"];
const FLOW_APIS: readonly string[] = ["activeTab", "chrome.tabCapture", "offscreen", "setSinkId()"];

// Class names, not style props — the pages ship a style-src 'self' CSP.
const WAVE: readonly string[] = [
  "h-3.5 opacity-40",
  "h-6.5 opacity-60",
  "h-10.5",
  "h-5 opacity-60",
  "h-8 opacity-80",
  "h-3 opacity-40",
];

export function Home({ locale, c }: { readonly locale: Locale; readonly c: Content }) {
  const t = c.home;

  return (
    <Layout locale={locale} page="index" c={c} withMidGlow>
      <section
        className={`${WRAP} relative z-1 grid grid-cols-1 items-center gap-12 pt-16 pb-14 lg:grid-cols-[minmax(0,1fr)_388px] lg:gap-18 lg:pt-23 lg:pb-21`}
      >
        <div className="flex flex-col items-start gap-4.5 lg:gap-6.5">
          <p className="inline-flex min-h-8 items-center gap-2.25 rounded-full border border-line-strong bg-white/[0.02] px-3.25 text-[11.5px] font-medium text-[#9bada6]">
            <Dot />
            {t.badge}
          </p>
          <h1 className="max-w-[15ch] font-display text-[40px] font-semibold leading-[1.02] tracking-[-.035em] text-balance lg:text-[72px]">
            {t.h1Before}
            <span className="text-mint">{t.h1Accent}</span>
            {t.h1After}
          </h1>
          <p className="max-w-[54ch] text-base leading-[1.6] text-ink-soft lg:text-[19px]">
            {t.lead}
          </p>
          <div className="mt-1.5 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button href={STORE_URL} size="lg" className="max-sm:w-full">
              <Icon name="route" className="size-[19px]" />
              {t.ctaStore}
            </Button>
            <Button href="#how" variant="ghost" size="lg" className="max-sm:w-full">
              {t.ctaHow}
              <Icon name="arrowDown" className="size-[17px] text-mint" />
            </Button>
          </div>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-4.5 gap-y-2.5 text-[13px] font-medium text-ink-soft">
            {t.trust.map((label, index) => (
              <span key={label} className="contents">
                {index > 0 && <span aria-hidden="true" className="h-3.25 w-px bg-line-strong" />}
                <span className="inline-flex items-center gap-1.75">
                  <Icon
                    name={TRUST_ICONS[index] ?? "check"}
                    className="size-[15px] stroke-[#4da984]"
                  />
                  {label}
                </span>
              </span>
            ))}
          </p>
        </div>

        <PopupPreview eyebrow={c.common.eyebrow} t={t.popup} />
      </section>

      <section className="relative z-1 border-y border-line bg-black/[.14]">
        <div
          className={`${WRAP} grid items-center gap-4.5 py-8 md:grid-cols-2 md:gap-16 md:py-11.5`}
        >
          <h2 className="font-display text-[22px] font-medium leading-[1.32] tracking-[-.02em] text-pretty md:text-[28px]">
            {t.band.heading}
          </h2>
          <p className="text-[15px] leading-[1.62] text-ink-soft md:text-[17px]">{t.band.body}</p>
        </div>
      </section>

      <Section id="features" eyebrow={t.features.eyebrow} title={t.features.title}>
        <div className="grid gap-3 md:grid-cols-3 md:gap-5">
          {t.features.items.map((feature, index) => (
            <article key={feature.title} className={`${CARD} flex flex-col gap-3.5 p-5 md:p-6`}>
              <span className="grid size-11 shrink-0 place-items-center rounded-[11px] border border-mint/18 bg-mint-wash text-mint">
                <Icon name={FEATURE_ICONS[index] ?? "check"} />
              </span>
              <h3 className="font-display text-[16.5px] font-semibold tracking-[-.015em] md:text-[18px]">
                {feature.title}
              </h3>
              <p className="text-[14.5px] leading-[1.6] text-ink-soft">{feature.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="how" eyebrow={t.how.eyebrow} title={t.how.title}>
        <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3 md:gap-5">
          {t.how.steps.map((step, index) => (
            <li key={step.title} className={`${CARD} flex flex-col gap-3 p-5 md:px-6 md:py-6.5`}>
              <span className="font-mono text-[13px] tracking-[.08em] text-mint">
                {STEP_NUMBERS[index]}
              </span>
              <h3 className="font-display text-[16px] font-semibold tracking-[-.015em] md:text-[17px]">
                {step.title}
              </h3>
              <p className="text-[14.5px] leading-[1.6] text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className={`${CARD} mt-5 px-5 py-6 md:px-8 md:py-8.5`}>
          <p className="text-[9.5px] font-bold uppercase tracking-[.1em] text-ink-soft">
            {t.how.flowLabel}
          </p>
          <div className="mt-6 grid items-center gap-2.5 md:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)_40px_minmax(0,1fr)_40px_minmax(0,1fr)] md:gap-0">
            {t.how.flow.map((node, index) => (
              <FlowNode
                key={node.title}
                label={node.label}
                title={node.title}
                api={FLOW_APIS[index] ?? ""}
                end={index === t.how.flow.length - 1}
                showArrow={index > 0}
              />
            ))}
          </div>
          <p className="mt-5.5 text-[14.5px] leading-[1.62] text-ink-soft">{t.how.flowBody}</p>
        </div>
      </Section>

      <Section id="permissions" eyebrow={t.permissions.eyebrow} title={t.permissions.title}>
        <dl className={`${CARD} m-0 overflow-hidden`}>
          <div className="hidden grid-cols-[220px_minmax(0,1fr)] gap-x-7 bg-black/[.14] px-6.5 py-3.5 text-[9.5px] font-bold uppercase tracking-[.1em] text-ink-soft sm:grid">
            <span>{t.permissions.colName}</span>
            <span>{t.permissions.colWhy}</span>
          </div>
          {t.permissions.items.map((permission, index) => (
            <div
              key={permission.name}
              className={`grid gap-y-1.5 px-4.5 py-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-baseline sm:gap-x-7 sm:px-6.5 sm:py-4.5 ${
                index < t.permissions.items.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <dt className="font-mono text-[13.5px] text-mint">{permission.name}</dt>
              <dd className="m-0 text-[14.5px] leading-[1.55] text-ink-soft">{permission.why}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4.5 text-[14.5px] leading-[1.6] text-ink-soft">{t.permissions.footnote}</p>
        <div className={`${CARD} mt-5 flex items-start gap-3.75 px-5 py-4.5 md:px-6`}>
          <Icon name="microphone" className="size-5.5 shrink-0 stroke-mint" />
          <p className="text-[14.5px] leading-[1.6] text-ink-soft">{t.permissions.micNote}</p>
        </div>
      </Section>

      <section className={`${WRAP} relative z-1 pt-14 md:pt-22`}>
        <div className="grid gap-7 rounded-[13px] border border-mint-edge surface-mint px-6 py-8 shadow-card md:gap-14 md:px-11 md:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <div className="flex flex-col items-start gap-4 md:gap-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-mint/18 bg-mint-wash text-mint">
              <Icon name="shield" className="size-6.5" />
            </span>
            <h2 className="max-w-[20ch] font-display text-[25px] font-semibold leading-[1.12] tracking-[-.03em] hyphens-auto md:text-[38px]">
              {t.privacy.heading}
            </h2>
            <p className="max-w-[46ch] text-[15px] leading-[1.62] text-ink-soft md:text-[16.5px]">
              {t.privacy.lead}
            </p>
            <Button href={href(locale, "datenschutz")} className="mt-1 max-sm:w-full">
              {t.privacy.cta}
              <Icon name="chevronRight" className="size-4" />
            </Button>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.75 p-0">
            {t.privacy.promises.map((promise) => (
              <li key={promise} className="flex items-center gap-2.75 text-[14.5px] text-ink-soft">
                <Icon name="check" className="size-4.25 shrink-0 stroke-mint" />
                {promise}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Section eyebrow={t.limits.eyebrow} title={t.limits.title} headingId="limits-title">
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 md:gap-x-10 md:gap-y-4">
          {t.limits.items.map((limit, index) => (
            <li
              key={index}
              className="flex gap-3.25 text-[14.5px] leading-[1.6] text-ink-soft md:text-[15px]"
            >
              <span
                aria-hidden="true"
                className="mt-2.25 size-[5px] shrink-0 rounded-full bg-ink-dim"
              />
              <span>{limit}</span>
            </li>
          ))}
        </ul>
      </Section>

      <section className={`${WRAP} relative z-1 pt-12 pb-12 md:pt-24 md:pb-23`}>
        <div
          className={`${CARD} flex flex-col items-center gap-4.5 px-5.5 py-10 text-center md:gap-5.5 md:px-11 md:py-15.5`}
        >
          <div aria-hidden="true" className="flex h-9.5 items-end justify-center gap-1.25 md:h-11.5">
            {WAVE.map((bar) => (
              <span
                key={bar}
                className={`w-1 rounded-full bg-mint shadow-[0_0_9px_rgb(94_232_174/30%)] ${bar}`}
              />
            ))}
          </div>
          <h2 className="max-w-[20ch] font-display text-[28px] font-semibold leading-[1.1] tracking-[-.03em] md:text-[44px]">
            {t.final.heading}
          </h2>
          <p className="max-w-[52ch] text-[15px] leading-[1.6] text-ink-soft md:text-[17px]">
            {t.final.body}
          </p>
          <Button href={STORE_URL} size="lg" className="mt-1.5 max-sm:w-full">
            <Icon name="download" className="size-[19px]" />
            {t.final.cta}
          </Button>
          <p className="text-sm text-ink-soft">{t.final.requirement}</p>
        </div>
      </section>
    </Layout>
  );
}

function Section({
  id,
  eyebrow,
  title,
  headingId,
  children,
}: {
  readonly id?: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly headingId?: string;
  readonly children: ReactNode;
}) {
  const resolvedId = headingId ?? `${id ?? "section"}-title`;
  return (
    <section
      {...(id ? { id } : {})}
      aria-labelledby={resolvedId}
      className={`${WRAP} relative z-1 pt-14 md:pt-22`}
    >
      <div className="mb-6.5 flex flex-col gap-3.5 md:mb-10.5">
        <p className={EYEBROW}>{eyebrow}</p>
        <h2
          id={resolvedId}
          className="max-w-[24ch] font-display text-[28px] font-semibold leading-[1.1] tracking-[-.03em] hyphens-auto md:text-[42px]"
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function FlowNode({
  label,
  title,
  api,
  end,
  showArrow,
}: {
  readonly label: string;
  readonly title: string;
  readonly api: string;
  readonly end: boolean;
  readonly showArrow: boolean;
}) {
  return (
    <>
      {showArrow && (
        <div
          aria-hidden="true"
          className={`grid place-items-center max-md:rotate-90 ${end ? "text-mint" : "text-ink-dim"}`}
        >
          <Icon name="arrowRight" className="size-5" />
        </div>
      )}
      <div
        className={`flex flex-col gap-1.5 rounded-[13px] border px-4 py-4.5 ${
          end ? "border-mint-edge surface-mint" : "border-line bg-white/[0.02]"
        }`}
      >
        <span className="text-[8.5px] font-bold uppercase tracking-[.12em] text-node-label">
          {label}
        </span>
        <strong className="text-sm font-semibold">{title}</strong>
        <span className={`font-mono text-[11.5px] ${end ? "text-mint" : "text-signal-ink"}`}>
          {api}
        </span>
      </div>
    </>
  );
}
