import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [port = "9336", extensionId, output = "artifacts/inline-devices-cft.png"] = process.argv.slice(2);
if (!extensionId) throw new Error("Eine Extension-ID ist erforderlich.");

const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(popupUrl)}`, {
  method: "PUT",
});
const target = await response.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let commandId = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    exceptions.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolveSocket, rejectSocket) => {
  socket.addEventListener("open", resolveSocket, { once: true });
  socket.addEventListener("error", rejectSocket, { once: true });
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCommand, reject) => pending.set(id, { resolve: resolveCommand, reject }));
}

await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", {
  width: 376,
  height: 506,
  deviceScaleFactor: 1,
  mobile: false,
});
await command("Page.navigate", { url: popupUrl });
await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
await command("Runtime.evaluate", {
  expression: `(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    location.reload();
  })()`,
  awaitPromise: true,
});
await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
await command("Runtime.evaluate", {
  expression: "document.querySelector('#device-picker').click()",
});
await new Promise((resolveDelay) => setTimeout(resolveDelay, 650));

let pickerState = await readPickerState();
if (!pickerState.permissionHidden && pickerState.deviceCount === 0) {
  await command("Runtime.evaluate", {
    expression: "document.querySelector('#permission-button').click()",
  });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1400));
  pickerState = await readPickerState();
}

const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await saveScreenshot(outputPath);

await command("Runtime.evaluate", {
  expression: "document.querySelector('.device-option')?.click()",
});
await new Promise((resolveDelay) => setTimeout(resolveDelay, 650));
const selectionResult = await command("Runtime.evaluate", {
  expression: `(async () => ({
    dialogOpen: document.querySelector('#device-dialog').open,
    deviceName: document.querySelector('#device-name').textContent,
    storedDevice: (await chrome.storage.local.get('preferredOutputDevice')).preferredOutputDevice || null,
    pendingSelection: (await chrome.storage.session.get('pendingOutputSelection')).pendingOutputSelection || null
  }))()`,
  awaitPromise: true,
  returnByValue: true,
});
const selection = selectionResult.result.value;
const selectedPath = outputPath.replace(/\.png$/i, "-selected.png");
await saveScreenshot(selectedPath);

const allTargets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const setupWindowCount = allTargets.filter((item) => item.url.includes("/setup/setup.html")).length;

console.log(JSON.stringify({
  pickerState,
  selection,
  setupWindowCount,
  runtimeExceptions: exceptions,
  screenshots: [outputPath, selectedPath],
}, null, 2));

if (
  !pickerState.dialogOpen ||
  pickerState.devicesHidden ||
  pickerState.deviceCount < 1 ||
  selection.dialogOpen ||
  !selection.storedDevice?.deviceId ||
  selection.pendingSelection ||
  setupWindowCount !== 0 ||
  exceptions.length
) process.exitCode = 1;

socket.close();
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`, { method: "PUT" }).catch(() => {});

async function readPickerState() {
  const result = await command("Runtime.evaluate", {
    expression: `({
      dialogOpen: document.querySelector('#device-dialog').open,
      permissionHidden: document.querySelector('#permission-step').hidden,
      devicesHidden: document.querySelector('#device-list-step').hidden,
      deviceCount: document.querySelectorAll('.device-option').length,
      permissionError: document.querySelector('#permission-error').textContent,
      devicesError: document.querySelector('#dialog-error').textContent
    })`,
    returnByValue: true,
  });
  return result.result.value;
}

async function saveScreenshot(path) {
  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path, Buffer.from(screenshot.data, "base64"));
}
