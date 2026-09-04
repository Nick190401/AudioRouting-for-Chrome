import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import { Layout, WRAP } from "../components/Layout";
import { href, type Locale } from "../i18n";
import type { Content } from "../content/de";

export function Impressum({ locale, c }: { readonly locale: Locale; readonly c: Content }) {
  const t = c.impressum;

  return (
    <Layout locale={locale} page="impressum" c={c}>
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
        <p className="text-[17px] leading-[1.6] text-ink-soft">{t.lead}</p>
      </section>

      <div className={`${WRAP} relative z-1`}>
        <div className="flex max-w-[1000px] flex-col gap-5 pt-10 pb-14 md:pt-16 md:pb-22">
          {t.blocks.map((block) => (
            <Block key={block.num} num={block.num} title={block.title}>
              {block.body}
            </Block>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function Block({
  num,
  title,
  children,
}: {
  readonly num: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-[13px] border border-line surface p-6 shadow-card md:grid-cols-[92px_minmax(0,1fr)] md:gap-8 md:px-8.5 md:py-8">
      <span className="font-mono text-[13px] tracking-[.06em] text-mint">{num}</span>
      <div className="flex flex-col gap-3.5">
        <h2 className="font-display text-[19px] font-semibold tracking-[-.02em] hyphens-auto sm:text-[22px]">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}
