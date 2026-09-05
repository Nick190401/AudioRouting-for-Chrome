<div align="center">

<img src="docs/assets/audioroute-hero.png" alt="AudioRoute — Put Chrome audio where it belongs" width="100%" />

# AudioRoute

### Your browser. Your outputs. Your mix.

Route a tab to headphones, speakers, HDMI, a USB DAC, or a virtual device — while every other app keeps using the Windows default output.

<p>
  <img src="https://img.shields.io/badge/Chrome-116%2B-4285F4?logo=googlechrome&logoColor=white" alt="Chrome 116 or newer" />
  <img src="https://img.shields.io/badge/Manifest-V3-156B50" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Privacy-local--only-57E3A7?labelColor=0B1A15" alt="Local-only privacy" />
  <img src="https://img.shields.io/badge/Telemetry-none-57E3A7?labelColor=0B1A15" alt="No telemetry" />
</p>

<p>
  <a href="#install-locally"><strong>Install locally</strong></a>
  ·
  <a href="#how-it-works"><strong>How it works</strong></a>
  ·
  <a href="#privacy-by-design"><strong>Privacy</strong></a>
  ·
  <a href="#development"><strong>Development</strong></a>
</p>

</div>

---

## Your browser has more than one destination

Windows lets applications choose an audio output. Chrome usually sends every tab to the same one. AudioRoute adds the missing layer: **output selection per active tab**.

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>🎯 Per-tab control</strong><br><br>
      Redirect only the tab you choose. The rest of Chrome and Windows stay untouched.
    </td>
    <td width="33%" valign="top">
      <strong>⚡ Guided routing</strong><br><br>
      Pick a device. If Chrome needs permission, approve it in the focused setup window; otherwise selection stays inline.
    </td>
    <td width="33%" valign="top">
      <strong>🔒 Local by default</strong><br><br>
      No account, backend, analytics, recording, upload, or browsing-history access.
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <strong>🎧 Two devices at once</strong><br><br>
      Play one tab through headphones <em>and</em> speakers, each with its own volume and a delay to line them up.
    </td>
    <td width="33%" valign="top">
      <strong>🪟 Popup-free playback</strong><br><br>
      Close the popup whenever you want. The route continues in the background.
    </td>
    <td width="33%" valign="top">
      <strong>⛶ Fullscreen aware</strong><br><br>
      A small compatibility bridge helps common video players enter native fullscreen.
    </td>
  </tr>
</table>

## See the route at a glance

<img src="docs/assets/audioroute-routing.png" alt="AudioRoute popup showing a Chrome tab routed to USB headphones" width="100%" />

The signal-path interface keeps the important state visible: **source tab → selected destination → live routing status**. Changing the destination is always one click away.

## AudioRoute Studio

Choose **Open Studio** in the toolbar popup to keep a live mixer beside your websites.
Every connected tab has its own outputs, measured audio levels, volume, mute, solo, and sound settings.
The popup and Studio control the same audio engine; playback continues when either closes.

- **Sound scenes:** save your current arrangement as Work, Movie Night, or any name you choose.
  Scenes remember exact website hostnames, user channel labels, devices, delays, processing and priority settings locally.
  Recall shows missing devices and asks you to assign a tab when several connected tabs use the same website.
  Individual failures are reported without discarding channels that applied successfully.
- **Smart Focus:** select a priority channel and enable Smart Focus. When that tab produces sound,
  the other connected channels fade to 20% of their chosen volume and return after a short pause.
  This detects sound energy, including music and notifications; it does not recognize speech or access your microphone.
- **Your controls stay yours:** mute and solo take precedence, and automatic attenuation never changes your sliders.
  Smart Focus starts disabled. Solo and boosts above 100% are session-only; scenes restore at most 100%.

Save up to 20 scenes with six channels and six outputs in total. Each tab supports two outputs.
New sources must be connected from the AudioRoute toolbar on each tab. A scene cannot start capture,
open saved websites, or resume capture automatically after Chrome restarts. Reconnect the desired tabs, then recall the scene.

## Start routing in seconds

