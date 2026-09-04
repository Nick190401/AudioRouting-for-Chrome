import type { ReactNode } from "react";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { Layout, WRAP } from "../components/Layout";
import { Dot, PopupPreview } from "../components/PopupPreview";
import { EXTENSION, STORE_URL } from "../site";

const CARD = "rounded-[13px] border border-line surface shadow-card";
const EYEBROW = "text-[11px] font-semibold uppercase leading-[1.2] tracking-[.17em] text-ink-dim";

const FEATURES: readonly { icon: IconName; title: string; body: string }[] = [
  {
    icon: "tabSplit",
    title: "Kontrolle pro Tab",
    body: "Umgeleitet wird nur der Tab, den du ausgewählt hast. Der Rest von Chrome und Windows bleibt unberührt.",
  },
  {
    icon: "target",
    title: "Geführte Einrichtung",
    body: "Gerät wählen — fertig. Braucht Chrome eine Freigabe, öffnet sich ein eigenes Setup-Fenster, in dem der Dialog sichtbar und klickbar bleibt.",
  },
  {
    icon: "shield",
    title: "Standardmäßig lokal",
    body: "Kein Konto, kein Backend, keine Analyse, keine Aufzeichnung, kein Upload, kein Zugriff auf den Browserverlauf.",
  },
  {
    icon: "swap",
    title: "Umschalten im Betrieb",
    body: "Eine laufende Route wandert per Klick zwischen Kopfhörern, Lautsprechern, HDMI, USB und virtuellen Ausgängen.",
  },
  {
    icon: "window",
    title: "Läuft ohne Popup weiter",
    body: "Schließe das Popup, wann du willst. Die Route läuft im Hintergrund weiter, bis du sie beendest.",
  },
  {
    icon: "fullscreen",
    title: "Vollbild funktioniert",
    body: "Eine kleine mitgelieferte Brücke hilft gängigen Playern beim Sprung ins native Vollbild — YouTube-typische Bedienelemente, Video.js, Shaka Player, Plyr.",
  },
];

const STEPS: readonly { num: string; title: string; body: string }[] = [
  {
    num: "01",
    title: "Ton abspielen",
    body: "Starte Video, Musik oder Stream in dem Chrome-Tab, den du umleiten willst.",
  },
  {
    num: "02",
    title: "AudioRoute öffnen",
    body: "Symbolleiste, AudioRoute, Ausgabegerät wählen. Liegt die Geräteberechtigung schon vor, bleibt die Auswahl im Popup.",
  },
  {
    num: "03",
    title: "Routing starten",
    body: "Der Ton wechselt auf das gewählte Gerät und bleibt dort — auch nachdem du das Popup geschlossen hast.",
  },
];

const FLOW: readonly { label: string; title: string; api: string; end?: true }[] = [
  { label: "Schritt 1", title: "Aktiver Chrome-Tab", api: "activeTab" },
  { label: "Schritt 2", title: "Lokaler Tab-Audiostream", api: "chrome.tabCapture" },
  { label: "Schritt 3", title: "Offscreen-AudioContext", api: "offscreen" },
  { label: "Ziel", title: "Gewähltes Ausgabegerät", api: "setSinkId()", end: true },
];

const PERMISSIONS: readonly { name: string; why: string }[] = [
  { name: "activeTab", why: "Erkennt kurzzeitig den Tab, aus dem heraus du AudioRoute geöffnet hast." },
  { name: "tabCapture", why: "Erzeugt nach deiner ausdrücklichen Aktion den lokalen Audiostream dieses Tabs." },
  { name: "offscreen", why: "Hält den Web-Audio-Kontext am Leben, nachdem sich das Popup geschlossen hat." },
  { name: "scripting", why: "Fügt genau diesem Tab die mitgelieferte Vollbild-Brücke hinzu." },
  { name: "storage", why: "Merkt sich den gewählten Ausgang und setzt eine unterbrochene Geräte-Einrichtung fort." },
];

// Class names, not style props — the pages ship a style-src 'self' CSP.
const WAVE: readonly string[] = [
  "h-3.5 opacity-40",
  "h-6.5 opacity-60",
  "h-10.5",
  "h-5 opacity-60",
  "h-8 opacity-80",
  "h-3 opacity-40",
];

const PROMISES: readonly string[] = [
  "Kein Konto, keine Anmeldung",
  "Keine Analyse, keine Telemetrie",
  "Keine Werbung, kein Tracking",
  "Keine Cloud-Verarbeitung",
  "Keine Aufzeichnung, kein Transkript",
  "Kein Zugriff auf den Browserverlauf",
  "Kein Remote-Code",
];

