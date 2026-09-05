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
  applyAutomation,
} from "./audio-chain.js";
import { STUDIO_MESSAGE as S, normalizeHostname, validateScene } from "../shared/studio.js";
import { senderRole } from "../shared/security.js";
import { FOCUS_DEFAULTS, createActivityState, updateActivity, mixAttenuation } from "../shared/focus.js";

const routes = new Map();
let nextSinkId = 1;
const epoch = crypto.randomUUID();
let revision = 0;
let operationQueue = Promise.resolve();
let mutating = false;
let soloTabId = null;
const focus = { enabled: false, priorityTabId: null, active: false };
let activity = createActivityState();
let meterEnabled = false;
let lastMeterPublish = 0;
const pendingNotifications = new Map();

function enqueue(task, mutation = true) {
  const result = operationQueue.then(async () => {
    mutating = mutation;
    try {
      const response = await task();
      if (mutation) publishState();
      if (response?.state) response.state = response.state.routes ? studioState() : { ...response.state, ...serializeRoute(response.state.tabId), epoch, revision };
      return response;
    } catch (error) {
      if (mutation) publishState();
      throw error;
    } finally { mutating = false; }
  });
  operationQueue = result.catch(() => {});
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== MESSAGE_TARGET.OFFSCREEN) return false;
  if (senderRole(sender, chrome.runtime.id) !== "worker") {
    sendResponse({ ok: false, error: { code: "Unauthorized", message: "Only the routing worker can control the engine." } });
    return false;
  }

  const readOnly = [MESSAGE_TYPE.OFFSCREEN_GET_STATE, MESSAGE_TYPE.OFFSCREEN_LIST_ROUTES, S.OFFSCREEN_GET_STATE, S.OFFSCREEN_LIST_DEVICES].includes(message.type);
  enqueue(() => handleMessage(message), !readOnly)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: normalizeError(error) }));

  return true;
});

navigator.mediaDevices?.addEventListener("devicechange", () => {
  void enqueue(dropSinksWithMissingDevices);
});

async function handleMessage(message) {
  if (message.tabId !== undefined) assertTabId(message.tabId);
  switch (message.type) {
    case S.OFFSCREEN_GET_STATE:
      return { state: studioState() };
    case S.OFFSCREEN_LIST_DEVICES:
      return { devices: await listDevices() };
    case S.OFFSCREEN_UPDATE_MIX:
      updateMix(message);
      return { state: studioState() };
    case S.OFFSCREEN_UPDATE_FOCUS:
      updateFocus(message);
      return { state: studioState() };
    case S.OFFSCREEN_METERING:
      if (typeof message.enabled !== "boolean") throw new Error("Invalid meter subscription.");
      meterEnabled = message.enabled;
      refreshMix();
      return { state: studioState() };
    case S.OFFSCREEN_APPLY_SCENE:
      return { result: await applyScene(message), state: studioState() };
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
  siteHost,
  muted,
  audio,
  sink,
}) {
  assertTabId(tabId);
  assertDevice(deviceId);
  if (typeof streamId !== "string" || !streamId || streamId.length > 4096) throw new Error("Invalid capture identifier.");
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
      siteHost: normalizeHostname(siteHost),
      muted: muted === true,
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
        if (!route.stopping) void enqueue(() => stopRoute(tabId, "stream-ended"));
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
  assertDevice(deviceId);
  if (route.sinks.length >= 2 || countSinks() >= MAX_CONTEXTS) throw routingError("ContextLimitReached", "A tab supports two outputs; AudioRoute supports six in total.");
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

  try {
  const options = normalizeSinkOptions({ volume, delayMs });
  const source = context.createMediaStreamSource(route.stream);
  const nodes = createAudioChain(context, source, route.audio, options);
  const initialMix = mixAttenuation({ tabId: route.tabId, muted: route.muted, soloTabId, focus });
  nodes.automation.gain.value = initialMix.gain;
  nodes.automationTarget = initialMix.gain;
  await context.resume();

  const sink = {
    id: `sink-${nextSinkId}`,
    deviceId,
    deviceLabel: safeLabel(deviceLabel),
    context,
    source,
    nodes,
    ...options,
  };
  nextSinkId += 1;
  route.sinks.push(sink);
  await attachMeters(route, sink);
  refreshMix();
  return sink;
  } catch (error) {
    if (context.state !== "closed") await context.close();
    throw error;
  }
}

