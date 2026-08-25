# AudioRoute

### Route one Chrome tab to any audio output

AudioRoute is a local Manifest V3 Chrome extension that sends the audio from the active tab to a different speaker, headset, HDMI output, USB DAC, or virtual audio device — without changing the Windows default output.

<p>
  <img src="https://img.shields.io/badge/Chrome-116%2B-4285F4?logo=googlechrome&logoColor=white" alt="Chrome 116 or newer" />
  <img src="https://img.shields.io/badge/Manifest-V3-167C5A" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Privacy-local--only-5EE8AE?labelColor=10201A&color=5EE8AE" alt="Local only" />
</p>

AudioRoute is designed for focused, per-tab routing. Pick a destination in the existing popup and routing starts immediately. Close the popup and the route keeps running.

## Highlights

- **Per-tab audio routing** — redirect only the active tab, not the entire browser.
- **Immediate start** — selecting an output device starts routing automatically.
- **Inline device picker** — no extra setup window or popout.
- **Persistent route** — audio keeps playing after the popup closes.
- **Live output switching** — change the destination while routing is active.
- **Fullscreen-aware handoff** — detected fullscreen controls briefly pause capture while the page enters fullscreen, then resume the same route.
- **Local-first privacy** — no server, analytics, cloud upload, or browsing history access.
- **Device resilience** — a disconnected output stops safely instead of leaving the tab silent.

## How it works

```text
Active Chrome tab
        │
        │  chrome.tabCapture
        ▼
Offscreen audio context
        │
        │  AudioContext.setSinkId()
        ▼
Selected speaker / headset / HDMI / virtual device
```

The service worker obtains a stream ID for the selected tab. An offscreen document consumes that stream, creates an `AudioContext`, selects the requested sink, and keeps playback alive after the popup closes.

## Install locally

1. Open `chrome://extensions` in desktop Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Pin **AudioRoute** from the Extensions menu.

Chrome 116 or newer is required. No build step or package installation is needed for the extension itself.

## Use AudioRoute

1. Open a tab that is playing audio, such as YouTube, Spotify Web, or a meeting app.
2. Click the AudioRoute toolbar icon.
3. Click **Choose an output device**.
4. Approve the one-time device-list permission if Chrome asks for it.
5. Select a destination. Routing starts immediately.

To change the destination, click the current output device while routing is active. To stop routing, reopen AudioRoute for the same tab and click **Stop routing**.

## Why Chrome may ask for microphone access

Some Chrome versions expose the complete output-device list only after media permission. When the native speaker picker is unavailable, AudioRoute requests microphone permission only to unlock that list. The temporary microphone stream is stopped immediately; it is never recorded, played, stored, uploaded, or transmitted.

If Chrome closes the popup during the first permission prompt, reopen AudioRoute. The pending selection is resumed automatically inside the same popup. If permission is blocked, the popup keeps the specific error visible and offers Chrome's microphone settings.

## Fullscreen behavior

Chromium currently has a self-capture fullscreen limitation: a page that is being captured may reject a DOM `requestFullscreen()` call, while browser-level F11 still works. AudioRoute injects a small, temporary bridge into the user-invoked tab. When it recognizes a common fullscreen control, it pauses capture before the click completes and resumes the route after fullscreen changes.

Most common players are covered, including YouTube-style, Video.js, Shaka, Plyr, and accessible `aria-label`/title controls. Unusual embedded players may still require F11.

## Technical boundaries

- Routing is **per tab**. Start a separate route for each tab you want to redirect.
- Chrome system pages (`chrome://…`), the Chrome Web Store, and other protected pages cannot be captured.
- Bluetooth and virtual devices may add latency imposed by the operating system or driver.
- Chrome displays its normal tab-capture indicator while a route is active.
- The extension requires a desktop Chrome with `AudioContext.setSinkId()` support.
- AudioRoute does not change the Windows system default output.

## Permissions

| Permission | Why it is used |
| --- | --- |
| `activeTab` | Grants temporary access to the tab whose toolbar action the user invoked. |
| `tabCapture` | Creates the active tab's audio stream after the user action. |
| `offscreen` | Keeps the audio context alive after the popup closes. |
| `scripting` | Injects the temporary fullscreen handoff bridge into the invoked tab. |
| `storage` | Stores the selected output device locally and resumes interrupted setup. |

There are no broad host permissions and no persistent website access request.

## Development

```powershell
npm run verify
```

`npm run verify` checks the Manifest V3 structure, required assets, JavaScript syntax, popup IDs, and the pure utility test suite. It does not start Chrome or play audio.

Regenerate the extension icons with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1
```

## Project layout

```text
manifest.json            Extension metadata and permissions
service-worker.js        Tab capture, routing state, fullscreen handoff
popup/                   Popup UI and inline device picker
offscreen/               Persistent AudioContext and sink selection
content/                 Temporary fullscreen bridge
shared/                  Message types and error/device helpers
tests/                   Node-based utility tests
scripts/                 Validation and local inspection helpers
```

## Privacy

AudioRoute is local-only. It has no backend, telemetry, analytics, account system, network request, transcript, recording store, or cloud integration. Audio is passed through Chrome's local media pipeline only long enough to play it through the selected output device.

## License

No license has been selected for this project yet. Add a license file before distributing AudioRoute publicly.
