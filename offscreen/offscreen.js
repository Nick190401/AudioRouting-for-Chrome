import {
  MAX_CONTEXTS,
  MESSAGE_TARGET,
  MESSAGE_TYPE,
  defaultSinkOptions,
  inactiveRouteState,
  normalizeAudioSettings,
  normalizeError,
  normalizeRouteIdentity,
  normalizeSinkOptions,
} from "../shared/utils.js";
import {
  applyAudioSettings,
  applySinkOptions,
  createAudioChain,
  disconnectAudioChain,
} from "./audio-chain.js";

const routes = new Map();
let nextSinkId = 1;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== MESSAGE_TARGET.OFFSCREEN) return false;

  handleMessage(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: normalizeError(error) }));

  return true;
});

navigator.mediaDevices?.addEventListener("devicechange", () => {
  void dropSinksWithMissingDevices();
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
    case MESSAGE_TYPE.OFFSCREEN_LIST_ROUTES:
      return { routes: listRoutes() };
    case MESSAGE_TYPE.OFFSCREEN_UPDATE_ROUTE:
      return { state: updateRoute(message) };
    case MESSAGE_TYPE.OFFSCREEN_ADD_SINK:
      return { state: await addSink(message) };
    case MESSAGE_TYPE.OFFSCREEN_REMOVE_SINK:
      return { state: await removeSink(message) };
    case MESSAGE_TYPE.OFFSCREEN_UPDATE_SINK:
      return { state: updateSink(message) };
    default:
      throw new Error("Unknown offscreen request.");
  }
}

/** Every output owns an AudioContext, and Chrome caps those per document. */
function countSinks() {
  let total = 0;
  for (const route of routes.values()) total += route.sinks.length;
  return total;
}

async function startRoute({
  tabId,
  streamId,
  deviceId,
  deviceLabel,
  tabTitle,
  tabHost,
  audio,
  sink,
}) {
  if (routes.has(tabId)) await stopRoute(tabId, "restart");
  if (!globalThis.AudioContext?.prototype?.setSinkId) {
    throw new Error("This Chrome version does not support selectable audio outputs.");
  }
  if (countSinks() >= MAX_CONTEXTS) {
    throw routingError("ContextLimitReached", "Too many outputs are running at once.");
  }

  let stream;

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

    const identity = normalizeRouteIdentity({ tabTitle, tabHost });
    const route = {
      tabId,
      stream,
      tabTitle: identity.tabTitle,
      tabHost: identity.tabHost,
      audio: normalizeAudioSettings(audio),
      sinks: [],
      startedAt: Date.now(),
      stopping: false,
    };
    routes.set(tabId, route);

    try {
      await createSink(route, { deviceId, deviceLabel, ...normalizeSinkOptions(sink) });
    } catch (error) {
      routes.delete(tabId);
      throw error;
    }

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
    throw error;
  }
}

/**
 * Several contexts can consume the same captured stream, and closing one leaves
 * the others playing. The tracks therefore belong to the route, not to a sink —
 * stopping them here would silence every other output of the same tab.
 */
async function createSink(route, { deviceId, deviceLabel, volume, delayMs }) {
  const context = new AudioContext({ latencyHint: "playback" });

  try {
    await context.setSinkId(deviceId);
  } catch (error) {
    await context.close();
    throw routingError(
      error?.name === "NotFoundError" ? "OutputDeviceNotFound" : "OutputDeviceError",
      error?.message || "Chrome could not open the output device.",
    );
  }

  const options = normalizeSinkOptions({ volume, delayMs });
  const source = context.createMediaStreamSource(route.stream);
  const nodes = createAudioChain(context, source, route.audio, options);
  await context.resume();

  const sink = {
    id: `sink-${nextSinkId}`,
    deviceId,
    deviceLabel: deviceLabel || "Selected audio device",
    context,
    source,
    nodes,
    ...options,
  };
  nextSinkId += 1;
  route.sinks.push(sink);
  return sink;
}

async function destroySink(sink) {
  sink.source?.disconnect();
  disconnectAudioChain(sink.nodes);
  if (sink.context?.state !== "closed") await sink.context.close();
}

async function stopRoute(tabId, reason = "unknown") {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  route.stopping = true;
  routes.delete(tabId);

  for (const sink of route.sinks) await destroySink(sink);
  route.stream?.getTracks().forEach((track) => track.stop());

  const state = {
    ...inactiveRouteState(tabId),
    reason,
  };
  void notifyWorker(state);
  return state;
}

async function addSink({ tabId, deviceId, deviceLabel }) {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  if (typeof deviceId !== "string" || !deviceId) {
    throw new DOMException("No output device selected.", "NotFoundError");
  }
  if (route.sinks.some((sink) => sink.deviceId === deviceId)) {
    throw routingError("DuplicateOutput", "This tab already plays through that device.");
  }
  if (countSinks() >= MAX_CONTEXTS) {
    throw routingError("ContextLimitReached", "Too many outputs are running at once.");
  }

  await createSink(route, { deviceId, deviceLabel, ...defaultSinkOptions() });

  const state = serializeRoute(tabId);
  void notifyWorker(state);
  return state;
}