async function destroySink(sink) {
  for (const meter of [sink.inputMeter, sink.outputMeter]) {
    if (meter) { meter.port.onmessage = null; meter.port.close(); meter.disconnect(); }
  }
  sink.source?.disconnect();
  disconnectAudioChain(sink.nodes);
  if (sink.context?.state !== "closed") await sink.context.close();
}

async function stopRoute(tabId, reason = "unknown") {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);

  route.stopping = true;
  routes.delete(tabId);
  if (focus.priorityTabId === tabId) {
    activity = createActivityState();
    focus.active = false;
    if (reason !== "fullscreen-transition") focus.priorityTabId = null;
  }
  if (soloTabId === tabId && reason !== "fullscreen-transition") soloTabId = null;
  refreshMix();

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
  if (route.sinks.length >= 2) throw routingError("OutputLimitReached", "A tab can play through at most two outputs.");

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

async function changeOutput({ tabId, deviceId, deviceLabel, sinkId }) {
  assertDevice(deviceId);
  const route = routes.get(tabId);
  const sink = sinkId === undefined ? route?.sinks[0] : route?.sinks.find((entry) => entry.id === sinkId);
  if (!sink) return inactiveRouteState(tabId);
  if (route.sinks.some((entry) => entry !== sink && entry.deviceId === deviceId)) throw new Error("This tab already plays through that device.");

  try {
    await sink.context.setSinkId(deviceId);
  } catch (error) {
    throw routingError(
      error?.name === "NotFoundError" ? "OutputDeviceNotFound" : "OutputDeviceError",
      error?.message || "Chrome could not open the output device.",
    );
  }

  sink.deviceId = deviceId;
  sink.deviceLabel = safeLabel(deviceLabel || sink.deviceLabel);

  const state = serializeRoute(tabId);
  void notifyWorker(state);
  return state;
}

/**
 * Patches the fields the popup owns. Deliberately cannot touch `deviceId` —
 * switching the output needs setSinkId and goes through changeOutput.
 *
 * All mutations publish revisioned state to both Studio and the popup.
 */
function updateRoute({ tabId, audio, tabTitle, tabHost, siteHost }) {
  const route = routes.get(tabId);
  if (!route) return inactiveRouteState(tabId);
  if (siteHost !== undefined) {
    route.siteHost = normalizeHostname(siteHost);
    if (!route.siteHost && focus.priorityTabId === tabId) {
      focus.priorityTabId = null;
      focus.active = false;
      activity = createActivityState();
    }
  }

  if (audio !== undefined) {
    route.audio = normalizeAudioSettings({ ...route.audio, ...audio });
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
    epoch,
    revision,
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
    siteHost: route.siteHost,
    muted: route.muted,
    ...mixAttenuation({ tabId, muted: route.muted, soloTabId, focus }),
    meterError: route.sinks.find((sink) => sink.meterError)?.meterError || null,
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

function notifyWorker(state) {
  pendingNotifications.set(state.tabId, state);
}

function routingError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

function assertTabId(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error("Invalid tab identifier.");
}

function assertDevice(deviceId) {
  if (typeof deviceId !== "string" || !deviceId || deviceId.length > 512 || /[\u0000-\u001f]/u.test(deviceId)) throw new Error("Invalid output device.");
}

function safeLabel(label) {
  return typeof label === "string" && label.trim() ? label.trim().slice(0, 200) : "Selected audio device";
}

function studioState() {
  return { epoch, revision, routes: listRoutes(), focus: { ...focus }, soloTabId };
}

function sendEvent(type, payload) {
  void chrome.runtime.sendMessage({ target: MESSAGE_TARGET.WORKER, type, ...payload }).catch(() => {});
}

function publishState() {
  refreshMix();
  revision += 1;
  for (const state of pendingNotifications.values()) {
    if (!state.active) sendEvent(MESSAGE_TYPE.ROUTE_STATE_CHANGED, { state: { ...state, epoch, revision } });
  }
  pendingNotifications.clear();
  const state = studioState();
  for (const route of state.routes) sendEvent(MESSAGE_TYPE.ROUTE_STATE_CHANGED, { state: route });
  sendEvent(S.STATE_CHANGED, { state });
}

async function listDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "audiooutput" && device.deviceId)
    .map((device) => ({ deviceId: device.deviceId, deviceLabel: safeLabel(device.label) }));
}

function updateMix({ tabId, muted, solo }) {
  assertTabId(tabId);
  const route = routes.get(tabId);
  if (!route) throw new Error("This tab is no longer connected.");
  if (muted !== undefined && typeof muted !== "boolean") throw new Error("Invalid mute setting.");
  if (solo !== undefined && typeof solo !== "boolean") throw new Error("Invalid solo setting.");
  if (muted !== undefined) route.muted = muted;
  if (solo !== undefined) soloTabId = solo ? tabId : soloTabId === tabId ? null : soloTabId;
  refreshMix();
}

