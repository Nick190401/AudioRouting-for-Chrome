import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "manifest.json",
  "service-worker.js",
  "shared/utils.js",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "setup/setup.html",
  "setup/setup.css",
  "setup/setup.js",
  "content/fullscreen-bridge.js",
  "offscreen/offscreen.html",
  "offscreen/offscreen.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(resolve(workspace, file))) failures.push(`Missing: ${file}`);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(resolve(workspace, "manifest.json"), "utf8"));
} catch (error) {
  failures.push(`manifest.json is invalid: ${error.message}`);
}

if (manifest) {
  if (manifest.manifest_version !== 3) failures.push("manifest_version must be 3.");
  if (manifest.background?.service_worker !== "service-worker.js") {
    failures.push("The MV3 service worker is missing from the manifest.");
  }
  for (const permission of ["activeTab", "offscreen", "scripting", "storage", "tabCapture"]) {
    if (!manifest.permissions?.includes(permission)) failures.push(`Manifest permission missing: ${permission}`);
  }
  if (manifest.host_permissions?.length) failures.push("AudioRoute must not request broad host permissions.");
}

const popupHtml = readFileSync(resolve(workspace, "popup/popup.html"), "utf8");
for (const id of [
  "tab-title",
  "tab-host",
  "audio-state",
  "device-picker",
  "device-name",
  "device-hint",
  "output-node",
  "signal-path",
  "route-badge",
  "route-badge-label",
  "route-button",
  "route-button-label",
  "notice",
  "notice-text",
  "notice-close",
  "persistence-note",
  "device-dialog",
  "device-list-step",
  "device-list",
]) {
  if (!popupHtml.includes(`id="${id}"`)) failures.push(`Popup ID missing: ${id}`);
}

const popupJavascript = readFileSync(resolve(workspace, "popup/popup.js"), "utf8");
if (popupJavascript.includes("getUserMedia")) {
  failures.push("Microphone permission prompts must not originate from the toolbar popup.");
}
if (!popupJavascript.includes('chrome.runtime.getURL("setup/setup.html")')) {
  failures.push("The toolbar popup must hand device selection to the standalone setup window.");
}
if (!popupJavascript.includes("getOutputPermissionState")) {
  failures.push("The toolbar popup must check permission state before choosing its device-selection surface.");
}
const setupHtml = readFileSync(resolve(workspace, "setup/setup.html"), "utf8");
for (const id of [
  "source-title",
  "notice",
  "notice-text",
  "permission-step",
  "permission-button",
  "microphone-settings",
  "device-list-step",
  "device-list",
  "success-step",
  "success-kicker",
  "success-title",
  "success-copy",
  "return-button",
  "cancel-button",
]) {
  if (!setupHtml.includes(`id="${id}"`)) failures.push(`Setup ID missing: ${id}`);
}

const javascriptFiles = [
  "service-worker.js",
  "shared/utils.js",
  "popup/popup.js",
  "setup/setup.js",
  "content/fullscreen-bridge.js",
  "offscreen/offscreen.js",
  "scripts/cdp-command.mjs",
  "scripts/inspect-extension.mjs",
  "scripts/inspect-worker.mjs",
  "scripts/load-unpacked.mjs",
  "scripts/test-inline-device-picker.mjs",
  "scripts/test-full-routing-flow.mjs",
  "scripts/validate.mjs",
  "tests/utils.test.mjs",
];

for (const file of javascriptFiles) {
  if (!existsSync(resolve(workspace, file))) continue;
  const check = spawnSync(process.execPath, ["--check", resolve(workspace, file)], {
    encoding: "utf8",
  });
  if (check.status !== 0) failures.push(`${file}: ${check.stderr.trim()}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Manifest and ${javascriptFiles.length} JavaScript files are valid.`);
