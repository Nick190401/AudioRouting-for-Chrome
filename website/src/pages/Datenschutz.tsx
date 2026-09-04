import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import { Layout, WRAP } from "../components/Layout";
import { COMPANY, EXTENSION } from "../site";

const BODY = "text-base leading-[1.68] text-ink-soft";
const MONO = "font-mono text-ink";
const CARD = "rounded-[13px] border border-line surface shadow-card";

const TOC: readonly { id: string; label: string }[] = [
  { id: "a1", label: "1 · Verantwortlicher" },
  { id: "a2", label: "2 · Kurzfassung" },
  { id: "a3", label: "3 · Geltungsbereich" },
  { id: "a4", label: "4 · Daten in der Erweiterung" },
  { id: "a5", label: "5 · Tab-Audio" },
  { id: "a6", label: "6 · Einmaliger Mikrofonzugriff" },
  { id: "a7", label: "7 · Berechtigungen" },
  { id: "a8", label: "8 · Diese Website" },
  { id: "a9", label: "9 · Chrome Web Store" },
  { id: "a10", label: "10 · Empfänger und Drittländer" },
  { id: "a11", label: "11 · Ihre Rechte" },
  { id: "a12", label: "12 · Beschwerderecht" },
  { id: "a13", label: "13 · Änderungen" },
];

const STORAGE: readonly { key: string; api: string; purpose: string; retention: string }[] = [
  {
    key: "preferredOutputDevice",
    api: "chrome.storage.local",
    purpose:
      "Kennung und Anzeigename des von Ihnen gewählten Ausgabegeräts, damit AudioRoute Ihre Auswahl beim nächsten Öffnen kennt.",
    retention:
      "Bis Sie die Auswahl ändern, die Daten in Chrome löschen oder die Erweiterung deinstallieren.",
  },
  {
    key: "pendingOutputSelection",
    api: "chrome.storage.session",
    purpose:
      "Merkt sich eine begonnene Geräteauswahl, damit die Einrichtung nach Chromes Berechtigungsdialog fortgesetzt werden kann.",
    retention: "Nur für die laufende Browser-Sitzung; beim Beenden von Chrome verworfen.",
  },
];

const PERMISSIONS: readonly { name: string; why: string }[] = [
  { name: "activeTab", why: "Erkennt kurzzeitig den Tab, aus dem heraus Sie AudioRoute geöffnet haben." },
  { name: "tabCapture", why: "Erzeugt nach Ihrer ausdrücklichen Aktion den lokalen Audiostream dieses Tabs." },
  { name: "offscreen", why: "Hält den Web-Audio-Kontext am Leben, nachdem sich das Popup geschlossen hat." },
  { name: "scripting", why: "Fügt genau diesem Tab die mitgelieferte Vollbild-Brücke hinzu." },
  { name: "storage", why: "Speichert die beiden unter Abschnitt 4 genannten Einträge lokal." },
];

const RIGHTS: readonly string[] = [
  "Auskunft nach Art. 15 DSGVO",
  "Berichtigung nach Art. 16 DSGVO",
  "Löschung nach Art. 17 DSGVO",
  "Einschränkung nach Art. 18 DSGVO",
  "Datenübertragbarkeit nach Art. 20 DSGVO",
  "Widerspruch nach Art. 21 DSGVO",
];

