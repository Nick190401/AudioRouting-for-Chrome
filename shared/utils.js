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
  PREPARE_FULLSCREEN: "prepare-fullscreen",
  RESUME_FULLSCREEN: "resume-fullscreen",
  OFFSCREEN_START: "offscreen-start",
  OFFSCREEN_STOP: "offscreen-stop",
  OFFSCREEN_CHANGE_OUTPUT: "offscreen-change-output",
  OFFSCREEN_GET_STATE: "offscreen-get-state",
  ROUTE_STATE_CHANGED: "route-state-changed",
});

export const PREFERRED_OUTPUT_STORAGE_KEY = "preferredOutputDevice";

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
  };
}