function updateFocus({ enabled, priorityTabId }) {
  if (enabled !== undefined && typeof enabled !== "boolean") throw new Error("Invalid Smart Focus setting.");
  if (priorityTabId !== undefined && priorityTabId !== null) {
    assertTabId(priorityTabId);
    const priority = routes.get(priorityTabId);
    if (!priority) throw new Error("Connect the priority tab first.");
    if (!priority.sinks[0]?.inputMeter) throw new Error("Smart Focus could not start its sound detector. Reconnect this tab and try again.");
  }
  if (priorityTabId !== undefined) focus.priorityTabId = priorityTabId;
  if (enabled !== undefined) focus.enabled = enabled;
  focus.active = false;
  activity = createActivityState();
  refreshMix();
}

function refreshMix() {
  const priority = routes.get(focus.priorityTabId);
  const priorityMuted = !priority || priority.muted || (soloTabId !== null && soloTabId !== priority.tabId) ||
    !priority.sinks.some((sink) => sink.volume > 0 && sink.context.state === "running");
  if (!focus.enabled || priorityMuted) {
    focus.active = false;
    activity = createActivityState();
  }
  for (const route of routes.values()) {
    const mix = mixAttenuation({ tabId: route.tabId, muted: route.muted, soloTabId, focus });
    for (const sink of route.sinks) {
      const seconds = mix.gain < (sink.nodes.automationTarget ?? 1) ? FOCUS_DEFAULTS.attackSeconds : FOCUS_DEFAULTS.releaseSeconds;
      applyAutomation(sink.nodes, mix.gain, sink.context, seconds);
      const inputEnabled = focus.enabled && !priorityMuted && focus.priorityTabId === route.tabId && route.sinks[0] === sink;
      if (sink.inputMeter && sink.inputEnabled !== inputEnabled) {
        sink.inputEnabled = inputEnabled;
        sink.inputMeter.port.postMessage({ enabled: inputEnabled });
      }
      if (sink.outputMeter && sink.outputEnabled !== meterEnabled) {
        sink.outputEnabled = meterEnabled;
        sink.outputMeter.port.postMessage({ enabled: meterEnabled });
      }
    }
  }
}

async function attachMeters(route, sink) {
  try {
    await sink.context.audioWorklet.addModule(chrome.runtime.getURL("offscreen/level-meter.js"));
    sink.inputMeter = new AudioWorkletNode(sink.context, "audioroute-level-meter", { numberOfInputs: 1, numberOfOutputs: 0 });
    sink.outputMeter = new AudioWorkletNode(sink.context, "audioroute-level-meter", { numberOfInputs: 1, numberOfOutputs: 0 });
    sink.source.connect(sink.inputMeter);
    sink.nodes.delay.connect(sink.outputMeter);
    sink.inputMeter.port.onmessage = ({ data }) => {
      if (mutating || routes.get(route.tabId) !== route || route.sinks[0] !== sink || !sink.inputEnabled) return;
      if (!Number.isFinite(data?.rms) || data.rms < 0) return;
      const active = updateActivity(activity, data.rms, sink.context.currentTime * 1000);
      if (active !== focus.active) {
        focus.active = active;
        publishState();
      }
    };
    sink.outputMeter.port.onmessage = ({ data }) => {
      if (!meterEnabled || routes.get(route.tabId) !== route || !route.sinks.includes(sink)) return;
      if (![data?.peak, data?.rms].every((value) => Number.isFinite(value) && value >= 0)) return;
      sink.level = { peak: Math.min(4, data.peak), rms: Math.min(4, data.rms) };
      const now = performance.now();
      if (now - lastMeterPublish < 50) return;
      lastMeterPublish = now;
      sendEvent(S.LEVELS, { epoch, levels: [...routes.values()].flatMap((entry) => entry.sinks.map((output) => ({ tabId: entry.tabId, sinkId: output.id, ...(output.level || { peak: 0, rms: 0 }) }))) });
    };
    const onFailure = () => {
      sink.meterError = "Audio meters unavailable. Reconnect this tab to recover Smart Focus.";
      if (focus.priorityTabId === route.tabId) {
        focus.enabled = false;
        focus.active = false;
      }
      if (!mutating) publishState();
    };
    sink.inputMeter.onprocessorerror = onFailure;
    sink.outputMeter.onprocessorerror = onFailure;
    sink.context.addEventListener("statechange", () => {
      if (routes.get(route.tabId) === route && !mutating) publishState();
    });
  } catch {
    sink.meterError = "Audio meters unavailable. Reconnect this tab to recover Smart Focus.";
  }
}

