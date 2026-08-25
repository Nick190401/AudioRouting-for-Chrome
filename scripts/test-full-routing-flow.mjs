import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { connectToBrowser } from "./cdp-command.mjs";

const [port = "9337", extensionId, output = "artifacts/full-route-active.png"] = process.argv.slice(2);
if (!extensionId) throw new Error("Eine Extension-ID ist erforderlich.");

const extensionOrigin = `chrome-extension://${extensionId}`;
const browser = await connectToBrowser(port);
for (const target of await getTargets()) {
  if (target.url === `${extensionOrigin}/popup/popup.html`) {
    await browser.command("Target.closeTarget", { targetId: target.id });
  }
}
const sourceUrl = `https://example.com/?audioroute-full-flow=${Date.now()}`;
const createdTab = await browser.command("Target.createTarget", {
  url: sourceUrl,
  newWindow: false,
  forTab: true,
});
await delay(700);
const sourceTarget = {
  id: createdTab.targetId,
  url: sourceUrl,
};
await browser.command("Target.activateTarget", { targetId: createdTab.targetId });
const sourcePageTarget = (await getTargets()).find((target) => target.url === sourceUrl);
if (!sourcePageTarget) throw new Error("The test tab page was not found.");
const sourcePage = await connectToTarget(sourcePageTarget.webSocketDebuggerUrl);
await sourcePage.command("Runtime.enable");
const sourceAudio = await evaluateValue(sourcePage, `(async () => {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0.001;
  oscillator.frequency.value = 440;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  await context.resume();
  globalThis.__audioRouteTestAudio = { context, oscillator };
  return { state: context.state, frequency: oscillator.frequency.value };
})()`, true);

await browser.command("Extensions.triggerAction", {
  id: extensionId,
  targetId: sourceTarget.id,
});
await delay(700);

const popupTarget = await waitForTarget(
  (target) => target.url === `${extensionOrigin}/popup/popup.html`,
  4000,
);
if (!popupTarget) throw new Error("The toolbar popup was not opened by Extensions.triggerAction.");

const popup = await connectToTarget(popupTarget.webSocketDebuggerUrl);
await popup.command("Runtime.enable");
await popup.command("Page.enable");
try {
  await popup.command("Emulation.setDeviceMetricsOverride", {
    width: 376,
    height: 506,
    deviceScaleFactor: 1,
    mobile: false,
  });
} catch {
  // Toolbar popups own their viewport and reject metric overrides.
}
await delay(700);
const activeTabState = await evaluateValue(popup, `(async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.runtime.sendMessage({
    target: 'audio-route-worker',
    type: 'get-active-tab'
  });
  return { queriedTab: tabs[0] || null, workerTab: response?.tab || null };
})()`, true);

await popup.command("Runtime.evaluate", {
  expression: `(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    location.reload();
  })()`,
  awaitPromise: true,
});
await delay(750);

await popup.command("Runtime.evaluate", {
  expression: "document.querySelector('#device-picker').click()",
});
await delay(650);
let picker = await evaluateValue(popup, `({
  permissionHidden: document.querySelector('#permission-step').hidden,
  deviceCount: document.querySelectorAll('.device-option').length
})`);
if (!picker.permissionHidden && picker.deviceCount === 0) {
  await popup.command("Runtime.evaluate", {
    expression: "document.querySelector('#permission-button').click()",
  });
  await delay(1400);
}

picker = await evaluateValue(popup, `({
  dialogOpen: document.querySelector('#device-dialog').open,
  deviceCount: document.querySelectorAll('.device-option').length,
  permissionError: document.querySelector('#permission-error').textContent,
  devicesError: document.querySelector('#dialog-error').textContent
})`);
if (picker.deviceCount < 1) throw new Error(`No test outputs visible: ${JSON.stringify(picker)}`);

await popup.command("Runtime.evaluate", {
  expression: "document.querySelector('.device-option').click()",
});
await delay(600);
const selectionState = await evaluateValue(popup, `(async () => {
  const stored = (await chrome.storage.local.get('preferredOutputDevice')).preferredOutputDevice || null;
  if (!stored) return { stored, sinkProbe: null };
  const context = new AudioContext();
  try {
    await context.setSinkId(stored.deviceId);
    return { stored, sinkProbe: { ok: true, sinkId: context.sinkId } };
  } catch (error) {
    return { stored, sinkProbe: { ok: false, name: error.name, message: error.message } };
  } finally {
    await context.close();
  }
})()`, true);
await popup.command("Runtime.evaluate", {
  expression: "document.querySelector('#route-button').click()",
});
await delay(1700);

