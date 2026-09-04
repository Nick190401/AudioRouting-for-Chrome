import test from "node:test";
import assert from "node:assert/strict";

import {
  formatHost,
  getMeaningfulAudioOutputs,
  inactiveRouteState,
  isRestrictedUrl,
  normalizeDevice,
  normalizeError,
  normalizePendingOutputSelection,
} from "../shared/utils.js";

test("recognizes Chrome system pages and allows regular and local pages", () => {
  assert.equal(isRestrictedUrl("chrome://extensions"), true);
  assert.equal(isRestrictedUrl("chrome-extension://abc/popup.html"), true);
  assert.equal(isRestrictedUrl("https://example.com/watch"), false);
  assert.equal(isRestrictedUrl("file:///D:/audio/test.html"), false);
});

test("formats the active tab origin compactly", () => {
  assert.equal(formatHost("https://www.youtube.com/watch?v=1"), "youtube.com");
  assert.equal(formatHost("file:///D:/audio/test.html"), "Local file");
  assert.equal(formatHost("not-a-url"), "Unknown page");
});

test("normalizes stored audio devices", () => {
  assert.deepEqual(normalizeDevice({ deviceId: "abc", label: "  USB DAC  " }), {
    deviceId: "abc",
    label: "USB DAC",
  });
  assert.equal(normalizeDevice(null), null);
});

test("accepts only bounded pending output-selection state", () => {
  assert.deepEqual(
    normalizePendingOutputSelection({
      tabId: 42,
      windowId: 7,
      action: "change",
      tabTitle: "  Live concert  ",
    }),
    {
      tabId: 42,
      windowId: 7,
      action: "change",
      tabTitle: "Live concert",
    },
  );
  assert.equal(normalizePendingOutputSelection({ tabId: "42", windowId: 7 }), null);
  assert.equal(normalizePendingOutputSelection({ tabId: 42, windowId: -1 }), null);
});

test("prefers physical audio outputs over default aliases", () => {
  const devices = [
    { kind: "audioinput", deviceId: "mic" },
    { kind: "audiooutput", deviceId: "default", label: "Standard" },
    { kind: "audiooutput", deviceId: "communications", label: "Kommunikation" },
    { kind: "audiooutput", deviceId: "usb-dac", label: "USB DAC" },
  ];
  assert.deepEqual(getMeaningfulAudioOutputs(devices), [devices[3]]);
});

test("translates expected browser errors into clear messages", () => {
  assert.equal(
    normalizeError(new DOMException("denied", "NotAllowedError")).message,
    "Chrome cancelled or blocked the device picker.",
  );
  assert.equal(
    normalizeError(new Error("Cannot capture a tab with an active stream")).code,
    "TabCaptureError",
  );
  assert.deepEqual(
    normalizeError({ name: "OutputDeviceNotFound", message: "Requested device not found" }),
    {
      code: "OutputDeviceNotFound",
      message: "The selected output device is no longer available.",
    },
  );
  assert.equal(
    normalizeError({ name: "TabStreamError", message: "Requested device not found" }).message,
    "Chrome could not open this tab's audio stream. Stop other tab captures and try again.",
  );
});

test("creates a complete inactive route state", () => {
  assert.deepEqual(inactiveRouteState(42), {
    active: false,
    tabId: 42,
    status: "idle",
    deviceId: null,
    deviceLabel: null,
    startedAt: null,
    error: null,
  });
});