async function applyScene({ channels, focus: nextFocus, skipFocus = false }) {
  if (!Array.isArray(channels) || !channels.length || channels.length > 6) throw new Error("Invalid scene channels.");
  if (new Set(channels.map((channel) => channel.tabId)).size !== channels.length) throw new Error("Each scene channel needs a separate connected tab.");
  if (typeof skipFocus !== "boolean" || typeof nextFocus?.enabled !== "boolean") throw new Error("Invalid scene focus.");
  if (nextFocus.priorityTabId !== null && !channels.some((channel) => channel.tabId === nextFocus.priorityTabId)) throw new Error("Invalid priority channel.");
  // Reuse the strict saved-scene schema at the final engine boundary.
  validateScene({ id: "apply", version: 1, name: "Apply scene", createdAt: 0, updatedAt: 0,
    slots: channels.map((channel) => ({ ...channel, id: channel.slotId, label: "Channel" })),
    focus: { enabled: false, prioritySlotId: null } });
  const available = new Set((await listDevices()).map((device) => device.deviceId));
  const result = { channels: [], focusApplied: false };
  // Global serialization reserves the whole operation; no competing add can oversubscribe.
  const ordered = [...channels].sort((a, b) => (a.sinks.length - (routes.get(a.tabId)?.sinks.length || 0)) - (b.sinks.length - (routes.get(b.tabId)?.sinks.length || 0)));
  for (const channel of ordered) {
    const route = routes.get(channel.tabId);
    let previous = null;
    try {
      assertTabId(channel.tabId);
      if (!route || !route.siteHost || route.siteHost !== channel.siteHost) throw new Error("The connected tab changed. Reconnect and assign it again.");
      if (channel.sinks.some((sink) => !available.has(sink.deviceId))) throw new Error("A saved output device is unavailable. Connect it or update this scene.");
      if (countSinks() - route.sinks.length + channel.sinks.length > MAX_CONTEXTS) throw new Error("This scene would exceed six outputs. Stop an unused output and retry.");
      previous = serializeRoute(route.tabId);
      await configureRoute(route, channel);
      result.channels.push({ slotId: channel.slotId, tabId: channel.tabId, status: "applied" });
    } catch (error) {
      if (previous && routes.get(channel.tabId) === route) {
        try { await configureRoute(route, previous); }
        catch {
          const devices = new Set((await listDevices().catch(() => [])).map((device) => device.deviceId));
          for (const sink of [...route.sinks]) {
            if (!devices.has(sink.deviceId)) {
              route.sinks.splice(route.sinks.indexOf(sink), 1);
              await destroySink(sink);
            }
          }
          if (!route.sinks.length) await stopRoute(route.tabId, "scene-recovery-failed");
        }
      }
      result.channels.push({ slotId: channel.slotId, tabId: channel.tabId, status: "failed", error: normalizeError(error) });
    }
  }
  if (result.channels.some((channel) => channel.status === "applied")) soloTabId = null;
  const priorityApplied = nextFocus.priorityTabId === null || result.channels.some((channel) => channel.tabId === nextFocus.priorityTabId && channel.status === "applied");
  if (!skipFocus && priorityApplied) {
    try { updateFocus(nextFocus); result.focusApplied = true; }
    catch (error) { result.focusError = normalizeError(error); }
  }
  refreshMix();
  return result;
}

async function configureRoute(route, desired) {
  // Keep the current capture and contexts; changing a sink does not require recapture.
  while (route.sinks.length > desired.sinks.length) await destroySink(route.sinks.pop());
  for (let index = 0; index < desired.sinks.length; index += 1) {
    const settings = desired.sinks[index];
    let sink = route.sinks[index];
    if (!sink) sink = await createSink(route, settings);
    else if (sink.deviceId !== settings.deviceId) {
      await sink.context.setSinkId(settings.deviceId);
      sink.deviceId = settings.deviceId;
    }
    sink.deviceLabel = safeLabel(settings.deviceLabel);
    Object.assign(sink, normalizeSinkOptions(settings));
    applySinkOptions(sink.nodes, sink, sink.context);
  }
  route.audio = normalizeAudioSettings(desired.audio);
  route.muted = desired.muted === true;
  for (const sink of route.sinks) applyAudioSettings(sink.nodes, route.audio, sink.context);
}