1. Play audio in a Chrome tab.
2. Open **AudioRoute** from the toolbar.
3. Select an output device. If Chrome asks for permission, finish the focused setup window, return to the source tab, reopen **AudioRoute**, and choose **Start routing**. With existing permission, routing starts from the inline picker.
4. Playback survives closing the popup.

To switch outputs, click the current destination. To restore normal playback, reopen AudioRoute on the routed tab and choose **Stop routing**.

> [!TIP]
> AudioRoute never changes the Windows default output. Your games, calls, music apps, and other Chrome tabs keep their existing destination.

## How it works

```mermaid
flowchart LR
    A[Active Chrome tab] -->|chrome.tabCapture| B[Local tab audio stream]
    B --> C[Offscreen AudioContext]
    C -->|setSinkId| D[Selected output device]

    style A fill:#10251e,stroke:#57e3a7,color:#effff8
    style B fill:#10251e,stroke:#2d8061,color:#effff8
    style C fill:#10251e,stroke:#2d8061,color:#effff8
    style D fill:#123a2c,stroke:#57e3a7,color:#effff8
```

When you invoke AudioRoute, its service worker obtains an audio stream ID for the active tab. A hidden extension document consumes that stream, creates a Web Audio context, and selects your requested output with `AudioContext.setSinkId()`. Everything stays inside Chrome's local media pipeline.

## Install locally

AudioRoute runs directly from the repository—no compilation step is required.

1. Download or clone this repository.
2. Open `chrome://extensions` in desktop Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository folder containing `manifest.json`.
6. Pin **AudioRoute** from Chrome's Extensions menu.

**Requirement:** Google Chrome 116 or newer on desktop.

## A note about device access

Chrome does not expose the complete list of audio outputs in every context until media-device access has been granted. When permission is still pending or blocked, AudioRoute opens device setup in its own focused window, outside the toolbar popup, so Chrome's permission prompt remains fully visible and clickable. Once access is available, the normal output picker stays inside the toolbar popup. If the native speaker picker is unavailable, AudioRoute requests one-time media permission only to reveal the available output-device names.

The temporary microphone stream is stopped immediately. It is **never recorded, monitored, played, stored, uploaded, or transmitted**.

## Fullscreen compatibility

Chromium may reject a page-level `requestFullscreen()` while that same tab is being captured, even though browser-level <kbd>F11</kbd> still works. AudioRoute handles this by injecting a small bundled bridge only into the user-invoked tab. It recognizes common fullscreen controls, briefly suspends capture before the transition, and restores the same route afterward.

Built-in support covers common YouTube-style controls, Video.js, Shaka Player, Plyr, and accessible fullscreen buttons identified through labels or titles. Unusual embedded players can still require <kbd>F11</kbd>.

## Night mode and voice clarity

Two optional switches per tab, both off by default:

- **Night mode** evens out loud and quiet passages so late-night dialogue stays audible without
  the next explosion waking the house. It costs a fixed **6 ms of latency** while active — far
  below the threshold where lip sync becomes noticeable, but not free, which is why the popup
  says so and why the compressor is removed from the graph rather than flattened when you turn
  it off. Measured on Chromium: with night mode off the chain is bit-identical to a direct
  connection.
- **Voice clarity** lifts speech around 2 kHz by 6 dB. It adds no latency.

## Privacy by design

> [!IMPORTANT]
> AudioRoute has no backend and makes no network requests. Audio never leaves your device.

- No account or sign-in
- No analytics or telemetry
- No advertising or tracking
- No cloud processing
- No audio recording or transcript
- No browsing-history permission
- No broad host permissions such as `<all_urls>`
- No remote code

Persistent preferences are the locally selected output-device identifier and label, the processing switches (mono, balance, night mode, voice clarity), and scenes you explicitly save. Normal routes start at 100%; saved scene volumes are limited to 100% so an old boost cannot surprise you on recall.

While a route is running, AudioRoute keeps its title and hostname in memory for the mixer. Saved scenes retain only the hostname and your chosen channel label, never captured page titles or full URLs. Navigation invalidates the saved-site assignment until you reconnect the tab. AudioRoute does not request the `tabs` or browsing-history permissions.