async function removeSink({ tabId, sinkId }) {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  const index = route.sinks.findIndex((sink) => sink.id === sinkId);
  if (index === -1) return serializeRoute(tabId);

  // Dropping the only output is the same thing as stopping the route.
  if (route.sinks.length === 1) return stopRoute(tabId, "user");

  const [sink] = route.sinks.splice(index, 1);
  await destroySink(sink);

  const state = serializeRoute(tabId);
  void notifyWorker(state);
  return state;
}

/** Same no-broadcast rule as updateRoute — see below. */
function updateSink({ tabId, sinkId, volume, delayMs }) {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  const sink = route.sinks.find((candidate) => candidate.id === sinkId);
  if (!sink) return serializeRoute(tabId);

  const options = normalizeSinkOptions({
    volume: volume ?? sink.volume,
    delayMs: delayMs ?? sink.delayMs,
  });
  sink.volume = options.volume;
  sink.delayMs = options.delayMs;
  applySinkOptions(sink.nodes, options, sink.context);

  return serializeRoute(tabId);
}

async function changeOutput({ tabId, deviceId, deviceLabel }) {
  const route = routes.get(tabId);
  const sink = route?.sinks[0];
  if (!sink) return inactiveRouteState(tabId);

  try {
    await sink.context.setSinkId(deviceId);
  } catch (error) {
    throw routingError(
      error?.name === "NotFoundError" ? "OutputDeviceNotFound" : "OutputDeviceError",
      error?.message || "Chrome could not open the output device.",
    );
  }

  sink.deviceId = deviceId;
  sink.deviceLabel = deviceLabel || sink.deviceLabel;

  const state = serializeRoute(tabId);
  void notifyWorker(state);
  return state;
}

/**
 * Patches the fields the popup owns. Deliberately cannot touch `deviceId` —
 * switching the output needs setSinkId and goes through changeOutput.
 *
 * Also deliberately does not call notifyWorker: the caller receives the
 * authoritative state in the response, and echoing a slider change back at the
 * popup mid-drag would snap the control backwards.
 */
function updateRoute({ tabId, audio, tabTitle, tabHost }) {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  if (audio !== undefined) {
    route.audio = normalizeAudioSettings(audio);
    for (const sink of route.sinks) {
      applyAudioSettings(sink.nodes, route.audio, sink.context);
    }
  }

  if (tabTitle !== undefined || tabHost !== undefined) {
    const identity = normalizeRouteIdentity({
      tabTitle: tabTitle ?? route.tabTitle,
      tabHost: tabHost ?? route.tabHost,
    });
    route.tabTitle = identity.tabTitle;
    route.tabHost = identity.tabHost;
  }

  return serializeRoute(tabId);
}

function listRoutes() {
  return [...routes.keys()]
    .map((tabId) => serializeRoute(tabId))
    .sort((left, right) => (left.startedAt ?? 0) - (right.startedAt ?? 0));
}

function serializeRoute(tabId) {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  const primary = route.sinks[0];

  return {
    active: true,
    tabId,
    status: "active",
    // Mirrors of the primary output, so every existing caller keeps working.
    deviceId: primary?.deviceId ?? null,
    deviceLabel: primary?.deviceLabel ?? null,
    startedAt: route.startedAt,
    error: null,
    tabTitle: route.tabTitle,
    tabHost: route.tabHost,
    audio: { ...route.audio },
    sinks: route.sinks.map((sink) => ({
      id: sink.id,
      deviceId: sink.deviceId,
      deviceLabel: sink.deviceLabel,
      volume: sink.volume,
      delayMs: sink.delayMs,
    })),
  };
}

/** A disconnected headphone must not take the speakers down with it. */
async function dropSinksWithMissingDevices() {
  if (!routes.size) return;

  try {
    const outputs = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === "audiooutput")
      .map((device) => device.deviceId)
      .filter(Boolean);

    // Without media permission every deviceId comes back empty. Treating that
    // as "no device exists" would stop every route at once.
    if (!outputs.length) return;

    for (const [tabId, route] of [...routes]) {
      const missing = route.sinks.filter(
        (sink) => sink.deviceId && !outputs.includes(sink.deviceId),
      );
      if (!missing.length) continue;

      if (missing.length === route.sinks.length) {
        await stopRoute(tabId, "device-disconnected");
        continue;
      }

      for (const sink of missing) {
        route.sinks.splice(route.sinks.indexOf(sink), 1);
        await destroySink(sink);
      }
      void notifyWorker({ ...serializeRoute(tabId), reason: "device-disconnected" });
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
