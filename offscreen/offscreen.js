import {
  MESSAGE_TARGET,
  MESSAGE_TYPE,
  inactiveRouteState,
  normalizeError,
} from "../shared/utils.js";

const routes = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== MESSAGE_TARGET.OFFSCREEN) return false;

  handleMessage(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: normalizeError(error) }));

  return true;
});

navigator.mediaDevices?.addEventListener("devicechange", () => {
  void stopRoutesWithMissingDevices();
});

async function handleMessage(message) {
  switch (message.type) {
    case MESSAGE_TYPE.OFFSCREEN_START:
      return { state: await startRoute(message) };
    case MESSAGE_TYPE.OFFSCREEN_STOP:
      return { state: await stopRoute(message.tabId, message.reason) };
    case MESSAGE_TYPE.OFFSCREEN_CHANGE_OUTPUT:
      return { state: await changeOutput(message) };
    case MESSAGE_TYPE.OFFSCREEN_GET_STATE:
      return { state: serializeRoute(message.tabId) };
    default:
      throw new Error("Unknown offscreen request.");
  }
}

async function startRoute({ tabId, streamId, deviceId, deviceLabel }) {
  if (routes.has(tabId)) await stopRoute(tabId, "restart");
  if (!globalThis.AudioContext?.prototype?.setSinkId) {
    throw new Error("This Chrome version does not support selectable audio outputs.");
  }

  let stream;
  let context;

  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
          },
        },
        video: false,
      });
    } catch (error) {
      throw routingError(
        "TabStreamError",
        error?.message || "Chrome could not open this tab's audio stream.",
      );
    }

    context = new AudioContext({ latencyHint: "playback" });
    try {
      await context.setSinkId(deviceId);
    } catch (error) {
      throw routingError(
        error?.name === "NotFoundError" ? "OutputDeviceNotFound" : "OutputDeviceError",
        error?.message || "Chrome could not open the output device.",
      );
    }

    const source = context.createMediaStreamSource(stream);
    source.connect(context.destination);
    await context.resume();

    const route = {
      tabId,
      stream,
      context,
      source,
      deviceId,
      deviceLabel: deviceLabel || "Selected audio device",
      startedAt: Date.now(),
      stopping: false,
    };
    routes.set(tabId, route);

    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => {
        if (!route.stopping) void stopRoute(tabId, "stream-ended");
      });
    }

    const state = serializeRoute(tabId);
    void notifyWorker(state);
    return state;
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== "closed") await context.close();
    throw error;
  }
}

async function stopRoute(tabId, reason = "unknown") {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  route.stopping = true;
  routes.delete(tabId);

  route.source?.disconnect();
  route.stream?.getTracks().forEach((track) => track.stop());
  if (route.context?.state !== "closed") await route.context.close();

  const state = {
    ...inactiveRouteState(tabId),
    reason,
  };
  void notifyWorker(state);
  return state;
}

async function changeOutput({ tabId, deviceId, deviceLabel }) {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  await route.context.setSinkId(deviceId);
  route.deviceId = deviceId;
  route.deviceLabel = deviceLabel || route.deviceLabel;

  const state = serializeRoute(tabId);
  void notifyWorker(state);
  return state;
}

function serializeRoute(tabId) {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  return {
    active: true,
    tabId,
    status: "active",
    deviceId: route.deviceId,
    deviceLabel: route.deviceLabel,
    startedAt: route.startedAt,
    error: null,
  };
}

async function stopRoutesWithMissingDevices() {
  if (!routes.size) return;

  try {
    const outputs = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === "audiooutput")
      .map((device) => device.deviceId);

    for (const [tabId, route] of routes) {
      if (route.deviceId && !outputs.includes(route.deviceId)) {
        await stopRoute(tabId, "device-disconnected");
      }
    }
  } catch {
    // A temporary enumeration error must not stop an active route.
  }
}

async function notifyWorker(state) {
  try {
    await chrome.runtime.sendMessage({
      target: MESSAGE_TARGET.WORKER,
      type: MESSAGE_TYPE.ROUTE_STATE_CHANGED,
      state,
    });
  } catch {
    // The service worker will wake up on the next message.
  }
}

function routingError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}
