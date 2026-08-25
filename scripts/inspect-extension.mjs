import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [port = "9333", extensionId, output = "artifacts/popup.png", pagePath = "popup/popup.html"] = process.argv.slice(2);
if (!extensionId) {
  console.error("Usage: node scripts/inspect-extension.mjs <port> <extension-id> [screenshot]");
  process.exit(1);
}

const popupUrl = `chrome-extension://${extensionId}/${pagePath}`;
const isPopup = pagePath === "popup/popup.html";
const targetResponse = await fetch(
  `http://127.0.0.1:${port}/json/new?${encodeURIComponent(popupUrl)}`,
  { method: "PUT" },
);
if (!targetResponse.ok) throw new Error(`Chrome target could not be opened: ${targetResponse.status}`);
const target = await targetResponse.json();

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let commandId = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve: resolveCommand, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolveCommand(message.result);
  }

  if (message.method === "Runtime.exceptionThrown") {
    exceptions.push(message.params.exceptionDetails?.text || "Unknown runtime exception");
  }
});

await new Promise((resolveSocket, rejectSocket) => {
  socket.addEventListener("open", resolveSocket, { once: true });
  socket.addEventListener("error", rejectSocket, { once: true });
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCommand, reject) => {
    pending.set(id, { resolve: resolveCommand, reject });
  });
}

await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", {
  width: isPopup ? 388 : 440,
  height: isPopup ? 548 : 640,
  deviceScaleFactor: 1,
  mobile: false,
});
await command("Page.navigate", { url: popupUrl });
await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));

const capabilityResult = await command("Runtime.evaluate", {
  expression: `({
    readyState: document.readyState,
    selectAudioOutput: typeof navigator.mediaDevices?.selectAudioOutput,
    enumerateDevices: typeof navigator.mediaDevices?.enumerateDevices,
    audioContextSetSinkId: typeof AudioContext.prototype.setSinkId
  })`,
  returnByValue: true,
});

if (isPopup) {
  await command("Runtime.evaluate", {
    expression: `(() => {
    document.querySelector('#tab-title').textContent = 'Live-Konzert – Studio Session';
    document.querySelector('#tab-host').textContent = 'music.example';
    document.querySelector('#audio-state').dataset.audible = 'true';
    document.querySelector('#device-name').textContent = 'Headphones (USB Audio DAC)';
    document.querySelector('#device-hint').textContent = 'Click to switch the live destination';
    document.querySelector('#output-node').dataset.selected = 'true';
    document.querySelector('#signal-path').dataset.active = 'true';
    document.querySelector('#route-badge').dataset.state = 'active';
    document.querySelector('#route-badge-label').textContent = 'Active';
    const button = document.querySelector('#route-button');
    button.disabled = false;
    button.dataset.mode = 'stop';
    document.querySelector('#route-button-label').textContent = 'Stop routing';
    document.querySelector('#persistence-note').textContent = 'Audio is now playing through Headphones (USB Audio DAC).';
    document.querySelector('#notice').hidden = true;
    return true;
  })()`,
    returnByValue: true,
  });
}

await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
const screenshot = await command("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  captureBeyondViewport: false,
});

const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));

console.log(JSON.stringify({
  popupUrl,
  capabilities: capabilityResult.result.value,
  runtimeExceptions: exceptions,
  screenshot: outputPath,
}, null, 2));

socket.close();
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`, { method: "PUT" }).catch(() => {});
