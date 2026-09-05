export const MESSAGE_TARGET = Object.freeze({
  WORKER: "audio-route-worker",
  OFFSCREEN: "audio-route-offscreen",
  POPUP: "audio-route-popup",
});

export const MESSAGE_TYPE = Object.freeze({
  GET_ACTIVE_TAB: "get-active-tab",
  GET_ROUTE_STATE: "get-route-state",
  START_ROUTE: "start-route",
  STOP_ROUTE: "stop-route",
  CHANGE_OUTPUT: "change-output",
  LIST_ROUTES: "list-routes",
  UPDATE_ROUTE: "update-route",
  ADD_SINK: "add-sink",
  REMOVE_SINK: "remove-sink",
  UPDATE_SINK: "update-sink",
  PREPARE_FULLSCREEN: "prepare-fullscreen",
  RESUME_FULLSCREEN: "resume-fullscreen",
  OFFSCREEN_START: "offscreen-start",
  OFFSCREEN_STOP: "offscreen-stop",
  OFFSCREEN_CHANGE_OUTPUT: "offscreen-change-output",
  OFFSCREEN_GET_STATE: "offscreen-get-state",
  OFFSCREEN_LIST_ROUTES: "offscreen-list-routes",
  OFFSCREEN_UPDATE_ROUTE: "offscreen-update-route",
  OFFSCREEN_ADD_SINK: "offscreen-add-sink",
  OFFSCREEN_REMOVE_SINK: "offscreen-remove-sink",
  OFFSCREEN_UPDATE_SINK: "offscreen-update-sink",
  ROUTE_STATE_CHANGED: "route-state-changed",
});

export const PREFERRED_OUTPUT_STORAGE_KEY = "preferredOutputDevice";
export const PREFERRED_AUDIO_SETTINGS_STORAGE_KEY = "preferredAudioSettings";
export const PENDING_OUTPUT_SELECTION_STORAGE_KEY = "pendingOutputSelection";

/** +6 dB. Above this a boost stops being useful and starts being dangerous. */
export const MAX_VOLUME = 2;

/**
 * Chrome caps AudioContexts per document and every output owns one, so a tab
 * routed to two devices costs two. The budget counts outputs, not tabs.
 */
export const MAX_CONTEXTS = 6;

/** Enough to line up Bluetooth against a wired device. */
export const MAX_DELAY_MS = 250;

const RESTRICTED_PROTOCOLS = new Set([
  "about:",
  "chrome:",
  "chrome-extension:",
  "devtools:",
  "edge:",
  "view-source:",
]);

export function isRestrictedUrl(value) {
  if (!value) return true;

  try {
    return RESTRICTED_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return true;
  }
}

export function formatHost(value) {
  if (!value) return "Unknown page";

  try {
    const url = new URL(value);
    if (url.protocol === "file:") return "Local file";
    return url.hostname.replace(/^www\./, "") || url.protocol.replace(":", "");
  } catch {
    return "Unknown page";
  }
}

export function normalizeDevice(device) {
  if (!device || typeof device.deviceId !== "string") return null;

  const label = device.label?.trim() || "Selected audio device";
  return {
    deviceId: device.deviceId,
    label,
  };
}

export function clampNumber(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Route-level processing: how the content should sound, identical on every
 * output. Level and timing are per output — see defaultSinkOptions.
 * A fresh object every call — callers patch the result in place.
 */
export function defaultAudioSettings() {
  return { mono: false, balance: 0, night: false, voice: false };
}

export function normalizeAudioSettings(settings) {
  const defaults = defaultAudioSettings();
  if (!settings || typeof settings !== "object") return defaults;

  return {
    mono: settings.mono === true,
    balance: clampNumber(settings.balance, -1, 1, defaults.balance),
    night: settings.night === true,
    voice: settings.voice === true,
  };
}

/** Per-output: volume and the delay that lines two devices up. */
export function defaultSinkOptions() {
  return { volume: 1, delayMs: 0 };
}

export function normalizeSinkOptions(options) {
  const defaults = defaultSinkOptions();
  if (!options || typeof options !== "object") return defaults;

  return {
    volume: clampNumber(options.volume, 0, MAX_VOLUME, defaults.volume),
    delayMs: Math.round(clampNumber(options.delayMs, 0, MAX_DELAY_MS, defaults.delayMs)),
  };
}

/**
 * Tab title and host are captured once at route start, held in memory for the
 * route's lifetime and never persisted. The host is stored instead of the URL
 * so no browsing history exists anywhere in the extension.
 */
export function normalizeRouteIdentity(identity) {
  return {
    tabTitle: trimmedLabel(identity?.tabTitle),
    tabHost: trimmedLabel(identity?.tabHost),
  };
}

function trimmedLabel(value) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
}