const activeUi = await evaluateValue(popup, `({
  badge: document.querySelector('#route-badge-label').textContent,
  signalActive: document.querySelector('#signal-path').dataset.active,
  buttonLabel: document.querySelector('#route-button-label').textContent,
  notice: document.querySelector('#notice').hidden ? '' : document.querySelector('#notice-text').textContent,
  device: document.querySelector('#device-name').textContent
})`);
const activeTargets = await getTargets();
const offscreenTarget = activeTargets.find(
  (target) => target.url === `${extensionOrigin}/offscreen/offscreen.html`,
);
const workerTarget = activeTargets.find(
  (target) => target.url === `${extensionOrigin}/service-worker.js`,
);
if (!workerTarget) throw new Error("AudioRoute service worker is not active.");

const worker = await connectToTarget(workerTarget.webSocketDebuggerUrl);
await worker.command("Runtime.enable");
let offscreenOutputs = [];
if (offscreenTarget) {
  const offscreen = await connectToTarget(offscreenTarget.webSocketDebuggerUrl);
  await offscreen.command("Runtime.enable");
  offscreenOutputs = await evaluateValue(
    offscreen,
    "navigator.mediaDevices.enumerateDevices().then(devices => devices.filter(device => device.kind === 'audiooutput').map(device => ({ deviceId: device.deviceId, label: device.label })))",
    true,
  );
  offscreen.close();
}
const capturedWhileActive = await evaluateValue(
  worker,
  "chrome.tabCapture.getCapturedTabs()",
  true,
);

const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await saveScreenshot(popup, outputPath);

await popup.command("Runtime.evaluate", {
  expression: "document.querySelector('#route-button').click()",
});
await delay(900);
const stoppedUi = await evaluateValue(popup, `({
  badge: document.querySelector('#route-badge-label').textContent,
  signalActive: document.querySelector('#signal-path').dataset.active,
  buttonLabel: document.querySelector('#route-button-label').textContent,
  notice: document.querySelector('#notice').hidden ? '' : document.querySelector('#notice-text').textContent
})`);
const capturedAfterStop = await evaluateValue(
  worker,
  "chrome.tabCapture.getCapturedTabs()",
  true,
);
const stoppedPath = outputPath.replace(/\.png$/i, "-stopped.png");
await saveScreenshot(popup, stoppedPath);

const result = {
  sourceTab: { id: sourceTarget.id, url: sourceTarget.url },
  sourceAudio,
  activeTabState,
  picker,
  selectionState,
  activeUi,
  offscreenOutputs,
  offscreenDocument: Boolean(offscreenTarget),
  capturedWhileActive,
  stoppedUi,
  capturedAfterStop,
  popupRuntimeExceptions: popup.exceptions,
  workerRuntimeExceptions: worker.exceptions,
  screenshots: [outputPath, stoppedPath],
};
console.log(JSON.stringify(result, null, 2));

if (
  activeUi.badge !== "Active" ||
  activeUi.signalActive !== "true" ||
  activeUi.buttonLabel !== "Stop routing" ||
  activeUi.notice ||
  !offscreenTarget ||
  !capturedWhileActive.some((capture) => capture.status === "active") ||
  stoppedUi.badge !== "Ready" ||
  stoppedUi.signalActive !== "false" ||
  stoppedUi.buttonLabel !== "Start routing" ||
  capturedAfterStop.some((capture) => capture.status === "active") ||
  popup.exceptions.length ||
  worker.exceptions.length
) process.exitCode = 1;

popup.close();
worker.close();
sourcePage.close();
browser.close();

async function getTargets() {
  return (await (await fetch(`http://127.0.0.1:${port}/json`)).json());
}

async function waitForTarget(predicate, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const target = (await getTargets()).find(predicate);
    if (target) return target;
    await delay(100);
  }
  return null;
}

function connectToTarget(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const exceptions = [];
  let commandId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
    }
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolveCommand, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolveCommand(message.result);
  });

  return new Promise((resolveConnection, rejectConnection) => {
    socket.addEventListener("open", () => {
      resolveConnection({
        exceptions,
        command(method, params = {}) {
          const id = ++commandId;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCommand, reject) => {
            pending.set(id, { resolve: resolveCommand, reject });
          });
        },
        close() {
          socket.close();
        },
      });
    }, { once: true });
    socket.addEventListener("error", rejectConnection, { once: true });
  });
}

async function evaluateValue(client, expression, awaitPromise = false) {
  const result = await client.command("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function saveScreenshot(client, path) {
  const screenshot = await client.command("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path, Buffer.from(screenshot.data, "base64"));
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
