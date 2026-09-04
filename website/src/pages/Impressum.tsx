import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import { Layout, WRAP } from "../components/Layout";
import { COMPANY, EXTENSION } from "../site";

const BODY = "text-base leading-[1.68] text-ink-soft";

export function Impressum() {
  return (
    <Layout page="impressum">
      <section className={`${WRAP} relative z-1 flex flex-col gap-4.5 border-b border-line pt-12 pb-10 md:pt-18 md:pb-12`}>
        <a
          href="index.html"
          className="inline-flex min-h-11 items-center gap-2 self-start text-[13.5px] text-ink-soft"
        >
          <Icon name="chevronLeft" className="size-[15px]" />
          Startseite
        </a>
        <p className="text-[11px] font-semibold uppercase leading-[1.2] tracking-[.17em] text-ink-dim">
          Rechtliches
        </p>
        <h1 className="font-display text-[30px] font-semibold leading-[1.04] tracking-[-.035em] hyphens-auto sm:text-[38px] md:text-[60px]">
          Impressum
        </h1>
        <p className="text-[17px] leading-[1.6] text-ink-soft">
          Angaben gemäß Digitale-Dienste-Gesetz (DDG)
        </p>
      </section>

      <div className={`${WRAP} relative z-1`}>
        <div className="flex max-w-[1000px] flex-col gap-5 pt-10 pb-14 md:pt-16 md:pb-22">
          <Block num="§ 1" title="Angaben gemäß § 5 DDG">
            <p className={BODY}>
              {COMPANY.legalName}
              <br />
              {COMPANY.street}
              <br />
              {COMPANY.city}
            </p>
          </Block>

          <Block num="§ 2" title="Vertreten durch">
            <p className={BODY}>
              {COMPANY.partners[0]}
              <br />
              {COMPANY.partners[1]}
              <br />
              Vertretungsberechtigte Gesellschafter
            </p>
          </Block>

          <Block num="§ 2a" title="Umsatzsteuer-Identifikationsnummer">
            <p className="font-mono text-[15px] leading-[1.68] tracking-[.04em] text-ink">
              {COMPANY.vatId}
            </p>
          </Block>

          <Block num="§ 3" title="Kontakt">
            <p className={BODY}>
              Tel.{" "}
              <a href={COMPANY.phoneHref} className="text-mint hover:text-mint-bright">
                {COMPANY.phone}
              </a>
            </p>
            <p className={BODY}>
              E-Mail{" "}
              <a href={COMPANY.emailHref} className="text-mint hover:text-mint-bright">
                {COMPANY.email}
              </a>
            </p>
          </Block>

          <Block num="§ 4" title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
            <p className={BODY}>
              {COMPANY.partners[0]}
              <br />
              {COMPANY.legalName}
              <br />
              {COMPANY.street}, {COMPANY.city}
            </p>
          </Block>

          <Block num="§ 5" title="Streitschlichtung">
            <p className={BODY}>
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </Block>

          <Block num="§ 6" title="Zur Erweiterung">
            <p className={BODY}>
              {EXTENSION.name} ist eine Chrome-Erweiterung der {COMPANY.legalName}. Google Chrome
              und der Chrome Web Store sind Marken der Google LLC; zwischen der{" "}
              {COMPANY.legalName} und Google besteht keine Verbindung.
            </p>
          </Block>
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