export function formatVolumePercent(volume) {
  return `${Math.round(clampNumber(volume, 0, MAX_VOLUME, 1) * 100)}%`;
}

/**
 * A WaveShaperNode only maps inputs within [-1, 1] onto its curve; anything
 * beyond is clamped to an endpoint, which is hard clipping. Both jobs therefore
 * live in the curve: `volume` amplifies, and everything approaching full scale
 * bends over instead of hitting a wall.
 *
 * Below the knee the curve is exactly `y = volume * x`, so a boost is clean
 * where it matters and only the peaks are rounded. At volume 1 this is a pure
 * limiter, which is what the voice lift needs — it can push past full scale on
 * its own.
 */
export function boostCurve(volume, length = 8192) {
  const amount = clampNumber(volume, 1, MAX_VOLUME, 1);
  const knee = 0.7;
  const range = 1 - knee;
  const curve = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    const input = ((index * 2) / (length - 1) - 1) * amount;
    const magnitude = Math.abs(input);
    curve[index] =
      magnitude <= knee
        ? input
        : Math.sign(input) * (knee + range * Math.tanh((magnitude - knee) / range));
  }

  return curve;
}

/**
 * Two points are enough for an exact passthrough: the runtime interpolates
 * linearly, so [-1, 1] resolves to y = x across the whole input range.
 */
export function identityCurve() {
  return new Float32Array([-1, 1]);
}

export function normalizePendingOutputSelection(selection) {
  if (
    !selection ||
    !Number.isInteger(selection.tabId) ||
    selection.tabId < 0 ||
    !Number.isInteger(selection.windowId) ||
    selection.windowId < 0
  ) {
    return null;
  }

  return {
    tabId: selection.tabId,
    windowId: selection.windowId,
    action: selection.action === "change" ? "change" : "start",
    tabTitle:
      typeof selection.tabTitle === "string" && selection.tabTitle.trim()
        ? selection.tabTitle.trim().slice(0, 200)
        : "Selected Chrome tab",
  };
}

export function getMeaningfulAudioOutputs(devices = []) {
  const outputs = devices.filter(
    (device) => device?.kind === "audiooutput" && typeof device.deviceId === "string" && device.deviceId,
  );
  const physicalOutputs = outputs.filter(
    (device) => device.deviceId !== "default" && device.deviceId !== "communications",
  );
  return physicalOutputs.length ? physicalOutputs : outputs;
}

export function normalizeError(error, fallback = "Audio routing failed.") {
  const name = error?.name || error?.code || "RoutingError";
  const rawMessage = error?.message || "";
  const message = rawMessage.toLowerCase();

  if (name === "NotAllowedError") {
    return {
      code: name,
      message: "Chrome cancelled or blocked the device picker.",
    };
  }

  if (name === "NotFoundError") {
    return {
      code: name,
      message: "The selected output device is no longer available.",
    };
  }

  if (name === "OutputDeviceNotFound") {
    return {
      code: name,
      message: "The selected output device is no longer available.",
    };
  }

  if (name === "OutputDeviceError") {
    return {
      code: name,
      message: rawMessage || "Chrome could not open the output device.",
    };
  }

  if (name === "TabStreamError") {
    return {
      code: name,
      message: "Chrome could not open this tab's audio stream. Stop other tab captures and try again.",
    };
  }

  if (name === "InvalidStateError") {
    return {
      code: name,
      message: "Open the device picker again and try once more.",
    };
  }

  if (name === "RouteLimitReached" || name === "ContextLimitReached") {
    return {
      code: name,
      message: `AudioRoute can drive up to ${MAX_CONTEXTS} outputs at once. Stop one and try again.`,
    };
  }

  if (message.includes("active stream") || message.includes("captur")) {
    return {
      code: "TabCaptureError",
      message: "This tab is already being captured by Chrome or another extension.",
    };
  }

  if (message.includes("invoked") || message.includes("user gesture")) {
    return {
      code: "UserGestureRequired",
      message: "Close AudioRoute, open it again, and start routing with a click.",
    };
  }

  if (name === "NotReadableError" || name === "AbortError") {
    return {
      code: name,
      message: "Chrome could not open this tab's audio stream.",
    };
  }

  return {
    code: name,
    message: rawMessage || fallback,
  };
}

export function inactiveRouteState(tabId) {
  return {
    active: false,
    tabId,
    status: "idle",
    deviceId: null,
    deviceLabel: null,
    startedAt: null,
    error: null,
    tabTitle: null,
    tabHost: null,
    audio: defaultAudioSettings(),
    sinks: [],
  };
}
