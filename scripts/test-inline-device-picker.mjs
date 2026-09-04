import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { connectToBrowser } from "./cdp-command.mjs";

const [port = "9336", extensionId, output = "artifacts/device-setup-cft.png"] = process.argv.slice(2);
if (!extensionId) throw new Error("An extension ID is required.");

const extensionOrigin = `chrome-extension://${extensionId}`;
const setupUrl = `${extensionOrigin}/setup/setup.html`;
const sourceUrl = `https://example.com/?audioroute-device-setup=${Date.now()}`;
const sourceBrowser = await connectToBrowser(port);
const sourceTarget = await sourceBrowser.command("Target.createTarget", {
  url: sourceUrl,
  newWindow: false,
  forTab: true,
});
sourceBrowser.close();
await delay(500);

const setupTarget = await createTarget(setupUrl);
const setup = await connectToTarget(setupTarget.webSocketDebuggerUrl);
await setup.command("Runtime.enable");
await setup.command("Page.enable");
await setup.command("Emulation.setDeviceMetricsOverride", {
  width: 480,
  height: 680,
  deviceScaleFactor: 1,
  mobile: false,
});
await delay(500);

await setup.command("Runtime.evaluate", {
  expression: `(async () => {
    const current = await chrome.tabs.getCurrent();
    const source = (await chrome.tabs.query({})).find((tab) => tab.id !== current.id);
    if (!source) throw new Error('No source tab available for setup test.');
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    await chrome.storage.session.set({
      pendingOutputSelection: {
        tabId: source.id,
        windowId: source.windowId,
        action: 'change',
        tabTitle: 'AudioRoute setup test'
      }
    });
    location.reload();
  })()`,
  awaitPromise: true,
});
await delay(800);

let setupState = await readSetupState();
if (!setupState.permissionHidden && setupState.deviceCount === 0) {
  await setup.command("Runtime.evaluate", {
    expression: "document.querySelector('#permission-button').click()",
  });
  await delay(1400);
  setupState = await readSetupState();
}

const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await saveScreenshot(outputPath);

await setup.command("Runtime.evaluate", {
  expression: "document.querySelector('.device-option')?.click()",
});
await delay(700);

const result = await evaluateValue(`(async () => ({
  successVisible: !document.querySelector('#success-step').hidden,
  notice: document.querySelector('#notice').hidden ? '' : document.querySelector('#notice-text').textContent,
  storedDevice: (await chrome.storage.local.get('preferredOutputDevice')).preferredOutputDevice || null,
  pendingSelection: (await chrome.storage.session.get('pendingOutputSelection')).pendingOutputSelection || null
}))()`, true);
const selectedPath = outputPath.replace(/\.png$/i, "-selected.png");
await saveScreenshot(selectedPath);

setup.close();
await fetch(`http://127.0.0.1:${port}/json/close/${setupTarget.id}`, { method: "PUT" }).catch(() => {});
const inlinePicker = await verifyInlinePicker(sourceTarget.targetId);

console.log(JSON.stringify({
  setupState,
  result,
  inlinePicker,
  runtimeExceptions: setup.exceptions,
  screenshots: [outputPath, selectedPath],
}, null, 2));

if (
  setupState.deviceCount < 1 ||
  !result.successVisible ||
  result.notice ||
  !result.storedDevice?.deviceId ||
  result.pendingSelection ||
  inlinePicker.permission !== "granted" ||
  !inlinePicker.dialogOpen ||
  inlinePicker.listHidden ||
  inlinePicker.deviceCount < 1 ||
  inlinePicker.setupWindows !== 0 ||
  inlinePicker.runtimeExceptions.length ||
  setup.exceptions.length
) process.exitCode = 1;

async function createTarget(url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`Chrome target could not be opened: ${response.status}`);
  return response.json();
}

async function readSetupState() {
  return evaluateValue(`({
    permissionHidden: document.querySelector('#permission-step').hidden,
    devicesHidden: document.querySelector('#device-list-step').hidden,
    deviceCount: document.querySelectorAll('.device-option').length,
    notice: document.querySelector('#notice').hidden ? '' : document.querySelector('#notice-text').textContent
  })`);
}

async function evaluateValue(expression, awaitPromise = false) {
  return evaluateOn(setup, expression, awaitPromise);
}

async function evaluateOn(target, expression, awaitPromise = false) {
  const result = await target.command("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function saveScreenshot(path) {
  const screenshot = await setup.command("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path, Buffer.from(screenshot.data, "base64"));
}

async function verifyInlinePicker(sourceTargetId) {
  const browser = await connectToBrowser(port);
  let popup = null;
  let popupTarget = null;
  try {
    for (const target of await getTargets()) {
      if (target.url === `${extensionOrigin}/popup/popup.html`) {
        await browser.command("Target.closeTarget", { targetId: target.id });
      }
    }

    await browser.command("Extensions.triggerAction", {
      id: extensionId,
      targetId: sourceTargetId,
    });
    popupTarget = await waitForTarget(
      (target) => target.url === `${extensionOrigin}/popup/popup.html`,
      4000,
    );
    if (!popupTarget) throw new Error("The AudioRoute toolbar popup did not open.");

    popup = await connectToTarget(popupTarget.webSocketDebuggerUrl);
    await popup.command("Runtime.enable");
    await popup.command("Page.enable");
    await delay(800);
    await popup.command("Runtime.evaluate", {
      expression: "document.querySelector('#device-picker').click()",
    });
    await delay(500);

    const state = await evaluateOn(popup, `(async () => ({
      permission: (await navigator.permissions.query({ name: 'microphone' })).state,
      dialogOpen: document.querySelector('#device-dialog').open,
      listHidden: document.querySelector('#device-list-step').hidden,
      deviceCount: document.querySelectorAll('.device-option').length
    }))()`, true);
    return {
      ...state,
      setupWindows: (await getTargets()).filter((target) => target.url === setupUrl).length,
      runtimeExceptions: popup.exceptions,
    };
  } finally {
    popup?.close();
    if (popupTarget) {
      await fetch(`http://127.0.0.1:${port}/json/close/${popupTarget.id}`, { method: "PUT" }).catch(() => {});
    }
    browser.close();
  }
}

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

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
