import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");

// The exact list the release ZIP is built from, shared with build-release.ps1 so
// a file can never be shipped by one and forgotten by the other.
const requiredFiles = JSON.parse(
  readFileSync(resolve(workspace, "scripts/package-files.json"), "utf8"),
);

const failures = [];
if (requiredFiles.length === 0) failures.push("scripts/package-files.json is empty.");
for (const file of requiredFiles) {
  if (!existsSync(resolve(workspace, file))) failures.push(`Missing: ${file}`);
}

// A new source file nobody adds to that list ships as a silently broken ZIP: the
// release check rejects unexpected entries but never notices missing ones. So the
// extension tree is enumerated here and anything unclassified fails the build.
const DEVELOPMENT_DIRECTORIES = new Set([
  "artifacts",
  "dist",
  "dist-ssr",
  "docs",
  "node_modules",
  "release",
  "scripts",
  "store-assets",
  "tests",
  "website",
]);

// In the tree, deliberately out of the ZIP.
const UNPACKAGED_FILES = new Set([
  "README.md",
  "package.json",
  "package-lock.json",
  "icons/icon-source.svg", // vector source for scripts/generate-icons.ps1
]);

// Only what Chrome could load as an extension resource, so notes and scratch
// files next to the code do not fail the build.
const RESOURCE_PATTERN = /\.(css|html|js|json|mjs|png|svg|wasm|woff2)$/;

function collectExtensionFiles(directory = workspace) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const absolute = resolve(directory, entry.name);
    const relativePath = relative(workspace, absolute).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if (!DEVELOPMENT_DIRECTORIES.has(relativePath)) found.push(...collectExtensionFiles(absolute));
    } else if (RESOURCE_PATTERN.test(entry.name)) {
      found.push(relativePath);
    }
  }
  return found;
}

const packagedFiles = new Set(requiredFiles);
for (const file of collectExtensionFiles()) {
  if (packagedFiles.has(file) || UNPACKAGED_FILES.has(file)) continue;
  failures.push(
    `${file} is in the extension tree but not in scripts/package-files.json. Add it there ` +
      "to ship it, or to UNPACKAGED_FILES in this script if it must stay out of the ZIP.",
  );
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
  for (const permission of ["activeTab", "offscreen", "scripting", "storage", "tabCapture", "sidePanel"]) {
    if (!manifest.permissions?.includes(permission)) failures.push(`Manifest permission missing: ${permission}`);
  }
  if (manifest.host_permissions?.length) failures.push("AudioRoute must not request broad host permissions.");
  if (manifest.side_panel?.default_path !== "studio/studio.html") failures.push("The Studio side panel entrypoint is missing.");
  const allowedPermissions = new Set(["activeTab", "offscreen", "scripting", "storage", "tabCapture", "sidePanel"]);
  if (manifest.permissions?.some((permission) => !allowedPermissions.has(permission))) {
    failures.push("AudioRoute requests a permission outside its local routing purpose.");
  }
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
  "mix-summary",
  "volume-slider",
  "volume-value",
  "balance-slider",
  "balance-value",
  "mono-toggle",
  "boost-warning",
  "other-routes-list",
  "tab-route",
  "tab-mix",
  "tab-tabs",
  "panel-route",
  "panel-mix",
  "panel-tabs",
  "mix-body",
  "mix-empty",
  "mix-dot",
  "tabs-count",
  "tabs-empty",
  "night-toggle",
  "night-warning",
  "voice-toggle",
  "second-output-node",
  "second-device-name",
  "second-device-hint",
  "remove-second-output",
  "add-output",
  "second-mix",
  "second-volume-slider",
  "second-volume-value",
  "delay-slider",
  "delay-value",
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
if (!popupJavascript.includes("getMicrophonePermissionState")) {
  failures.push("The toolbar popup must check microphone permission before choosing its device-selection surface.");
}
if (popupJavascript.includes('"speaker-selection"')) {
  failures.push("The toolbar popup must not mistake speaker-selection permission for microphone device-list access.");
}
// Every operation lives in three switch statements at once. Adding one and
// forgetting a hop is silent at runtime, so assert both ends are wired.
const workerJavascript = readFileSync(resolve(workspace, "service-worker.js"), "utf8");
const offscreenJavascript = readFileSync(resolve(workspace, "offscreen/offscreen.js"), "utf8");
for (const type of ["LIST_ROUTES", "UPDATE_ROUTE", "ADD_SINK", "REMOVE_SINK", "UPDATE_SINK"]) {
  if (!workerJavascript.includes(`MESSAGE_TYPE.${type}`)) {
    failures.push(`The service worker does not handle MESSAGE_TYPE.${type}.`);
  }
}
for (const type of [
  "OFFSCREEN_LIST_ROUTES",
  "OFFSCREEN_UPDATE_ROUTE",
  "OFFSCREEN_ADD_SINK",
  "OFFSCREEN_REMOVE_SINK",
  "OFFSCREEN_UPDATE_SINK",
]) {
  if (!offscreenJavascript.includes(`MESSAGE_TYPE.${type}`)) {
    failures.push(`The offscreen document does not handle MESSAGE_TYPE.${type}.`);
  }
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

const javascriptFiles = [...new Set([
  ...requiredFiles.filter((file) => /\.(m?js)$/.test(file)),
  "service-worker.js",
  "shared/utils.js",
  "popup/popup.js",
  "setup/setup.js",
  "content/fullscreen-bridge.js",
  "offscreen/offscreen.js",
  "offscreen/audio-chain.js",
  "scripts/cdp-command.mjs",
  "scripts/inspect-extension.mjs",
  "scripts/inspect-worker.mjs",
  "scripts/load-unpacked.mjs",
  "scripts/test-inline-device-picker.mjs",
  "scripts/test-full-routing-flow.mjs",
  "scripts/validate.mjs",
  "tests/utils.test.mjs",
])];

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