const LIMITS: readonly ReactNode[] = [
  "Routing gilt pro Tab. Für jeden weiteren Tab startest du eine eigene Route.",
  "Chrome-Systemseiten und der Web Store lassen sich nicht erfassen.",
  "Chrome zeigt während einer aktiven Route seinen üblichen Aufnahme-Hinweis.",
  "Bluetooth, HDMI und virtuelle Geräte bringen Latenz aus Treiber und Betriebssystem mit.",
  "Wird das aktive Gerät getrennt, endet die Route sauber statt still weiterzulaufen.",
  <>
    Ungewöhnliche eingebettete Player brauchen für Vollbild weiterhin{" "}
    <span className="font-mono text-ink">F11</span>.
  </>,
];

export function Home() {
  return (
    <Layout page="index" withMidGlow>
      <section className={`${WRAP} relative z-1 grid grid-cols-1 items-center gap-12 pt-16 pb-14 lg:grid-cols-[minmax(0,1fr)_388px] lg:gap-18 lg:pt-23 lg:pb-21`}>
        <div className="flex flex-col items-start gap-4.5 lg:gap-6.5">
          <p className="inline-flex min-h-8 items-center gap-2.25 rounded-full border border-line-strong bg-white/[0.02] px-3.25 text-[11.5px] font-medium text-[#9bada6]">
            <Dot />
            Version {EXTENSION.version} · Chrome {EXTENSION.minChrome}+ · Manifest V3
          </p>
          <h1 className="max-w-[15ch] font-display text-[40px] font-semibold leading-[1.02] tracking-[-.035em] text-balance lg:text-[72px]">
            Ein Tab. Ein eigener <span className="text-mint">Ausgang</span>.
          </h1>
          <p className="max-w-[54ch] text-base leading-[1.6] text-ink-soft lg:text-[19px]">
            AudioRoute schickt den Ton eines einzelnen Chrome-Tabs auf Kopfhörer, Lautsprecher,
            HDMI, einen USB-DAC oder ein virtuelles Gerät. Windows, deine Spiele, dein Call und
            alle anderen Tabs bleiben bei ihrem Standardausgang.
          </p>
          <div className="mt-1.5 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button href={STORE_URL} size="lg" className="max-sm:w-full">
              <Icon name="route" className="size-[19px]" />
              Im Chrome Web Store holen
            </Button>
            <Button href="#ablauf" variant="ghost" size="lg" className="max-sm:w-full">
              So funktioniert es
              <Icon name="arrowDown" className="size-[17px] text-mint" />
            </Button>
          </div>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-4.5 gap-y-2.5 text-[13px] font-medium text-ink-soft">
            <span className="inline-flex items-center gap-1.75">
              <Icon name="shieldSmall" className="size-[15px] stroke-[#4da984]" />
              Kein Konto
            </span>
            <span aria-hidden="true" className="h-3.25 w-px bg-line-strong" />
            <span className="inline-flex items-center gap-1.75">
              <Icon name="serverSlash" className="size-[15px] stroke-[#4da984]" />
              Kein Backend
            </span>
            <span aria-hidden="true" className="h-3.25 w-px bg-line-strong" />
            <span className="inline-flex items-center gap-1.75">
              <Icon name="circleSlash" className="size-[15px] stroke-[#4da984]" />
              Keine Telemetrie
            </span>
          </p>
        </div>

        <PopupPreview />
      </section>

      <section className="relative z-1 border-y border-line bg-black/[.14]">
        <div className={`${WRAP} grid items-center gap-4.5 py-8 md:grid-cols-2 md:gap-16 md:py-11.5`}>
          <h2 className="font-display text-[22px] font-medium leading-[1.32] tracking-[-.02em] text-pretty md:text-[28px]">
            Windows lässt jede Anwendung ihren Ausgang wählen. Chrome schickt jeden Tab an
            denselben.
          </h2>
          <p className="text-[15px] leading-[1.62] text-ink-soft md:text-[17px]">
            AudioRoute ergänzt die fehlende Ebene:{" "}
            <strong className="font-medium text-ink">Ausgabegerät pro Tab</strong> — ohne den
            Windows-Standardausgang anzufassen und ohne dass ein zweites Programm im Hintergrund
            mitläuft.
          </p>
        </div>
      </section>

      <Section id="funktionen" eyebrow="Funktionen" title="Sechs Dinge, die es gut macht">
        <div className="grid gap-3 md:grid-cols-3 md:gap-5">
          {FEATURES.map((feature) => (
            <article key={feature.title} className={`${CARD} flex flex-col gap-3.5 p-5 md:p-6`}>
              <span className="grid size-11 shrink-0 place-items-center rounded-[11px] border border-mint/18 bg-mint-wash text-mint">
                <Icon name={feature.icon} />
              </span>
              <h3 className="font-display text-[16.5px] font-semibold tracking-[-.015em] md:text-[18px]">
                {feature.title}
              </h3>
              <p className="text-[14.5px] leading-[1.6] text-ink-soft">{feature.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="ablauf" eyebrow="So funktioniert es" title="In drei Klicks umgeleitet">
        <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3 md:gap-5">
          {STEPS.map((step) => (
            <li key={step.num} className={`${CARD} flex flex-col gap-3 p-5 md:px-6 md:py-6.5`}>
              <span className="font-mono text-[13px] tracking-[.08em] text-mint">{step.num}</span>
              <h3 className="font-display text-[16px] font-semibold tracking-[-.015em] md:text-[17px]">
                {step.title}
              </h3>
              <p className="text-[14.5px] leading-[1.6] text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className={`${CARD} mt-5 px-5 py-6 md:px-8 md:py-8.5`}>
          <p className="text-[9.5px] font-bold uppercase tracking-[.1em] text-ink-soft">
            Was technisch passiert
          </p>
          <div className="mt-6 grid items-center gap-2.5 md:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)_40px_minmax(0,1fr)_40px_minmax(0,1fr)] md:gap-0">
            {FLOW.map((node, index) => (
              <FlowNode key={node.api} node={node} showArrow={index > 0} />
            ))}
          </div>
          <p className="mt-5.5 text-[14.5px] leading-[1.62] text-ink-soft">
            Der Service-Worker holt eine Stream-ID für den aktiven Tab. Ein verstecktes
            Erweiterungsdokument nimmt diesen Stream entgegen, baut einen Web-Audio-Kontext und
            wählt darüber deinen Ausgang. Alles bleibt in Chromes lokaler Medien-Pipeline — der Ton
            verlässt dein Gerät nie.
          </p>
        </div>
      </Section>

      <Section
        id="berechtigungen"
        eyebrow="Berechtigungen"
        title="Fünf Berechtigungen, jede mit einem Grund"
      >
        <dl className={`${CARD} m-0 mt-0 overflow-hidden`}>
          <div className="hidden grid-cols-[220px_minmax(0,1fr)] gap-x-7 bg-black/[.14] px-6.5 py-3.5 text-[9.5px] font-bold uppercase tracking-[.1em] text-ink-soft sm:grid">
            <span>Berechtigung</span>
            <span>Wofür AudioRoute sie braucht</span>
          </div>
          {PERMISSIONS.map((permission, index) => (
            <div
              key={permission.name}
              className={`grid gap-y-1.5 px-4.5 py-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-baseline sm:gap-x-7 sm:px-6.5 sm:py-4.5 ${
                index < PERMISSIONS.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <dt className="font-mono text-[13.5px] text-mint">{permission.name}</dt>
              <dd className="m-0 text-[14.5px] leading-[1.55] text-ink-soft">{permission.why}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4.5 text-[14.5px] leading-[1.6] text-ink-soft">
          Keine Host-Berechtigung wie <span className="font-mono">&lt;all_urls&gt;</span>, kein
          dauerhafter Zugriff auf Webseiten, kein Remote-Code.
        </p>
        <div className={`${CARD} mt-5 flex items-start gap-3.75 px-5 py-4.5 md:px-6`}>
          <Icon name="microphone" className="size-5.5 shrink-0 stroke-mint" />
          <p className="text-[14.5px] leading-[1.6] text-ink-soft">
            Ein Sonderfall: Stellt Chrome die native Ausgabegeräte-Auswahl nicht bereit, fragt
            AudioRoute einmalig die Medienberechtigung ab — allein, um die Namen der verfügbaren
            Ausgänge anzeigen zu können. Der dabei entstehende Mikrofonstream wird sofort gestoppt
            und niemals aufgezeichnet, gespeichert oder übertragen.
          </p>
        </div>
      </Section>

      <section className={`${WRAP} relative z-1 pt-14 md:pt-22`}>
        <div className="grid gap-7 rounded-[13px] border border-mint-edge surface-mint px-6 py-8 shadow-card md:gap-14 md:px-11 md:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <div className="flex flex-col items-start gap-4 md:gap-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-mint/18 bg-mint-wash text-mint">
              <Icon name="shield" className="size-6.5" />
            </span>
            <h2 className="max-w-[20ch] font-display text-[25px] font-semibold leading-[1.12] tracking-[-.03em] md:text-[38px]">
              AudioRoute hat kein Backend und stellt keine Netzwerkanfragen.
            </h2>
            <p className="max-w-[46ch] text-[15px] leading-[1.62] text-ink-soft md:text-[16.5px]">
              Dein Ton verlässt dein Gerät nicht. Dauerhaft gespeichert wird nur eines: das zuletzt
              gewählte Ausgabegerät — lokal in Chrome, auf deinem Rechner.
            </p>
            <Button href="datenschutz.html" className="mt-1 max-sm:w-full">
              Datenschutzerklärung lesen
              <Icon name="chevronRight" className="size-4" />
            </Button>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.75 p-0">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-center gap-2.75 text-[14.5px] text-ink-soft">
                <Icon name="check" className="size-4.25 shrink-0 stroke-mint" />
                {promise}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Section eyebrow="Ehrliche Grenzen" title="Was AudioRoute nicht kann">
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 md:gap-x-10 md:gap-y-4">
          {LIMITS.map((limit, index) => (
            <li key={index} className="flex gap-3.25 text-[14.5px] leading-[1.6] text-ink-soft md:text-[15px]">
              <span aria-hidden="true" className="mt-2.25 size-[5px] shrink-0 rounded-full bg-ink-dim" />
              <span>{limit}</span>
            </li>
          ))}
        </ul>
      </Section>

      <section className={`${WRAP} relative z-1 pt-12 pb-12 md:pt-24 md:pb-23`}>
        <div className={`${CARD} flex flex-col items-center gap-4.5 px-5.5 py-10 text-center md:gap-5.5 md:px-11 md:py-15.5`}>
          <div aria-hidden="true" className="flex h-9.5 items-end justify-center gap-1.25 md:h-11.5">
            {WAVE.map((bar) => (
              <span
                key={bar}
                className={`w-1 rounded-full bg-mint shadow-[0_0_9px_rgb(94_232_174/30%)] ${bar}`}
              />
            ))}
          </div>
          <h2 className="max-w-[20ch] font-display text-[28px] font-semibold leading-[1.1] tracking-[-.03em] md:text-[44px]">
            Der richtige Tab. Der richtige Ausgang.
          </h2>
          <p className="max-w-[52ch] text-[15px] leading-[1.6] text-ink-soft md:text-[17px]">
            Nichts verlässt deinen Rechner. Kostenlos, ohne Konto, ohne Hintergrundprogramm.
          </p>
          <Button href={STORE_URL} size="lg" className="mt-1.5 max-sm:w-full">
            <Icon name="download" className="size-[19px]" />
            Im Chrome Web Store holen
          </Button>
          <p className="text-sm text-ink-soft">
            Benötigt Google Chrome {EXTENSION.minChrome} oder neuer auf dem Desktop.
          </p>
        </div>
      </section>
    </Layout>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  readonly id?: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  const headingId = `${id ?? title.toLowerCase().replace(/\W+/g, "-")}-titel`;
  return (
    <section
      {...(id ? { id } : {})}
      aria-labelledby={headingId}
      className={`${WRAP} relative z-1 pt-14 md:pt-22`}
    >
      <div className="mb-6.5 flex flex-col gap-3.5 md:mb-10.5">
        <p className={EYEBROW}>{eyebrow}</p>
        <h2
          id={headingId}
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
  node,
  showArrow,
}: {
  readonly node: { label: string; title: string; api: string; end?: true };
  readonly showArrow: boolean;
}) {
  return (
    <>
      {showArrow && (
        <div
          aria-hidden="true"
          className={`grid place-items-center max-md:rotate-90 ${node.end ? "text-mint" : "text-ink-dim"}`}
        >
          <Icon name="arrowRight" className="size-5" />
        </div>
      )}
      <div
        className={`flex flex-col gap-1.5 rounded-[13px] border px-4 py-4.5 ${
          node.end ? "border-mint-edge surface-mint" : "border-line bg-white/[0.02]"
        }`}
      >
        <span className="text-[8.5px] font-bold uppercase tracking-[.12em] text-node-label">
          {node.label}
        </span>
        <strong className="text-sm font-semibold">{node.title}</strong>
        <span className={`font-mono text-[11.5px] ${node.end ? "text-mint" : "text-signal-ink"}`}>
          {node.api}
        </span>
      </div>
    </>
  );
}
