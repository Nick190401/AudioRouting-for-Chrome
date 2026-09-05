import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_DELAY_MS,
  MAX_VOLUME,
  MESSAGE_TYPE,
  boostCurve,
  defaultAudioSettings,
  defaultSinkOptions,
  formatHost,
  getMeaningfulAudioOutputs,
  inactiveRouteState,
  isRestrictedUrl,
  normalizeAudioSettings,
  normalizeDevice,
  normalizeError,
  normalizePendingOutputSelection,
  normalizeRouteIdentity,
  normalizeSinkOptions,
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
    tabTitle: null,
    tabHost: null,
    audio: { mono: false, balance: 0, night: false, voice: false },
    sinks: [],
  });
});

test("hands out a fresh audio settings object every call", () => {
  const first = defaultAudioSettings();
  const second = defaultAudioSettings();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);

  first.mono = true;
  assert.equal(defaultAudioSettings().mono, false);
});

test("clamps audio settings and coerces every switch to a strict boolean", () => {
  assert.deepEqual(normalizeAudioSettings({ balance: -9, mono: 1, night: true, voice: "yes" }), {
    mono: false,
    balance: -1,
    night: true,
    voice: false,
  });

  for (const balance of [Number.NaN, Number.POSITIVE_INFINITY, "0.5", null, undefined]) {
    assert.equal(normalizeAudioSettings({ balance }).balance, 0);
  }

  assert.deepEqual(normalizeAudioSettings(null), defaultAudioSettings());
});

test("clamps per-output volume and delay", () => {
  assert.deepEqual(normalizeSinkOptions({ volume: 9, delayMs: 9999 }), {
    volume: MAX_VOLUME,
    delayMs: MAX_DELAY_MS,
  });
  assert.deepEqual(normalizeSinkOptions({ volume: -1, delayMs: -50 }), {
    volume: 0,
    delayMs: 0,
  });
  assert.equal(normalizeSinkOptions({ delayMs: 40.6 }).delayMs, 41);

  for (const delayMs of [Number.NaN, Number.POSITIVE_INFINITY, "40", null]) {
    assert.equal(normalizeSinkOptions({ delayMs }).delayMs, 0);
  }

  assert.deepEqual(normalizeSinkOptions(undefined), defaultSinkOptions());

  const first = defaultSinkOptions();
  first.volume = 2;
  assert.equal(defaultSinkOptions().volume, 1);
});

test("keeps route identity to trimmed, bounded strings", () => {
  assert.deepEqual(normalizeRouteIdentity({ tabTitle: "  Radio  ", tabHost: "example.com" }), {
    tabTitle: "Radio",
    tabHost: "example.com",
  });
  assert.deepEqual(normalizeRouteIdentity({}), { tabTitle: null, tabHost: null });
  assert.equal(normalizeRouteIdentity({ tabTitle: "x".repeat(400) }).tabTitle.length, 200);
});

test("builds a monotonic soft-clip curve that never leaves full scale", () => {
  const curve = boostCurve(MAX_VOLUME, 1024);

  assert.equal(curve.length, 1024);
  assert.ok(Math.abs(curve[512]) < 1e-2, "the curve passes through the origin");

  for (let index = 1; index < curve.length; index += 1) {
    assert.ok(curve[index] > curve[index - 1], `curve is monotonic at ${index}`);
    assert.ok(Math.abs(curve[index]) <= 1, `curve stays inside full scale at ${index}`);
  }

  // Small signals are amplified by roughly the requested factor.
  const quiet = boostCurve(2, 1024)[512 + 26];
  assert.ok(quiet > 0.08 && quiet < 0.11, `expected roughly 2x for a quiet sample, got ${quiet}`);
});

test("keeps every message type distinct", () => {
  const values = Object.values(MESSAGE_TYPE);
  assert.equal(new Set(values).size, values.length);
});

test("explains the output budget", () => {
  assert.match(normalizeError({ name: "ContextLimitReached" }).message, /up to 6 outputs/);
  assert.match(normalizeError({ name: "RouteLimitReached" }).message, /up to 6 outputs/);
});
