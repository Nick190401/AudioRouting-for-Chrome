import type { ReactNode } from "react";
import { COMPANY, EXTENSION } from "../i18n";
import { H3, LINK, MONO, P, STRONG } from "../components/prose";

export const de = {
  htmlLang: "de",
  localeName: "Deutsch",
  otherLocaleName: "English",
  switchAria: "Switch to English",

  meta: {
    index: {
      title: "AudioRoute — Ein Chrome-Tab, ein eigener Audioausgang",
      description:
        "AudioRoute leitet den Ton eines einzelnen Chrome-Tabs auf Kopfhörer, Lautsprecher, HDMI oder ein virtuelles Gerät um. Ohne Konto, ohne Backend, ohne Telemetrie.",
    },
    impressum: {
      title: "Impressum — AudioRoute",
      description: "Impressum der KernelMinds GbR, Anbieterin der Chrome-Erweiterung AudioRoute.",
    },
    datenschutz: {
      title: "Datenschutzerklärung — AudioRoute",
      description:
        "Datenschutzerklärung für die Chrome-Erweiterung AudioRoute und diese Website. Kein Backend, keine Netzwerkanfragen, keine Telemetrie.",
    },
  },

  common: {
    eyebrow: "Chrome Audio Router",
    skipLink: "Zum Inhalt springen",
    installShort: "Kostenlos installieren",
    backHome: "Startseite",
    navAria: "Hauptnavigation",
    footerAria: "Fußzeile",
    nav: {
      features: "Funktionen",
      how: "So funktioniert es",
      permissions: "Berechtigungen",
      privacy: "Datenschutz",
      imprint: "Impressum",
      contact: "Kontakt",
    },
    footerTagline: `Ein Projekt der ${COMPANY.legalName}`,
    copyright: "© 2026 KernelMinds GbR",
  },

  home: {
    badge: `Version ${EXTENSION.version} · Chrome ${EXTENSION.minChrome}+ · Manifest V3`,
    h1Before: "Ein Tab. Ein eigener ",
    h1Accent: "Ausgang",
    h1After: ".",
    lead: "AudioRoute schickt den Ton eines einzelnen Chrome-Tabs auf Kopfhörer, Lautsprecher, HDMI, einen USB-DAC oder ein virtuelles Gerät. Windows, deine Spiele, dein Call und alle anderen Tabs bleiben bei ihrem Standardausgang.",
    ctaStore: "Im Chrome Web Store holen",
    ctaHow: "So funktioniert es",
    trust: ["Kein Konto", "Kein Backend", "Keine Telemetrie"],

    popup: {
      aria: "Das AudioRoute-Popup: der Tab „Konzert-Mitschnitt“ von youtube.com wird auf USB-Kopfhörer geroutet.",
      badge: "Routing",
      signalPath: "Signalweg",
      thisTabOnly: "Nur dieser Tab",
      sourceLabel: "Quelle",
      sourceTitle: "Konzert-Mitschnitt · 4K",
      sourceMeta: "youtube.com",
      audio: "Audio",
      targetLabel: "Ziel",
      targetTitle: "USB-Kopfhörer",
      targetMeta: "Zum Wechseln klicken",
      stop: "Routing beenden",
      note: "Läuft weiter, wenn du dieses Popup schließt.",
      local: "Lokal & privat",
      fullscreen: "Vollbild-tauglich",
    },

    band: {
      heading:
        "Windows lässt jede Anwendung ihren Ausgang wählen. Chrome schickt jeden Tab an denselben.",
      body: (
        <>
          AudioRoute ergänzt die fehlende Ebene: <strong className={STRONG}>Ausgabegerät pro Tab</strong>{" "}
          — ohne den Windows-Standardausgang anzufassen und ohne dass ein zweites Programm im
          Hintergrund mitläuft.
        </>
      ),
    },

    features: {
      eyebrow: "Funktionen",
      title: "Sechs Dinge, die es gut macht",
      items: [
        {
          title: "Kontrolle pro Tab",
          body: "Umgeleitet wird nur der Tab, den du ausgewählt hast. Der Rest von Chrome und Windows bleibt unberührt.",
        },
        {
          title: "Geführte Einrichtung",
          body: "Gerät wählen — fertig. Braucht Chrome eine Freigabe, öffnet sich ein eigenes Setup-Fenster, in dem der Dialog sichtbar und klickbar bleibt.",
        },
        {
          title: "Standardmäßig lokal",
          body: "Kein Konto, kein Backend, keine Analyse, keine Aufzeichnung, kein Upload, kein Zugriff auf den Browserverlauf.",
        },
        {
          title: "Umschalten im Betrieb",
          body: "Eine laufende Route wandert per Klick zwischen Kopfhörern, Lautsprechern, HDMI, USB und virtuellen Ausgängen.",
        },
        {
          title: "Läuft ohne Popup weiter",
          body: "Schließe das Popup, wann du willst. Die Route läuft im Hintergrund weiter, bis du sie beendest.",
        },
        {
          title: "Vollbild funktioniert",
          body: "Eine kleine mitgelieferte Brücke hilft gängigen Playern beim Sprung ins native Vollbild — YouTube-typische Bedienelemente, Video.js, Shaka Player, Plyr.",
        },
      ],
    },

    how: {
      eyebrow: "So funktioniert es",
      title: "In drei Klicks umgeleitet",
      steps: [
        {
          title: "Ton abspielen",
          body: "Starte Video, Musik oder Stream in dem Chrome-Tab, den du umleiten willst.",
        },
        {
          title: "AudioRoute öffnen",
          body: "Symbolleiste, AudioRoute, Ausgabegerät wählen. Liegt die Geräteberechtigung schon vor, bleibt die Auswahl im Popup.",
        },
        {
          title: "Routing starten",
          body: "Der Ton wechselt auf das gewählte Gerät und bleibt dort — auch nachdem du das Popup geschlossen hast.",
        },
      ],
      flowLabel: "Was technisch passiert",
      flow: [
        { label: "Schritt 1", title: "Aktiver Chrome-Tab" },
        { label: "Schritt 2", title: "Lokaler Tab-Audiostream" },
        { label: "Schritt 3", title: "Offscreen-AudioContext" },
        { label: "Ziel", title: "Gewähltes Ausgabegerät" },
      ],
      flowBody:
        "Der Service-Worker holt eine Stream-ID für den aktiven Tab. Ein verstecktes Erweiterungsdokument nimmt diesen Stream entgegen, baut einen Web-Audio-Kontext und wählt darüber deinen Ausgang. Alles bleibt in Chromes lokaler Medien-Pipeline — der Ton verlässt dein Gerät nie.",
    },

    permissions: {
      eyebrow: "Berechtigungen",
      title: "Fünf Berechtigungen, jede mit einem Grund",
      colName: "Berechtigung",
      colWhy: "Wofür AudioRoute sie braucht",
      items: [
        { name: "activeTab", why: "Erkennt kurzzeitig den Tab, aus dem heraus du AudioRoute geöffnet hast." },
        { name: "tabCapture", why: "Erzeugt nach deiner ausdrücklichen Aktion den lokalen Audiostream dieses Tabs." },
        { name: "offscreen", why: "Hält den Web-Audio-Kontext am Leben, nachdem sich das Popup geschlossen hat." },
        { name: "scripting", why: "Fügt genau diesem Tab die mitgelieferte Vollbild-Brücke hinzu." },
        { name: "storage", why: "Merkt sich den gewählten Ausgang und setzt eine unterbrochene Geräte-Einrichtung fort." },
      ],
      footnote: (
        <>
          Keine Host-Berechtigung wie <span className="font-mono">&lt;all_urls&gt;</span>, kein
          dauerhafter Zugriff auf Webseiten, kein Remote-Code.
        </>
      ),
      micNote:
        "Ein Sonderfall: Stellt Chrome die native Ausgabegeräte-Auswahl nicht bereit, fragt AudioRoute einmalig die Medienberechtigung ab — allein, um die Namen der verfügbaren Ausgänge anzeigen zu können. Der dabei entstehende Mikrofonstream wird sofort gestoppt und niemals aufgezeichnet, gespeichert oder übertragen.",
    },

    privacy: {
      heading: "AudioRoute hat kein Backend und stellt keine Netzwerkanfragen.",
      lead: "Dein Ton verlässt dein Gerät nicht. Dauerhaft gespeichert wird nur eines: das zuletzt gewählte Ausgabegerät — lokal in Chrome, auf deinem Rechner.",
      cta: "Datenschutzerklärung lesen",
      promises: [
        "Kein Konto, keine Anmeldung",
        "Keine Analyse, keine Telemetrie",
        "Keine Werbung, kein Tracking",
        "Keine Cloud-Verarbeitung",
        "Keine Aufzeichnung, kein Transkript",
        "Kein Zugriff auf den Browserverlauf",
        "Kein Remote-Code",
      ],
    },

    limits: {
      eyebrow: "Ehrliche Grenzen",
      title: "Was AudioRoute nicht kann",
      items: [
        "Routing gilt pro Tab. Für jeden weiteren Tab startest du eine eigene Route.",
        "Chrome-Systemseiten und der Web Store lassen sich nicht erfassen.",
        "Chrome zeigt während einer aktiven Route seinen üblichen Aufnahme-Hinweis.",
        "Bluetooth, HDMI und virtuelle Geräte bringen Latenz aus Treiber und Betriebssystem mit.",
        "Wird das aktive Gerät getrennt, endet die Route sauber statt still weiterzulaufen.",
        <>
          Ungewöhnliche eingebettete Player brauchen für Vollbild weiterhin{" "}
          <span className="font-mono text-ink">F11</span>.
        </>,
      ],
    },

    final: {
      heading: "Der richtige Tab. Der richtige Ausgang.",
      body: "Nichts verlässt deinen Rechner. Kostenlos, ohne Konto, ohne Hintergrundprogramm.",
      cta: "Im Chrome Web Store holen",
      requirement: `Benötigt Google Chrome ${EXTENSION.minChrome} oder neuer auf dem Desktop.`,
    },
  },

  impressum: {
    eyebrow: "Rechtliches",
    h1: "Impressum",
    lead: "Angaben gemäß Digitale-Dienste-Gesetz (DDG)",
    blocks: [
      {
        num: "§ 1",
        title: "Angaben gemäß § 5 DDG",
        body: (
          <p className={P}>
            {COMPANY.legalName}
            <br />
            {COMPANY.street}
            <br />
            {COMPANY.city}
          </p>
        ),
      },
      {
        num: "§ 2",
        title: "Vertreten durch",
        body: (
          <p className={P}>
            {COMPANY.partners[0]}
            <br />
            {COMPANY.partners[1]}
            <br />
            Vertretungsberechtigte Gesellschafter
          </p>
        ),
      },
      {
        num: "§ 2a",
        title: "Umsatzsteuer-Identifikationsnummer",
        body: (
          <p className="font-mono text-[15px] leading-[1.68] tracking-[.04em] text-ink">
            {COMPANY.vatId}
          </p>
        ),
      },
      {
        num: "§ 3",
        title: "Kontakt",
        body: (
          <>
            <p className={P}>
              Tel.{" "}
              <a href={COMPANY.phoneHref} className={LINK}>
                {COMPANY.phone}
              </a>
            </p>
            <p className={P}>
              E-Mail{" "}
              <a href={COMPANY.emailHref} className={LINK}>
                {COMPANY.email}
              </a>
            </p>
          </>
        ),
      },
      {
        num: "§ 4",
        title: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
        body: (
          <p className={P}>
            {COMPANY.partners[0]}
            <br />
            {COMPANY.legalName}
            <br />
            {COMPANY.street}, {COMPANY.city}
          </p>
        ),
      },
      {
        num: "§ 5",
        title: "Streitschlichtung",
        body: (
          <p className={P}>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        ),
      },
      {
        num: "§ 6",
        title: "Zur Erweiterung",
        body: (
          <p className={P}>
            {EXTENSION.name} ist eine Chrome-Erweiterung der {COMPANY.legalName}. Google Chrome und
            der Chrome Web Store sind Marken der Google LLC; zwischen der {COMPANY.legalName} und
            Google besteht keine Verbindung.
          </p>
        ),
      },
    ],
  },

  datenschutz: {
    eyebrow: "Rechtliches",
    h1: "Datenschutzerklärung",
    lead: `Für die Chrome-Erweiterung ${EXTENSION.name} und für diese Website. Stand: September 2026.`,
    tocTitle: "Inhalt",
    translationNote: null as ReactNode,
    toc: [
      "Verantwortlicher",
      "Kurzfassung",
      "Geltungsbereich",
      "Daten in der Erweiterung",
      "Tab-Audio",
      "Einmaliger Mikrofonzugriff",
      "Berechtigungen",
      "Diese Website",
      "Chrome Web Store",
      "Empfänger und Drittländer",
      "Ihre Rechte",
      "Beschwerderecht",
      "Änderungen",
    ],
    summaryLead:
      "Die Erweiterung AudioRoute besitzt kein Backend, stellt keine Netzwerkanfragen und überträgt keine Daten an uns oder an Dritte.",
    storage: {
      colEntry: "Eintrag",
      colPurpose: "Inhalt und Zweck",
      colDuration: "Dauer",
      rows: [
        {
          purpose:
            "Kennung und Anzeigename des von Ihnen gewählten Ausgabegeräts, damit AudioRoute Ihre Auswahl beim nächsten Öffnen kennt.",
          retention:
            "Bis Sie die Auswahl ändern, die Daten in Chrome löschen oder die Erweiterung deinstallieren.",
        },
        {
          purpose:
            "Merkt sich eine begonnene Geräteauswahl, damit die Einrichtung nach Chromes Berechtigungsdialog fortgesetzt werden kann.",
          retention: "Nur für die laufende Browser-Sitzung; beim Beenden von Chrome verworfen.",
        },
      ],
    },
    permissions: [
      { name: "activeTab", why: "Erkennt kurzzeitig den Tab, aus dem heraus Sie AudioRoute geöffnet haben." },
      { name: "tabCapture", why: "Erzeugt nach Ihrer ausdrücklichen Aktion den lokalen Audiostream dieses Tabs." },
      { name: "offscreen", why: "Hält den Web-Audio-Kontext am Leben, nachdem sich das Popup geschlossen hat." },
      { name: "scripting", why: "Fügt genau diesem Tab die mitgelieferte Vollbild-Brücke hinzu." },
      { name: "storage", why: "Speichert die beiden unter Abschnitt 4 genannten Einträge lokal." },
    ],
    rights: [
      "Auskunft nach Art. 15 DSGVO",
      "Berichtigung nach Art. 16 DSGVO",
      "Löschung nach Art. 17 DSGVO",
      "Einschränkung nach Art. 18 DSGVO",
      "Datenübertragbarkeit nach Art. 20 DSGVO",
      "Widerspruch nach Art. 21 DSGVO",
    ],
    titles: [
      "Verantwortlicher",
      "Kurzfassung",
      "Geltungsbereich",
      "Daten, die die Erweiterung auf Ihrem Gerät speichert",
      "Tab-Audio und Umleitung",
      "Einmaliger Mikrofonzugriff zur Geräteermittlung",
      "Berechtigungen der Erweiterung",
      "Diese Website",
      "Installation über den Chrome Web Store",
      "Empfänger und Übermittlung in Drittländer",
      "Ihre Rechte",
      "Beschwerderecht bei der Aufsichtsbehörde",
      "Änderungen dieser Erklärung",
    ],
    s1: (
      <>
        <p className={P}>Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist:</p>
        <p className={P}>
          {COMPANY.legalName}
          <br />
          {COMPANY.street}
          <br />
          {COMPANY.city}
          <br />
          Deutschland
        </p>
        <p className={P}>
          Vertreten durch {COMPANY.partners[0]} und {COMPANY.partners[1]}.
          <br />
          Telefon:{" "}
          <a href={COMPANY.phoneHref} className={LINK}>
            {COMPANY.phone}
          </a>
          <br />
          E-Mail:{" "}
          <a href={COMPANY.emailHref} className={LINK}>
            {COMPANY.email}
          </a>
        </p>
        <p className={P}>
          Eine Pflicht zur Benennung eines Datenschutzbeauftragten besteht nicht. Anfragen zum
          Datenschutz richten Sie bitte an die oben genannte E-Mail-Adresse.
        </p>
      </>
    ),
    s2: (
      <p className={P}>
        Der Ton bleibt vollständig in der lokalen Medien-Pipeline von Chrome auf Ihrem Gerät. Es
        findet keine Aufzeichnung, keine Analyse, kein Tracking und keine Profilbildung statt.
        Gespeichert wird ausschließlich auf Ihrem Gerät — und ausschließlich, was die Geräteauswahl
        betrifft (Abschnitt 4).
      </p>
    ),
    s3: (
      <p className={P}>
        Diese Erklärung gilt für die Chrome-Erweiterung{" "}
        <strong className={STRONG}>{EXTENSION.storeName}</strong> sowie für diese Website. Sie gilt
        nicht für Websites, deren Ton Sie mit {EXTENSION.name} umleiten: Für deren Inhalte und
        Datenverarbeitung sind allein die jeweiligen Anbieter verantwortlich.
      </p>
    ),
    s4Intro: (
      <p className={P}>
        {EXTENSION.name} legt über die Chrome-Speicher-API genau zwei Einträge an. Beide verbleiben
        ausschließlich auf Ihrem Gerät beziehungsweise in Ihrem Chrome-Profil und werden nicht an
        uns übertragen.
      </p>
    ),
    s4Outro: (
      <>
        <p className={P}>
          Das Speichern und Auslesen dieser Informationen auf Ihrem Endgerät ist unbedingt
          erforderlich, damit die von Ihnen ausdrücklich gewünschte Funktion bereitgestellt werden
          kann (§ 25 Abs. 2 Nr. 2 TDDDG). Eine Einwilligung ist dafür nicht erforderlich. Da die
          Angaben Ihr Gerät nicht verlassen, verarbeiten wir insoweit keine personenbezogenen Daten.
        </p>
        <p className={P}>
          Sie können beide Einträge jederzeit löschen, indem Sie die Erweiterung in{" "}
          <span className={MONO}>chrome://extensions</span> entfernen.
        </p>
      </>
    ),
    s5: (
      <>
        <p className={P}>
          Wenn Sie das Routing für einen Tab starten, fordert {EXTENSION.name} über{" "}
          <span className={MONO}>chrome.tabCapture</span> einen lokalen Audiostream dieses Tabs an.
          Ein verstecktes Erweiterungsdokument nimmt den Stream entgegen, erzeugt einen
          Web-Audio-Kontext und wählt darüber Ihr Ausgabegerät.
        </p>
        <p className={P}>
          Der Audiostream wird{" "}
          <strong className={STRONG}>
            nicht aufgezeichnet, nicht analysiert, nicht gespeichert, nicht hochgeladen und nicht
            übertragen
          </strong>
          . Er existiert nur im Arbeitsspeicher Ihres Browsers und endet, sobald Sie das Routing
          beenden oder den Tab schließen — ebenso, wenn das gewählte Gerät getrennt wird. Der
          Vorgang startet ausschließlich nach einer ausdrücklichen Aktion von Ihnen; Chrome zeigt
          währenddessen seinen üblichen Hinweis auf eine aktive Tab-Erfassung.
        </p>
      </>
    ),
    s6: (
      <>
        <p className={P}>
          Chrome gibt die Namen der verfügbaren Audioausgänge in manchen Fällen erst frei, nachdem
          Zugriff auf Mediengeräte gewährt wurde. Steht die native Ausgabegeräte-Auswahl von Chrome
          nicht zur Verfügung, fordert {EXTENSION.name} deshalb einmalig die Medienberechtigung an —
          allein, um die Liste der Ausgabegeräte anzeigen zu können.
        </p>
        <p className={P}>
          Der dabei entstehende Mikrofonstream wird sofort wieder gestoppt. Er wird{" "}
          <strong className={STRONG}>
            niemals aufgezeichnet, mitgehört, wiedergegeben, gespeichert, hochgeladen oder
            übertragen
          </strong>
          . Sie können die Berechtigung jederzeit in den Chrome-Einstellungen widerrufen;{" "}
          {EXTENSION.name} zeigt dann nur noch die von Chrome ohne Berechtigung bereitgestellten
          Geräte an.
        </p>
      </>
    ),
    s7Outro: (
      <p className={P}>
        {EXTENSION.name} verlangt keine Host-Berechtigung wie{" "}
        <span className={MONO}>&lt;all_urls&gt;</span>, hat keinen Zugriff auf Ihren Browserverlauf,
        Ihre Lesezeichen oder Ihre Zugangsdaten und lädt keinen Code aus dem Netz nach.
      </p>
    ),
    s8: (placeholder: (text: string) => ReactNode) => (
      <>
        <h3 className={H3}>Hosting und Server-Logfiles</h3>
        <p className={P}>
          Diese Website wird bei {placeholder("[HOSTING-ANBIETER, vollständige Firma und Anschrift]")}{" "}
          gehostet. Beim Aufruf einer Seite verarbeitet der Server automatisch technische
          Zugriffsdaten: IP-Adresse des anfragenden Geräts, Datum und Uhrzeit des Zugriffs,
          aufgerufene Adresse, übertragene Datenmenge, Statuscode, Referrer sowie Browser- und
          Betriebssystemkennung.
        </p>
        <p className={P}>
          Zweck ist die technische Auslieferung, die Stabilität und die Sicherheit der Website.
          Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und störungsfreien
          Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Die Logfiles werden nach {placeholder("[X]")} Tagen
          gelöscht. Mit dem Hoster besteht ein Vertrag über die Auftragsverarbeitung nach Art. 28
          DSGVO.
        </p>
        <h3 className={H3}>Keine Cookies, keine Analyse, keine externen Einbindungen</h3>
        <p className={P}>
          Diese Website setzt keine Cookies, verwendet keine Analyse-, Werbe- oder Tracking-Dienste
          und bindet keine Inhalte von Drittanbietern ein. Schriftarten werden vom eigenen Server
          ausgeliefert; eine Verbindung zu Google Fonts oder einem anderen externen Dienst wird
          nicht aufgebaut. Ein Cookie-Banner ist daher nicht erforderlich.
        </p>
        <h3 className={H3}>Sprachauswahl</h3>
        <p className={P}>
          Wenn Sie oben im Kopfbereich die Sprache wechseln, speichert die Website Ihre Auswahl im{" "}
          <span className={MONO}>localStorage</span> Ihres Browsers, damit die automatische
          Spracherkennung Sie nicht erneut umleitet. Dieser Eintrag enthält ausschließlich das
          Kürzel <span className={MONO}>de</span> oder <span className={MONO}>en</span>, verlässt
          Ihr Gerät nicht und lässt keine Rückschlüsse auf Ihre Person zu. Rechtsgrundlage für die
          Speicherung auf Ihrem Endgerät ist § 25 Abs. 2 Nr. 2 TDDDG.
        </p>
        <h3 className={H3}>Kontaktaufnahme per E-Mail</h3>
        <p className={P}>
          Wenn Sie uns schreiben, verarbeiten wir Ihre E-Mail-Adresse und den Inhalt Ihrer
          Nachricht, um die Anfrage zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
          bei vertragsbezogenen Anfragen, sonst Art. 6 Abs. 1 lit. f DSGVO. Wir löschen die
          Korrespondenz, sobald sie nicht mehr benötigt wird und keine gesetzlichen
          Aufbewahrungspflichten entgegenstehen.
        </p>
      </>
    ),
    s9: (
      <p className={P}>
        {EXTENSION.name} wird über den Chrome Web Store verteilt. Installation, Aktualisierung und
        die dortige Store-Seite werden von der Google Ireland Limited beziehungsweise der Google LLC
        betrieben; dabei verarbeitet Google eigenverantwortlich Daten, auf die wir keinen Einfluss
        haben. Wir erhalten von Google lediglich aggregierte, nicht personenbezogene Kennzahlen zur
        Verbreitung. Einzelheiten entnehmen Sie der Datenschutzerklärung von Google:{" "}
        <a href="https://policies.google.com/privacy" className={LINK}>
          policies.google.com/privacy
        </a>
      </p>
    ),
    s10: (
      <>
        <p className={P}>
          Aus der Erweiterung heraus werden keine Daten an Empfänger übermittelt — weder an uns noch
          an Dritte, weder innerhalb noch außerhalb der EU. Für die Website beschränken sich
          Empfänger auf den unter Abschnitt 8 genannten Hoster als Auftragsverarbeiter. Eine
          Übermittlung in Drittländer findet nicht statt.
        </p>
        <p className={P}>
          Eine automatisierte Entscheidungsfindung einschließlich Profiling nach Art. 22 DSGVO
          findet nicht statt.
        </p>
      </>
    ),
    s11Intro: (
      <p className={P}>
        Soweit wir personenbezogene Daten von Ihnen verarbeiten, stehen Ihnen die folgenden Rechte
        zu:
      </p>
    ),
    s11Outro: (
      <p className={P}>
        Zur Ausübung genügt eine formlose Nachricht an{" "}
        <a href={COMPANY.emailHref} className={LINK}>
          {COMPANY.email}
        </a>
        . Beruht eine Verarbeitung auf Ihrer Einwilligung, können Sie diese jederzeit mit Wirkung
        für die Zukunft widerrufen.
      </p>
    ),
    s12: (
      <>
        <p className={P}>
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Für uns
          zuständig ist:
        </p>
        <p className={P}>
          Der Hessische Beauftragte für Datenschutz und Informationsfreiheit
          <br />
          Postfach 3163
          <br />
          65021 Wiesbaden
          <br />
          <a href="https://datenschutz.hessen.de" className={LINK}>
            datenschutz.hessen.de
          </a>
        </p>
      </>
    ),
    s13: (
      <>
        <p className={P}>
          Wir passen diese Datenschutzerklärung an, wenn sich die Erweiterung, die Website oder die
          Rechtslage ändern. Es gilt jeweils die auf dieser Seite veröffentlichte Fassung.
        </p>
        <p className="text-base leading-[1.68] text-ink-dim">
          Stand: September 2026 · {EXTENSION.name} Version {EXTENSION.version}
        </p>
      </>
    ),
    todo: {
      heading: "Vor der Veröffentlichung zu erledigen:",
      items: [
        "Hosting-Anbieter mit vollständiger Anschrift und Löschfrist der Server-Logfiles eintragen (Abschnitt 8, oben orange markiert).",
        "Diesen Kasten entfernen.",
      ],
    },
  },
};

export type Content = typeof de;