export function Datenschutz() {
  return (
    <Layout page="datenschutz">
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
          Datenschutzerklärung
        </h1>
        <p className="max-w-[70ch] text-[17px] leading-[1.6] text-ink-soft">
          Für die Chrome-Erweiterung {EXTENSION.name} und für diese Website. Stand: September 2026.
        </p>
      </section>

      <div className={`${WRAP} relative z-1 grid gap-10 pt-10 pb-14 md:pt-14 md:pb-22 lg:grid-cols-[260px_minmax(0,860px)] lg:gap-18`}>
        <nav aria-labelledby="toc-titel" className="lg:sticky lg:top-27 lg:self-start">
          <p
            id="toc-titel"
            className="mb-2 text-[11px] font-semibold uppercase leading-[1.2] tracking-[.17em] text-ink-dim"
          >
            Inhalt
          </p>
          <ul className="m-0 grid list-none gap-x-6 p-0 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] lg:flex lg:flex-col lg:gap-0">
            {TOC.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  className="block py-1.75 text-sm leading-[1.5] text-ink-soft hover:text-mint"
                >
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-8.5 md:gap-11">
          <Article id="a1" num="01" title="Verantwortlicher">
            <p className={BODY}>Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist:</p>
            <p className={BODY}>
              {COMPANY.legalName}
              <br />
              {COMPANY.street}
              <br />
              {COMPANY.city}
              <br />
              {COMPANY.country}
            </p>
            <p className={BODY}>
              Vertreten durch {COMPANY.partners[0]} und {COMPANY.partners[1]}.
              <br />
              Telefon: <Link href={COMPANY.phoneHref}>{COMPANY.phone}</Link>
              <br />
              E-Mail: <Link href={COMPANY.emailHref}>{COMPANY.email}</Link>
            </p>
            <p className={BODY}>
              Eine Pflicht zur Benennung eines Datenschutzbeauftragten besteht nicht. Anfragen zum
              Datenschutz richten Sie bitte an die oben genannte E-Mail-Adresse.
            </p>
          </Article>

          <Article id="a2" num="02" title="Kurzfassung">
            <div className="flex flex-col gap-4 rounded-[13px] border border-mint-edge surface-mint px-6 py-6 shadow-card md:px-8 md:py-7.5">
              <p className="text-[18px] font-medium leading-[1.55]">
                Die Erweiterung {EXTENSION.name} besitzt kein Backend, stellt keine
                Netzwerkanfragen und überträgt keine Daten an uns oder an Dritte.
              </p>
              <p className={BODY}>
                Der Ton bleibt vollständig in der lokalen Medien-Pipeline von Chrome auf Ihrem
                Gerät. Es findet keine Aufzeichnung, keine Analyse, kein Tracking und keine
                Profilbildung statt. Gespeichert wird ausschließlich auf Ihrem Gerät — und
                ausschließlich, was die Geräteauswahl betrifft (Abschnitt 4).
              </p>
            </div>
          </Article>

          <Article id="a3" num="03" title="Geltungsbereich">
            <p className={BODY}>
              Diese Erklärung gilt für die Chrome-Erweiterung{" "}
              <strong className="font-medium text-ink">{EXTENSION.storeName}</strong> sowie für
              diese Website. Sie gilt nicht für Websites, deren Ton Sie mit {EXTENSION.name}{" "}
              umleiten: Für deren Inhalte und Datenverarbeitung sind allein die jeweiligen Anbieter
              verantwortlich.
            </p>
          </Article>

          <Article id="a4" num="04" title="Daten, die die Erweiterung auf Ihrem Gerät speichert">
            <p className={BODY}>
              {EXTENSION.name} legt über die Chrome-Speicher-API genau zwei Einträge an. Beide
              verbleiben ausschließlich auf Ihrem Gerät beziehungsweise in Ihrem Chrome-Profil und
              werden nicht an uns übertragen.
            </p>

            <dl className={`${CARD} m-0 mt-1.5 overflow-hidden`}>
              <div className="hidden grid-cols-[230px_minmax(0,1fr)_200px] gap-x-7 bg-black/[.14] px-6 py-3.25 text-[9.5px] font-bold uppercase tracking-[.1em] text-ink-soft md:grid">
                <span>Eintrag</span>
                <span>Inhalt und Zweck</span>
                <span>Dauer</span>
              </div>
              {STORAGE.map((row, index) => (
                <div
                  key={row.key}
                  className={`grid gap-y-1.5 px-4.5 py-4 md:grid-cols-[230px_minmax(0,1fr)_200px] md:items-start md:gap-x-7 md:px-6 md:py-4.5 ${
                    index < STORAGE.length - 1 ? "border-b border-line" : ""
                  }`}
                >
                  <dt className="font-mono text-[12.5px] leading-[1.5] text-mint">
                    {row.key}
                    <small className="block text-[12.5px] text-[#6d8179]">{row.api}</small>
                  </dt>
                  <dd className="m-0 text-[14.5px] leading-[1.55] text-ink-soft">{row.purpose}</dd>
                  <dd className="m-0 text-[14.5px] leading-[1.55] text-ink-soft">
                    {row.retention}
                  </dd>
                </div>
              ))}
            </dl>

            <p className={BODY}>
              Das Speichern und Auslesen dieser Informationen auf Ihrem Endgerät ist unbedingt
              erforderlich, damit die von Ihnen ausdrücklich gewünschte Funktion bereitgestellt
              werden kann (§ 25 Abs. 2 Nr. 2 TDDDG). Eine Einwilligung ist dafür nicht
              erforderlich. Da die Angaben Ihr Gerät nicht verlassen, verarbeiten wir insoweit
              keine personenbezogenen Daten.
            </p>
            <p className={BODY}>
              Sie können beide Einträge jederzeit löschen, indem Sie die Erweiterung in{" "}
              <span className={MONO}>chrome://extensions</span> entfernen.
            </p>
          </Article>

          <Article id="a5" num="05" title="Tab-Audio und Umleitung">
            <p className={BODY}>
              Wenn Sie das Routing für einen Tab starten, fordert {EXTENSION.name} über{" "}
              <span className={MONO}>chrome.tabCapture</span> einen lokalen Audiostream dieses Tabs
              an. Ein verstecktes Erweiterungsdokument nimmt den Stream entgegen, erzeugt einen
              Web-Audio-Kontext und wählt darüber Ihr Ausgabegerät.
            </p>
            <p className={BODY}>
              Der Audiostream wird{" "}
              <strong className="font-medium text-ink">
                nicht aufgezeichnet, nicht analysiert, nicht gespeichert, nicht hochgeladen und
                nicht übertragen
              </strong>
              . Er existiert nur im Arbeitsspeicher Ihres Browsers und endet, sobald Sie das
              Routing beenden oder den Tab schließen — ebenso, wenn das gewählte Gerät getrennt
              wird. Der Vorgang startet ausschließlich nach einer ausdrücklichen Aktion von Ihnen;
              Chrome zeigt währenddessen seinen üblichen Hinweis auf eine aktive Tab-Erfassung.
            </p>
          </Article>

          <Article id="a6" num="06" title="Einmaliger Mikrofonzugriff zur Geräteermittlung">
            <p className={BODY}>
              Chrome gibt die Namen der verfügbaren Audioausgänge in manchen Fällen erst frei,
              nachdem Zugriff auf Mediengeräte gewährt wurde. Steht die native
              Ausgabegeräte-Auswahl von Chrome nicht zur Verfügung, fordert {EXTENSION.name}{" "}
              deshalb einmalig die Medienberechtigung an — allein, um die Liste der Ausgabegeräte
              anzeigen zu können.
            </p>
            <p className={BODY}>
              Der dabei entstehende Mikrofonstream wird sofort wieder gestoppt. Er wird{" "}
              <strong className="font-medium text-ink">
                niemals aufgezeichnet, mitgehört, wiedergegeben, gespeichert, hochgeladen oder
                übertragen
              </strong>
              . Sie können die Berechtigung jederzeit in den Chrome-Einstellungen widerrufen;{" "}
              {EXTENSION.name} zeigt dann nur noch die von Chrome ohne Berechtigung
              bereitgestellten Geräte an.
            </p>
          </Article>

          <Article id="a7" num="07" title="Berechtigungen der Erweiterung">
            <dl className={`${CARD} m-0 overflow-hidden`}>
              {PERMISSIONS.map((permission, index) => (
                <div
                  key={permission.name}
                  className={`grid gap-y-1.5 px-4.5 py-4 md:grid-cols-[200px_minmax(0,1fr)] md:items-baseline md:gap-x-7 md:px-6 ${
                    index < PERMISSIONS.length - 1 ? "border-b border-line" : ""
                  }`}
                >
                  <dt className="font-mono text-[13px] text-mint">{permission.name}</dt>
                  <dd className="m-0 text-[14.5px] leading-[1.55] text-ink-soft">
                    {permission.why}
                  </dd>
                </div>
              ))}
            </dl>
            <p className={BODY}>
              {EXTENSION.name} verlangt keine Host-Berechtigung wie{" "}
              <span className={MONO}>&lt;all_urls&gt;</span>, hat keinen Zugriff auf Ihren
              Browserverlauf, Ihre Lesezeichen oder Ihre Zugangsdaten und lädt keinen Code aus dem
              Netz nach.
            </p>
          </Article>

          <Article id="a8" num="08" title="Diese Website">
            <h3 className="mt-1.5 font-display text-[17px] font-semibold tracking-[-.015em]">
              Hosting und Server-Logfiles
            </h3>
            <p className={BODY}>
              Diese Website wird bei{" "}
              <Placeholder>[HOSTING-ANBIETER, vollständige Firma und Anschrift]</Placeholder>{" "}
              gehostet. Beim Aufruf einer Seite verarbeitet der Server automatisch technische
              Zugriffsdaten: IP-Adresse des anfragenden Geräts, Datum und Uhrzeit des Zugriffs,
              aufgerufene Adresse, übertragene Datenmenge, Statuscode, Referrer sowie Browser- und
              Betriebssystemkennung.
            </p>
            <p className={BODY}>
              Zweck ist die technische Auslieferung, die Stabilität und die Sicherheit der Website.
              Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und störungsfreien
              Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Die Logfiles werden nach{" "}
              <Placeholder>[X]</Placeholder> Tagen gelöscht. Mit dem Hoster besteht ein Vertrag
              über die Auftragsverarbeitung nach Art. 28 DSGVO.
            </p>
            <h3 className="mt-2.5 font-display text-[17px] font-semibold tracking-[-.015em]">
              Keine Cookies, keine Analyse, keine externen Einbindungen
            </h3>
            <p className={BODY}>
              Diese Website setzt keine Cookies, verwendet keine Analyse-, Werbe- oder
              Tracking-Dienste und bindet keine Inhalte von Drittanbietern ein. Schriftarten werden
              vom eigenen Server ausgeliefert; eine Verbindung zu Google Fonts oder einem anderen
              externen Dienst wird nicht aufgebaut. Ein Cookie-Banner ist daher nicht erforderlich.
            </p>
            <h3 className="mt-2.5 font-display text-[17px] font-semibold tracking-[-.015em]">
              Kontaktaufnahme per E-Mail
            </h3>
            <p className={BODY}>
              Wenn Sie uns schreiben, verarbeiten wir Ihre E-Mail-Adresse und den Inhalt Ihrer
              Nachricht, um die Anfrage zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
              DSGVO bei vertragsbezogenen Anfragen, sonst Art. 6 Abs. 1 lit. f DSGVO. Wir löschen
              die Korrespondenz, sobald sie nicht mehr benötigt wird und keine gesetzlichen
              Aufbewahrungspflichten entgegenstehen.
            </p>
          </Article>

          <Article id="a9" num="09" title="Installation über den Chrome Web Store">
            <p className={BODY}>
              {EXTENSION.name} wird über den Chrome Web Store verteilt. Installation, Aktualisierung
              und die dortige Store-Seite werden von der Google Ireland Limited beziehungsweise der
              Google LLC betrieben; dabei verarbeitet Google eigenverantwortlich Daten, auf die wir
              keinen Einfluss haben. Wir erhalten von Google lediglich aggregierte, nicht
              personenbezogene Kennzahlen zur Verbreitung. Einzelheiten entnehmen Sie der
              Datenschutzerklärung von Google:{" "}
              <Link href="https://policies.google.com/privacy">policies.google.com/privacy</Link>
            </p>
          </Article>

          <Article id="a10" num="10" title="Empfänger und Übermittlung in Drittländer">
            <p className={BODY}>
              Aus der Erweiterung heraus werden keine Daten an Empfänger übermittelt — weder an uns
              noch an Dritte, weder innerhalb noch außerhalb der EU. Für die Website beschränken
              sich Empfänger auf den unter Abschnitt 8 genannten Hoster als Auftragsverarbeiter.
              Eine Übermittlung in Drittländer findet nicht statt.
            </p>
            <p className={BODY}>
              Eine automatisierte Entscheidungsfindung einschließlich Profiling nach Art. 22 DSGVO
              findet nicht statt.
            </p>
          </Article>

          <Article id="a11" num="11" title="Ihre Rechte">
            <p className={BODY}>
              Soweit wir personenbezogene Daten von Ihnen verarbeiten, stehen Ihnen die folgenden
              Rechte zu:
            </p>
            <ul className="m-0 mt-1 grid list-none gap-x-8 gap-y-3 p-0 md:grid-cols-2">
              {RIGHTS.map((right) => (
                <li key={right} className="flex gap-3 text-[15px] leading-[1.6] text-ink-soft">
                  <span aria-hidden="true" className="mt-2.25 size-[5px] shrink-0 rounded-full bg-mint" />
                  {right}
                </li>
              ))}
            </ul>
            <p className={BODY}>
              Zur Ausübung genügt eine formlose Nachricht an{" "}
              <Link href={COMPANY.emailHref}>{COMPANY.email}</Link>. Beruht eine Verarbeitung auf
              Ihrer Einwilligung, können Sie diese jederzeit mit Wirkung für die Zukunft
              widerrufen.
            </p>
          </Article>

          <Article id="a12" num="12" title="Beschwerderecht bei der Aufsichtsbehörde">
            <p className={BODY}>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Für
              uns zuständig ist:
            </p>
            <p className={BODY}>
              Der Hessische Beauftragte für Datenschutz und Informationsfreiheit
              <br />
              Postfach 3163
              <br />
              65021 Wiesbaden
              <br />
              <Link href="https://datenschutz.hessen.de">datenschutz.hessen.de</Link>
            </p>
          </Article>

          <Article id="a13" num="13" title="Änderungen dieser Erklärung">
            <p className={BODY}>
              Wir passen diese Datenschutzerklärung an, wenn sich die Erweiterung, die Website oder
              die Rechtslage ändern. Es gilt jeweils die auf dieser Seite veröffentlichte Fassung.
            </p>
            <p className="text-base leading-[1.68] text-ink-dim">
              Stand: September 2026 · {EXTENSION.name} Version {EXTENSION.version}
            </p>
          </Article>

          {/* Remove once the two placeholders in section 8 are filled in. */}
          <div className="flex items-start gap-4 rounded-[13px] border border-amber/30 bg-amber/[.07] px-6 py-5.5">
            <Icon name="info" className="size-5.5 shrink-0 stroke-amber" />
            <div>
              <p className="text-sm font-medium leading-[1.6] text-amber">
                Vor der Veröffentlichung zu erledigen:
              </p>
              <ol className="mt-2.25 flex list-decimal flex-col gap-2.25 pl-4.5">
                <li className="text-sm leading-[1.6] text-amber">
                  Hosting-Anbieter mit vollständiger Anschrift und Löschfrist der Server-Logfiles
                  eintragen (Abschnitt 8, oben orange markiert).
                </li>
                <li className="text-sm leading-[1.6] text-amber">Diesen Kasten entfernen.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
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
    <section id={id} aria-labelledby={`${id}-titel`} className="flex scroll-mt-27 flex-col gap-3.5">
      <span className="font-mono text-[12.5px] tracking-[.08em] text-mint">{num}</span>
      <h2
        id={`${id}-titel`}
        className="font-display text-[20px] font-semibold leading-[1.2] tracking-[-.025em] hyphens-auto sm:text-[22px] md:text-[26px]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Link({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <a href={href} className="text-mint hover:text-mint-bright">
      {children}
    </a>
  );
}

function Placeholder({ children }: { readonly children: ReactNode }) {
  return <span className="border-b border-dashed border-amber/45 text-amber">{children}</span>;
}