Temporary session storage resumes interrupted device selection and fullscreen transitions. Device setup can temporarily hold the source tab's display title; fullscreen recovery stores routing settings without page titles or full URLs. Recovery entries are removed on completion/stop and disappear when Chrome exits.

Studio's meters and Smart Focus calculate sound levels locally. Only transient numeric peak/RMS values pass between extension components; audio samples and measured levels are never written to storage or sent over the network. Delete scenes individually in Studio or remove the extension to erase its local preferences.

## Permissions, without the mystery

| Permission | Why AudioRoute needs it |
| :--- | :--- |
| `activeTab` | Temporarily identifies the tab from which the user opened AudioRoute. |
| `tabCapture` | Creates the selected tab's local audio stream after an explicit user action. |
| `offscreen` | Keeps the Web Audio context alive after the extension popup closes. |
| `scripting` | Injects the bundled fullscreen compatibility bridge into that active tab. |
| `storage` | Saves local preferences/scenes and resumes interrupted setup/fullscreen transitions. |
| `sidePanel` | Keeps Studio's live mixer visible alongside your websites. |

Every permission directly supports the extension's single purpose. There is no persistent access to websites.

## Technical boundaries

- Routing is per tab, and a tab can play on two devices at once. AudioRoute stops at six
  concurrent outputs, because every output needs its own audio context — three tabs on two
  devices each is the ceiling.
- Two devices rarely run in step. The per-output delay lines them up; without it the same
  audio on speakers and headphones sounds like a comb filter.
- Chrome system pages, the Chrome Web Store, and other protected pages cannot be captured.
- Chrome shows its normal tab-capture indicator while routing is active.
- Bluetooth, HDMI, and virtual devices can add latency at the operating-system or driver level.
- Disconnecting the active device stops the route safely instead of leaving the tab silently captured.
- AudioRoute requires `AudioContext.setSinkId()` and therefore a current desktop version of Chrome.

## Development

Run the complete non-audio verification suite:

```powershell
npm run verify
```

This validates the Manifest V3 package, required assets, JavaScript syntax, popup structure, and utility tests. It neither opens an audio route nor plays a test sound.

The suite also exercises scene privacy/validation, concurrency limits, hardware-failure recovery, Smart Focus, sender authorization, and Studio interactions. For actual Chrome/audio verification, use `node scripts/test-studio.mjs <debug-port> <extension-id>` in a **dedicated test profile** with the unpacked extension installed. It plays quiet synthetic tones, uses available physical outputs, and writes its report and narrow/wide screenshots under `artifacts/studio/`. It does not prove acoustic loudness or latency at the speaker hardware.

Build the publishable Chrome Web Store package:

```powershell
npm run build:release
```

The build verifies the project, increments the patch version in `manifest.json` and `package.json`, and writes `release/AudioRoute-v<version>.zip` with `manifest.json` at the archive root. Tests, development scripts, screenshots, and other non-runtime files are excluded automatically. A SHA-256 checksum is printed after every successful build.

<details>
<summary><strong>Project structure</strong></summary>

```text
AudioRoute/
├── manifest.json          Extension metadata and permissions
├── service-worker.js      Capture lifecycle and routing coordination
├── popup/                 Compact signal-path and route controls
├── studio/                Persistent mixer and sound scenes
├── worker/                Local scene management and recall
├── setup/                 Visible permission and output-selection flow
├── offscreen/             Persistent AudioContext and sink selection
├── content/               Temporary fullscreen compatibility bridge
├── shared/                Messages, errors, and device helpers
├── icons/                 Extension icons for Chrome
├── tests/                 Node-based utility tests
├── scripts/               Validation, inspection, and release tooling
└── docs/assets/           GitHub README visuals
```

</details>

<details>
<summary><strong>Regenerate extension icons</strong></summary>

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1
```

</details>

## Built for a simple promise

> **The right tab. The right output. Nothing leaves your machine.**

AudioRoute focuses on doing one thing well: giving a Chrome tab its own audio destination without turning a small routing task into a system-wide configuration exercise.

## License

This repository currently has no license file. Unless a license is added, standard copyright rules apply.
