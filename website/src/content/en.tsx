import { COMPANY, EXTENSION } from "../i18n";
import { H3, LINK, MONO, P, STRONG } from "../components/prose";
import type { Content } from "./de";

export const en: Content = {
  htmlLang: "en",
  localeName: "English",
  otherLocaleName: "Deutsch",
  switchAria: "Auf Deutsch wechseln",

  meta: {
    index: {
      title: "AudioRoute — One Chrome tab, its own audio output",
      description:
        "AudioRoute sends a single Chrome tab's audio to headphones, speakers, HDMI or a virtual device. No account, no backend, no telemetry.",
    },
    impressum: {
      title: "Legal notice — AudioRoute",
      description: "Legal notice for KernelMinds GbR, publisher of the AudioRoute Chrome extension.",
    },
    datenschutz: {
      title: "Privacy policy — AudioRoute",
      description:
        "Privacy policy for the AudioRoute Chrome extension and this website. No backend, no network requests, no telemetry.",
    },
  },

  common: {
    eyebrow: "Chrome Audio Router",
    skipLink: "Skip to content",
    installShort: "Install for free",
    backHome: "Home",
    navAria: "Main navigation",
    footerAria: "Footer",
    nav: {
      features: "Features",
      how: "How it works",
      permissions: "Permissions",
      privacy: "Privacy",
      imprint: "Legal notice",
      contact: "Contact",
    },
    footerTagline: `A project by ${COMPANY.legalName}`,
    copyright: "© 2026 KernelMinds GbR",
  },

  home: {
    badge: `Version ${EXTENSION.version} · Chrome ${EXTENSION.minChrome}+ · Manifest V3`,
    h1Before: "One tab. Its own ",
    h1Accent: "output",
    h1After: ".",
    lead: "AudioRoute sends a single Chrome tab's audio to headphones, speakers, HDMI, a USB DAC or a virtual device. Windows, your games, your call and every other tab stay on their default output.",
    ctaStore: "Get it on the Chrome Web Store",
    ctaHow: "How it works",
    trust: ["No account", "No backend", "No telemetry"],

    popup: {
      aria: "The AudioRoute popup: the tab “Live concert recording” from youtube.com is routed to USB headphones.",
      badge: "Routing",
      signalPath: "Signal path",
      thisTabOnly: "This tab only",
      sourceLabel: "Source",
      sourceTitle: "Live concert recording · 4K",
      sourceMeta: "youtube.com",
      audio: "Audio",
      targetLabel: "Destination",
      targetTitle: "USB headphones",
      targetMeta: "Click to switch",
      stop: "Stop routing",
      note: "Keeps running when you close this popup.",
      local: "Local & private",
      fullscreen: "Fullscreen ready",
    },

    band: {
      heading: "Windows lets every application pick its output. Chrome sends every tab to the same one.",
      body: (
        <>
          AudioRoute adds the missing layer: <strong className={STRONG}>an output device per tab</strong>{" "}
          — without touching the Windows default output and without a second program running in the
          background.
        </>
      ),
    },

    features: {
      eyebrow: "Features",
      title: "Six things it does well",
      items: [
        {
          title: "Per-tab control",
          body: "Only the tab you picked is redirected. The rest of Chrome and Windows stays untouched.",
        },
        {
          title: "Guided setup",
          body: "Pick a device — done. If Chrome needs permission, a dedicated setup window opens where the prompt stays visible and clickable.",
        },
        {
          title: "Local by default",
          body: "No account, no backend, no analytics, no recording, no upload, no access to your browsing history.",
        },
        {
          title: "Switch while playing",
          body: "Move a live route between headphones, speakers, HDMI, USB and virtual outputs with one click.",
        },
        {
          title: "Runs without the popup",
          body: "Close the popup whenever you like. The route keeps running in the background until you stop it.",
        },
        {
          title: "Fullscreen works",
          body: "A small bundled bridge helps common players enter native fullscreen — YouTube-style controls, Video.js, Shaka Player, Plyr.",
        },
      ],
    },

    how: {
      eyebrow: "How it works",
      title: "Redirected in three clicks",
      steps: [
        {
          title: "Play audio",
          body: "Start a video, track or stream in the Chrome tab you want to redirect.",
        },
        {
          title: "Open AudioRoute",
          body: "Toolbar, AudioRoute, pick an output device. If device permission is already granted, the picker stays inside the popup.",
        },
        {
          title: "Start routing",
          body: "The audio moves to the selected device and stays there — even after you close the popup.",
        },
      ],
      flowLabel: "What happens technically",
      flow: [
        { label: "Step 1", title: "Active Chrome tab" },
        { label: "Step 2", title: "Local tab audio stream" },
        { label: "Step 3", title: "Offscreen AudioContext" },
        { label: "Destination", title: "Selected output device" },
      ],
      flowBody:
        "The service worker obtains a stream ID for the active tab. A hidden extension document consumes that stream, creates a Web Audio context and selects your output through it. Everything stays inside Chrome's local media pipeline — the audio never leaves your device.",
    },

    permissions: {
      eyebrow: "Permissions",
      title: "Five permissions, each with a reason",
      colName: "Permission",
      colWhy: "Why AudioRoute needs it",
      items: [
        { name: "activeTab", why: "Briefly identifies the tab you opened AudioRoute from." },
        { name: "tabCapture", why: "Creates that tab's local audio stream after an explicit action by you." },
        { name: "offscreen", why: "Keeps the Web Audio context alive after the popup closes." },
        { name: "scripting", why: "Injects the bundled fullscreen bridge into exactly that tab." },
        { name: "storage", why: "Remembers the selected output and resumes an interrupted device setup." },
      ],
      footnote: (
        <>
          No host permission such as <span className="font-mono">&lt;all_urls&gt;</span>, no
          persistent access to websites, no remote code.
        </>
      ),
      micNote:
        "One special case: if Chrome does not offer its native output picker, AudioRoute requests media permission once — solely to display the names of the available outputs. The microphone stream this creates is stopped immediately and is never recorded, stored or transmitted.",
    },

    privacy: {
      heading: "AudioRoute has no backend and makes no network requests.",
      lead: "Your audio never leaves your device. Exactly one thing is stored permanently: the output device you picked last — locally in Chrome, on your machine.",
      cta: "Read the privacy policy",
      promises: [
        "No account, no sign-in",
        "No analytics, no telemetry",
        "No advertising, no tracking",
        "No cloud processing",
        "No recording, no transcript",
        "No access to browsing history",
        "No remote code",
      ],
    },

    limits: {
      eyebrow: "Honest limits",
      title: "What AudioRoute cannot do",
      items: [
        "Routing is per tab. Start a separate route for every additional tab.",
        "Chrome system pages and the Web Store cannot be captured.",
        "Chrome shows its usual capture indicator while a route is active.",
        "Bluetooth, HDMI and virtual devices add latency from the driver and the operating system.",
        "If the active device is disconnected, the route ends cleanly instead of running on silently.",
        <>
          Unusual embedded players still need <span className="font-mono text-ink">F11</span> for
          fullscreen.
        </>,
      ],
    },

    final: {
      heading: "The right tab. The right output.",
      body: "Nothing leaves your machine. Free, no account, no background program.",
      cta: "Get it on the Chrome Web Store",
      requirement: `Requires Google Chrome ${EXTENSION.minChrome} or newer on desktop.`,
    },
  },

  impressum: {
    eyebrow: "Legal",
    h1: "Legal notice",
    lead: "Information pursuant to the German Digital Services Act (DDG)",
    blocks: [
      {
        num: "§ 1",
        title: "Information pursuant to § 5 DDG",
        body: (
          <p className={P}>
            {COMPANY.legalName}
            <br />
            {COMPANY.street}
            <br />
            {COMPANY.city}
            <br />
            Germany
          </p>
        ),
      },
      {
        num: "§ 2",
        title: "Represented by",
        body: (
          <p className={P}>
            {COMPANY.partners[0]}
            <br />
            {COMPANY.partners[1]}
            <br />
            Authorised partners
          </p>
        ),
      },
      {
        num: "§ 2a",
        title: "VAT identification number",
        body: (
          <p className="font-mono text-[15px] leading-[1.68] tracking-[.04em] text-ink">
            {COMPANY.vatId}
          </p>
        ),
      },
      {
        num: "§ 3",
        title: "Contact",
        body: (
          <>
            <p className={P}>
              Phone{" "}
              <a href={COMPANY.phoneHref} className={LINK}>
                {COMPANY.phone}
              </a>
            </p>
            <p className={P}>
              Email{" "}
              <a href={COMPANY.emailHref} className={LINK}>
                {COMPANY.email}
              </a>
            </p>
          </>
        ),
      },
      {
        num: "§ 4",
        title: "Responsible for content pursuant to § 18 (2) MStV",
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
        title: "Dispute resolution",
        body: (
          <p className={P}>
            We are neither willing nor obliged to take part in dispute resolution proceedings before
            a consumer arbitration board.
          </p>
        ),
      },
      {
        num: "§ 6",
        title: "About the extension",
        body: (
          <p className={P}>
            {EXTENSION.name} is a Chrome extension by {COMPANY.legalName}. Google Chrome and the
            Chrome Web Store are trademarks of Google LLC; there is no affiliation between{" "}
            {COMPANY.legalName} and Google.
          </p>
        ),
      },
    ],
  },

  datenschutz: {
    eyebrow: "Legal",
    h1: "Privacy policy",
    lead: `For the ${EXTENSION.name} Chrome extension and for this website. Last updated: September 2026.`,
    tocTitle: "Contents",
    translationNote: (
      <p className={P}>
        This is a convenience translation. In case of doubt, the{" "}
        <a href="/datenschutz.html" className={LINK}>
          German version
        </a>{" "}
        prevails.
      </p>
    ),
    toc: [
      "Controller",
      "In short",
      "Scope",
      "Data in the extension",
      "Tab audio",
      "One-time microphone access",
      "Permissions",
      "This website",
      "Chrome Web Store",
      "Recipients and third countries",
      "Your rights",
      "Right to complain",
      "Changes",
    ],
    summaryLead:
      "The AudioRoute extension has no backend, makes no network requests and transmits no data to us or to third parties.",
    storage: {
      colEntry: "Entry",
      colPurpose: "Content and purpose",
      colDuration: "Retention",
      rows: [
        {
          purpose:
            "Identifier and display name of the output device you selected, so AudioRoute knows your choice the next time you open it.",
          retention:
            "Until you change the selection, clear the data in Chrome or uninstall the extension.",
        },
        {
          purpose:
            "Remembers a device selection in progress so setup can continue after Chrome's permission prompt.",
          retention: "For the current browser session only; discarded when Chrome quits.",
        },
      ],
    },
    permissions: [
      { name: "activeTab", why: "Briefly identifies the tab you opened AudioRoute from." },
      { name: "tabCapture", why: "Creates that tab's local audio stream after an explicit action by you." },
      { name: "offscreen", why: "Keeps the Web Audio context alive after the popup closes." },
      { name: "scripting", why: "Injects the bundled fullscreen bridge into exactly that tab." },
      { name: "storage", why: "Stores the two entries listed in section 4 locally." },
    ],
    rights: [
      "Access under Art. 15 GDPR",
      "Rectification under Art. 16 GDPR",
      "Erasure under Art. 17 GDPR",
      "Restriction under Art. 18 GDPR",
      "Data portability under Art. 20 GDPR",
      "Objection under Art. 21 GDPR",
    ],
    titles: [
      "Controller",
      "In short",
      "Scope",
      "Data the extension stores on your device",
      "Tab audio and routing",
      "One-time microphone access for device discovery",
      "Permissions of the extension",
      "This website",
      "Installation via the Chrome Web Store",
      "Recipients and transfers to third countries",
      "Your rights",
      "Right to complain to a supervisory authority",
      "Changes to this policy",
    ],
    s1: (
      <>
        <p className={P}>The controller for data processing within the meaning of the GDPR is:</p>
        <p className={P}>
          {COMPANY.legalName}
          <br />
          {COMPANY.street}
          <br />
          {COMPANY.city}
          <br />
          Germany
        </p>
        <p className={P}>
          Represented by {COMPANY.partners[0]} and {COMPANY.partners[1]}.
          <br />
          Phone:{" "}
          <a href={COMPANY.phoneHref} className={LINK}>
            {COMPANY.phone}
          </a>
          <br />
          Email:{" "}
          <a href={COMPANY.emailHref} className={LINK}>
            {COMPANY.email}
          </a>
        </p>
        <p className={P}>
          There is no obligation to appoint a data protection officer. Please direct privacy
          enquiries to the email address above.
        </p>
      </>
    ),
    s2: (
      <p className={P}>
        The audio stays entirely inside Chrome's local media pipeline on your device. There is no
        recording, no analysis, no tracking and no profiling. Storage happens exclusively on your
        device — and exclusively for the device selection (section 4).
      </p>
    ),
    s3: (
      <p className={P}>
        This policy covers the Chrome extension{" "}
        <strong className={STRONG}>{EXTENSION.storeName}</strong> and this website. It does not
        cover websites whose audio you redirect with {EXTENSION.name}: their providers alone are
        responsible for their content and data processing.
      </p>
    ),
    s4Intro: (
      <p className={P}>
        {EXTENSION.name} creates exactly two entries through the Chrome storage API. Both stay
        exclusively on your device or in your Chrome profile and are not transmitted to us.
      </p>
    ),
    s4Outro: (
      <>
        <p className={P}>
          Storing and reading this information on your terminal equipment is strictly necessary to
          provide the function you explicitly requested (§ 25 (2) no. 2 TDDDG). No consent is
          required for it. Since the entries never leave your device, we do not process any personal
          data in this respect.
        </p>
        <p className={P}>
          You can delete both entries at any time by removing the extension in{" "}
          <span className={MONO}>chrome://extensions</span>.
        </p>
      </>
    ),
    s5: (
      <>
        <p className={P}>
          When you start routing for a tab, {EXTENSION.name} requests a local audio stream of that
          tab via <span className={MONO}>chrome.tabCapture</span>. A hidden extension document
          consumes the stream, creates a Web Audio context and selects your output device through
          it.
        </p>
        <p className={P}>
          The audio stream is{" "}
          <strong className={STRONG}>
            not recorded, not analysed, not stored, not uploaded and not transmitted
          </strong>
          . It exists only in your browser's memory and ends as soon as you stop routing or close
          the tab — and likewise if the selected device is disconnected. The process only starts
          after an explicit action by you; Chrome shows its usual active tab capture indicator
          throughout.
        </p>
      </>
    ),
    s6: (
      <>
        <p className={P}>
          In some cases Chrome only reveals the names of the available audio outputs after access to
          media devices has been granted. If Chrome's native output picker is unavailable,{" "}
          {EXTENSION.name} therefore requests media permission once — solely in order to display the
          list of output devices.
        </p>
        <p className={P}>
          The microphone stream this creates is stopped again immediately. It is{" "}
          <strong className={STRONG}>
            never recorded, monitored, played back, stored, uploaded or transmitted
          </strong>
          . You can revoke the permission at any time in Chrome's settings; {EXTENSION.name} will
          then only show the devices Chrome provides without permission.
        </p>
      </>
    ),
    s7Outro: (
      <p className={P}>
        {EXTENSION.name} requests no host permission such as{" "}
        <span className={MONO}>&lt;all_urls&gt;</span>, has no access to your browsing history, your
        bookmarks or your credentials, and loads no code from the network.
      </p>
    ),
    s8: (placeholder) => (
      <>
        <h3 className={H3}>Hosting and server log files</h3>
        <p className={P}>
          This website is hosted by {placeholder("[HOSTING PROVIDER, full company name and address]")}.
          When a page is requested, the server automatically processes technical access data: IP
          address of the requesting device, date and time of the request, the address requested,
          amount of data transferred, status code, referrer as well as browser and operating system
          identifiers.
        </p>
        <p className={P}>
          The purpose is technical delivery, stability and security of the website. The legal basis
          is our legitimate interest in secure and trouble-free operation (Art. 6 (1) (f) GDPR). Log
          files are deleted after {placeholder("[X]")} days. A data processing agreement pursuant to
          Art. 28 GDPR is in place with the host.
        </p>
        <h3 className={H3}>No cookies, no analytics, no external embeds</h3>
        <p className={P}>
          This website sets no cookies, uses no analytics, advertising or tracking services and
          embeds no third-party content. Fonts are served from our own server; no connection to
          Google Fonts or any other external service is made. A cookie banner is therefore not
          required.
        </p>
        <h3 className={H3}>Language selection</h3>
        <p className={P}>
          If you switch the language in the header, the website stores your choice in your browser's{" "}
          <span className={MONO}>localStorage</span> so that automatic language detection does not
          redirect you again. That entry contains nothing but the code{" "}
          <span className={MONO}>de</span> or <span className={MONO}>en</span>, never leaves your
          device and permits no conclusions about you as a person. The legal basis for storing it on
          your terminal equipment is § 25 (2) no. 2 TDDDG.
        </p>
        <h3 className={H3}>Contact by email</h3>
        <p className={P}>
          If you write to us, we process your email address and the content of your message in order
          to answer your enquiry. The legal basis is Art. 6 (1) (b) GDPR for contract-related
          enquiries, otherwise Art. 6 (1) (f) GDPR. We delete the correspondence as soon as it is no
          longer needed and no statutory retention obligations apply.
        </p>
      </>
    ),
    s9: (
      <p className={P}>
        {EXTENSION.name} is distributed through the Chrome Web Store. Installation, updates and the
        store listing are operated by Google Ireland Limited or Google LLC; Google processes data as
        its own controller there, which we have no influence over. From Google we receive only
        aggregated, non-personal distribution figures. For details see Google's privacy policy:{" "}
        <a href="https://policies.google.com/privacy" className={LINK}>
          policies.google.com/privacy
        </a>
      </p>
    ),
    s10: (
      <>
        <p className={P}>
          No data is transmitted to any recipient from within the extension — neither to us nor to
          third parties, neither inside nor outside the EU. For the website, recipients are limited
          to the host named in section 8 acting as a processor. No transfer to third countries takes
          place.
        </p>
        <p className={P}>
          There is no automated decision-making, including profiling, within the meaning of Art. 22
          GDPR.
        </p>
      </>
    ),
    s11Intro: (
      <p className={P}>
        Insofar as we process personal data relating to you, you have the following rights:
      </p>
    ),
    s11Outro: (
      <p className={P}>
        An informal message to{" "}
        <a href={COMPANY.emailHref} className={LINK}>
          {COMPANY.email}
        </a>{" "}
        is enough to exercise them. Where processing is based on your consent, you may withdraw that
        consent at any time with effect for the future.
      </p>
    ),
    s12: (
      <>
        <p className={P}>
          You have the right to lodge a complaint with a data protection supervisory authority. The
          authority responsible for us is:
        </p>
        <p className={P}>
          Der Hessische Beauftragte für Datenschutz und Informationsfreiheit
          <br />
          Postfach 3163
          <br />
          65021 Wiesbaden, Germany
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
          We update this privacy policy when the extension, the website or the legal situation
          changes. The version published on this page applies in each case.
        </p>
        <p className="text-base leading-[1.68] text-ink-dim">
          Last updated: September 2026 · {EXTENSION.name} version {EXTENSION.version}
        </p>
      </>
    ),
    todo: {
      heading: "To do before going live:",
      items: [
        "Enter the hosting provider with its full address and the retention period for server log files (section 8, marked orange above).",
        "Remove this box.",
      ],
    },
  },
};
