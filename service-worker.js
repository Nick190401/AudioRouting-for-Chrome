import {
  MESSAGE_TARGET,
  MESSAGE_TYPE,
  inactiveRouteState,
  normalizeError,
} from "./shared/utils.js";
import { STUDIO_MESSAGE as S, hostnameFromUrl } from "./shared/studio.js";
import { assertWorkerCommand, senderRole } from "./shared/security.js";
import { createSceneService } from "./worker/scenes.js";

const OFFSCREEN_PATH = "offscreen/offscreen.html";
const startLocks = new Map();
const fullscreenSuspensions = new Map();
let creatingOffscreenDocument = null;
const studioPorts = new Map();
const FULLSCREEN_STORAGE_KEY = "studioFullscreenRecovery";
let recoveryWrites = Promise.resolve();
const recoveryReady = chrome.storage.session.get(FULLSCREEN_STORAGE_KEY).then((stored) => {
  for (const [id, profile] of Object.entries(stored[FULLSCREEN_STORAGE_KEY] || {}).slice(0, 6)) {
    if (Number.isInteger(Number(id)) && profile?.deviceId) fullscreenSuspensions.set(Number(id), profile);
  }
});
const sceneService = createSceneService({
  getState: getSceneState,
  getDevices: async () => (await hasOffscreenDocument())
    ? (await studioEngineRequest(S.OFFSCREEN_LIST_DEVICES)).devices : [],
  applyChannels: async (payload) => (await studioEngineRequest(S.OFFSCREEN_APPLY_SCENE, payload)).result,
});
// Page-injected scripts never need to read saved scenes or device preferences.
void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
void syncMetering();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "audio-route-studio" || senderRole(port.sender, chrome.runtime.id) !== "studio" || studioPorts.size >= 12) {
    port.disconnect();
    return;
  }
  studioPorts.set(port, false);
  port.onMessage.addListener((message) => {
    if (message?.type !== "visibility" || typeof message.visible !== "boolean") return;
    studioPorts.set(port, message.visible);
    void syncMetering();
    if (message.visible) void getStudioState().then((state) => postStudio(port, { type: S.STATE_CHANGED, state }));
  });
  port.onDisconnect.addListener(() => {
    studioPorts.delete(port);
    void syncMetering();
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== MESSAGE_TARGET.WORKER) return false;

  try { assertWorkerCommand(message, sender, chrome.runtime.id); }
  catch (error) {
    sendResponse({ ok: false, error: normalizeError(error) });
    return false;
  }

  if (message.type === S.STATE_CHANGED || message.type === S.LEVELS) {
    if (message.type === S.STATE_CHANGED) message = { ...message, state: withRecovery(message.state) };
    for (const [port, visible] of studioPorts) {
      if (visible || message.type === S.STATE_CHANGED) postStudio(port, message);
    }
    return false;
  }

  if (message.type === MESSAGE_TYPE.ROUTE_STATE_CHANGED) {
    void handleRouteStateChanged(message.state);
    return false;
  }

  handleWorkerMessage(message, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: normalizeError(error) }));

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void recoveryReady.then(async () => {
    fullscreenSuspensions.delete(tabId);
    await persistRecovery();
    await stopRoute(tabId, "tab-closed");
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // A capture survives navigation, but a scene's saved site assignment must not.
  if (changeInfo.status === "loading" || changeInfo.url) {
    void recoveryReady.then(() => {
      if (fullscreenSuspensions.delete(tabId)) return persistRecovery();
    });
    void getRouteState(tabId).then(async (state) => {
      if (state.active) await updateRoute({ tabId, siteHost: null });
    });
  }
  if (changeInfo.status !== "complete") return;
  void getRouteState(tabId).then((state) => {
    if (state.active) void enableFullscreenBridge(tabId);
  });
});

chrome.tabCapture.onStatusChanged.addListener((captureInfo) => {
  if (captureInfo.status === "error" || captureInfo.status === "stopped") {
    if (fullscreenSuspensions.has(captureInfo.tabId)) return;
    void clearBadge(captureInfo.tabId);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setBadgeBackgroundColor({ color: "#167c5a" });
});

chrome.runtime.onStartup.addListener(() => {
  // Routes die with the extension; a stale count must not survive a restart.
  void chrome.action.setBadgeText({ text: "" });
});

async function handleWorkerMessage(message, sender) {
  await recoveryReady;
  switch (message.type) {
    case S.GET_STATE:
      return { state: await getStudioState() };
    case S.GET_DEVICES:
      return (await hasOffscreenDocument()) ? studioEngineRequest(S.OFFSCREEN_LIST_DEVICES) : { devices: [] };
    case S.UPDATE_MIX:
      return studioEngineRequest(S.OFFSCREEN_UPDATE_MIX, { tabId: message.tabId, muted: message.muted, solo: message.solo });
    case S.UPDATE_FOCUS:
      return studioEngineRequest(S.OFFSCREEN_UPDATE_FOCUS, { enabled: message.enabled, priorityTabId: message.priorityTabId });
    case S.LIST_SCENES:
    case S.SAVE_SCENE:
    case S.RENAME_SCENE:
    case S.DUPLICATE_SCENE:
    case S.DELETE_SCENE:
    case S.PREVIEW_SCENE:
    case S.APPLY_SCENE:
      return sceneService.handle(message);
    case MESSAGE_TYPE.GET_ACTIVE_TAB:
      return { tab: await getActiveTab() };
    case MESSAGE_TYPE.GET_ROUTE_STATE:
      return { state: await getRouteState(message.tabId) };
    case MESSAGE_TYPE.START_ROUTE:
      return { state: await startAuthorizedRoute(message) };
    case MESSAGE_TYPE.STOP_ROUTE:
      return { state: await stopRoute(message.tabId, "user") };
    case MESSAGE_TYPE.CHANGE_OUTPUT:
      return { state: await changeOutput(message) };
    case MESSAGE_TYPE.LIST_ROUTES:
      return { routes: await listRoutes() };
    case MESSAGE_TYPE.UPDATE_ROUTE:
      return { state: await updateRoute({ tabId: message.tabId, audio: message.audio }) };
    case MESSAGE_TYPE.ADD_SINK:
      return { state: await forwardToRoute(MESSAGE_TYPE.OFFSCREEN_ADD_SINK, message) };
    case MESSAGE_TYPE.REMOVE_SINK:
      return { state: await forwardToRoute(MESSAGE_TYPE.OFFSCREEN_REMOVE_SINK, message) };
    case MESSAGE_TYPE.UPDATE_SINK:
      return { state: await forwardToRoute(MESSAGE_TYPE.OFFSCREEN_UPDATE_SINK, message) };
    case MESSAGE_TYPE.PREPARE_FULLSCREEN:
      return { transition: await prepareFullscreenTransition(message, sender) };
    case MESSAGE_TYPE.RESUME_FULLSCREEN:
      return { transition: await resumeAfterFullscreen(message, sender) };
    default:
      throw new Error("Unknown AudioRoute request.");
  }
}

async function startAuthorizedRoute(message) {
  if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error("Invalid tab.");
  const tab = await chrome.tabs.get(message.tabId);
  const recovery = fullscreenSuspensions.get(tab.id);
  // Identity comes from Chrome under activeTab, never the UI or a saved scene.
  const state = await startRoute({
    ...recovery,
    tabId: tab.id, deviceId: message.deviceId, deviceLabel: message.deviceLabel ?? message.label,
    audio: recovery?.audio ?? message.audio, sink: recovery?.sink ?? message.sink,
    tabTitle: tab.title || null, tabHost: hostnameFromUrl(tab.url), siteHost: hostnameFromUrl(tab.url),
  });
  if (recovery && state.active) {
    fullscreenSuspensions.delete(tab.id);
    await persistRecovery();
  }
  return state;
}

function postStudio(port, message) {
  try { port.postMessage(message); } catch { studioPorts.delete(port); }
}

async function syncMetering() {
  if (!(await hasOffscreenDocument())) return;
  try { await sendToOffscreen({ type: S.OFFSCREEN_METERING, enabled: [...studioPorts.values()].some(Boolean) }); }
  catch { /* A closing offscreen document has no meters to publish. */ }
}

async function getStudioState() {
  if (!(await hasOffscreenDocument())) {
    return withRecovery({ epoch: "idle", revision: 0, routes: [], focus: { enabled: false, priorityTabId: null, active: false }, soloTabId: null });
  }
  return withRecovery((await studioEngineRequest(S.OFFSCREEN_GET_STATE)).state);
}

function withRecovery(state) {
  return { ...state, recoveries: [...fullscreenSuspensions].filter(([, profile]) => profile.error).map(([tabId, profile]) => ({ tabId, siteHost: profile.siteHost, error: profile.error })) };
}

async function getSceneState() {
  const state = await getStudioState();
  for (const route of state.routes) {
    if (!route.siteHost) continue;
    const tab = await chrome.tabs.get(route.tabId).catch(() => null);
    if (hostnameFromUrl(tab?.url) !== route.siteHost) await updateRoute({ tabId: route.tabId, siteHost: null });
  }
  return getStudioState();
}

async function studioEngineRequest(type, payload = {}) {
  if (!(await hasOffscreenDocument())) throw new Error("Connect a tab from the AudioRoute toolbar first.");
  const response = await sendToOffscreen({ ...payload, type });
  if (!response?.ok) throw response?.error || new Error("Studio could not update the audio engine.");
  return response;
}

function persistRecovery() {
  const snapshot = Object.fromEntries([...fullscreenSuspensions].map(([tabId, profile]) => {
    const { tabTitle, tabHost, ...recovery } = profile;
    return [tabId, recovery];
  }));
  const task = recoveryWrites.catch(() => {}).then(() => chrome.storage.session.set({ [FULLSCREEN_STORAGE_KEY]: snapshot }));
  recoveryWrites = task;
  return task;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("The active tab could not be determined.");

  return serializeTab(tab);
}

function serializeTab(tab) {
  return {
    id: tab.id,
    windowId: tab.windowId,
    title: tab.title || "Untitled tab",
    url: tab.url || "",
    audible: Boolean(tab.audible),
    muted: Boolean(tab.mutedInfo?.muted),
  };
}

async function startRoute({ tabId, deviceId, deviceLabel, label, tabTitle, tabHost, siteHost, muted, audio, sink, sinks }) {
  if (!Number.isInteger(tabId)) throw new Error("Invalid tab.");
  if (typeof deviceId !== "string" || !deviceId) {
    throw new DOMException("No output device selected.", "NotFoundError");
  }

  // The popup sends the device as {deviceId, label}; the fullscreen resume path
  // sends {deviceId, deviceLabel}. Accept both.
  const resolvedLabel = deviceLabel ?? label;

  if (startLocks.has(tabId)) return startLocks.get(tabId);

  const task = performStartRoute({
    tabId,
    deviceId,
    deviceLabel: resolvedLabel,
    tabTitle,
    tabHost,
    siteHost,
    muted,
    audio,
    sink,
    sinks,
  }).finally(() => {
    startLocks.delete(tabId);
  });
  startLocks.set(tabId, task);
  return task;
}

async function performStartRoute({ tabId, deviceId, deviceLabel, tabTitle, tabHost, siteHost, muted, audio, sink, sinks }) {
  await ensureOffscreenDocument();

  const currentState = await getRouteState(tabId);
  if (currentState.active) {
    // Apply first: the early return below would otherwise discard the settings.
    if (audio !== undefined || tabTitle !== undefined || tabHost !== undefined) {
      await updateRoute({ tabId, audio, tabTitle, tabHost, siteHost });
    }
    if (currentState.deviceId === deviceId) return getRouteState(tabId);
    return changeOutput({ tabId, deviceId, deviceLabel });
  }

  let streamId;
  try {
    try {
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    } catch (error) {
      const captureError = new Error(
        error?.message || "Chrome could not prepare capture for this tab.",
      );
      captureError.name = "TabCaptureError";
      throw captureError;
    }
    const response = await sendToOffscreen({
      type: MESSAGE_TYPE.OFFSCREEN_START,
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
    });

    if (!response?.ok) throw response?.error || new Error("The audio stream could not be started.");
    await restoreExtraSinks(tabId, sinks);
    await setBadge(tabId, true);
    await enableFullscreenBridge(tabId);
    await syncMetering();
    return await getRouteState(tabId);
  } catch (error) {
    await setBadge(tabId, false);
    throw error;
  }
}

async function stopRoute(tabId, reason) {
  if (!Number.isInteger(tabId)) return inactiveRouteState(tabId);
  // Stop cannot run ahead of an in-flight capture and leave a new hidden route.
  if (startLocks.has(tabId)) await startLocks.get(tabId).catch(() => {});

  if (reason !== "fullscreen-transition") {
    fullscreenSuspensions.delete(tabId);
    await persistRecovery();
    await disableFullscreenBridge(tabId);
  }

  try {
    if (!(await hasOffscreenDocument())) return inactiveRouteState(tabId);
    const response = await sendToOffscreen({
      type: MESSAGE_TYPE.OFFSCREEN_STOP,
      tabId,
      reason,
    });
    return response?.state || inactiveRouteState(tabId);
  } finally {
    await clearBadge(tabId);
  }
}

async function prepareFullscreenTransition({ tabId }, sender) {
  tabId = getSenderTabId(tabId, sender);

  if (fullscreenSuspensions.has(tabId)) {
    return { suspended: true };
  }

  const state = await getRouteState(tabId);
  if (!state.active) return { suspended: false };

  // The route is genuinely stopped and restarted here, so the suspension has to
  // carry the whole restart profile — not just the device.
  fullscreenSuspensions.set(tabId, {
    deviceId: state.deviceId,
    deviceLabel: state.deviceLabel,
    tabTitle: state.tabTitle,
    tabHost: state.tabHost,
    siteHost: state.siteHost,
    muted: state.muted,
    audio: state.audio,
    sink: state.sinks?.[0],
    sinks: state.sinks,
  });
  await persistRecovery();

  try {
    await stopRoute(tabId, "fullscreen-transition");
    return { suspended: true };
  } catch (error) {
    fullscreenSuspensions.delete(tabId);
    await persistRecovery();
    throw error;
  }
}

async function resumeAfterFullscreen({ tabId }, sender) {
  tabId = getSenderTabId(tabId, sender);
  const route = fullscreenSuspensions.get(tabId);
  if (!route) return { resumed: false };

  // Keep the entry until the restart succeeds. Dropping it first would destroy
  // the user's volume and balance if the device hiccups mid-transition.
  try {
    const state = await startRoute({ tabId, ...route });
    fullscreenSuspensions.delete(tabId);
    await persistRecovery();
    return { resumed: state.active };
  } catch (error) {
    fullscreenSuspensions.set(tabId, { ...route, error: { code: "FullscreenRecoveryFailed", message: "A fullscreen route could not resume. Open AudioRoute on the source tab and choose Start routing to retry with your saved mix." } });
    await persistRecovery();
    const state = await getStudioState();
    for (const port of studioPorts.keys()) postStudio(port, { type: S.STATE_CHANGED, state });
    throw error;
  }
}

function getSenderTabId(requestedTabId, sender) {
  const senderTabId = sender.tab?.id;
  if (
    !Number.isInteger(senderTabId) ||
    (Number.isInteger(requestedTabId) && requestedTabId !== senderTabId)
  ) {
    throw new Error("Invalid fullscreen request.");
  }
  return senderTabId;
}

async function enableFullscreenBridge(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/fullscreen-bridge.js"],
    });
  } catch {
    // Some embedded or protected pages do not allow script injection.
  }
}

async function disableFullscreenBridge(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => globalThis.__audioRouteFullscreenBridge?.deactivate(),
    });
  } catch {
    // The tab may already be closed or navigated to a protected page.
  }
}

async function changeOutput({ tabId, deviceId, deviceLabel, label, sinkId }) {
  if (!(await hasOffscreenDocument())) return inactiveRouteState(tabId);

  const response = await sendToOffscreen({
    type: MESSAGE_TYPE.OFFSCREEN_CHANGE_OUTPUT,
    tabId,
    sinkId,
    deviceId,
    deviceLabel: deviceLabel ?? label,
  });
  if (!response?.ok) throw response?.error || new Error("The output device could not be changed.");
  return response.state;
}

/**
 * A fullscreen transition stops the route outright, so a tab that played
 * through two devices has to get its second output back as well.
 */
async function restoreExtraSinks(tabId, sinks) {
  if (!Array.isArray(sinks)) return;

  for (const sink of sinks.slice(1)) {
    try {
      await forwardToRoute(MESSAGE_TYPE.OFFSCREEN_ADD_SINK, {
        tabId,
        deviceId: sink.deviceId,
        deviceLabel: sink.deviceLabel,
      });
      await forwardToRoute(MESSAGE_TYPE.OFFSCREEN_UPDATE_SINK, {
        tabId,
        sinkId: (await getRouteState(tabId)).sinks.at(-1)?.id,
        volume: sink.volume,
        delayMs: sink.delayMs,
      });
    } catch {
      // A device that vanished during the transition simply stays gone.
    }
  }
}

async function forwardToRoute(type, message) {
  if (!Number.isInteger(message.tabId)) throw new Error("Invalid tab.");
  if (!(await hasOffscreenDocument())) return inactiveRouteState(message.tabId);

  const response = await sendToOffscreen({ ...message, type });
  if (!response?.ok) throw response?.error || new Error("The route could not be updated.");
  return response.state;
}

async function listRoutes() {
  if (!(await hasOffscreenDocument())) return [];

  try {
    const response = await sendToOffscreen({ type: MESSAGE_TYPE.OFFSCREEN_LIST_ROUTES });
    return response?.routes || [];
  } catch {
    return [];
  }
}

async function updateRoute({ tabId, audio, tabTitle, tabHost, siteHost }) {
  if (!Number.isInteger(tabId)) throw new Error("Invalid tab.");
  if (!(await hasOffscreenDocument())) return inactiveRouteState(tabId);

  const response = await sendToOffscreen({
    type: MESSAGE_TYPE.OFFSCREEN_UPDATE_ROUTE,
    tabId,
    audio,
    tabTitle,
    tabHost,
    siteHost,
  });
  if (!response?.ok) throw response?.error || new Error("The route could not be updated.");
  return response.state;
}

async function getRouteState(tabId) {
  if (!(await hasOffscreenDocument())) return inactiveRouteState(tabId);

  try {
    const response = await sendToOffscreen({
      type: MESSAGE_TYPE.OFFSCREEN_GET_STATE,
      tabId,
    });
    return response?.state || inactiveRouteState(tabId);
  } catch {
    return inactiveRouteState(tabId);
  }
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  if (creatingOffscreenDocument) return creatingOffscreenDocument;

  creatingOffscreenDocument = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["AUDIO_PLAYBACK", "USER_MEDIA"],
      justification: "Play a tab audio stream through the device selected by the user.",
    })
    .finally(() => {
      creatingOffscreenDocument = null;
    });

  return creatingOffscreenDocument;
}

async function hasOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });
  return contexts.length > 0;
}

async function sendToOffscreen(message) {
  return chrome.runtime.sendMessage({
    ...message,
    target: MESSAGE_TARGET.OFFSCREEN,
  });
}

async function handleRouteStateChanged(state) {
  if (!state || !Number.isInteger(state.tabId)) return;
  if (!state.active && state.reason !== "fullscreen-transition") {
    fullscreenSuspensions.delete(state.tabId);
    await persistRecovery();
    await disableFullscreenBridge(state.tabId);
  }
  // The tab is often already gone by the time this runs.
  try {
    await setBadge(state.tabId, state.active);
  } catch {
    // Nothing to update on a closed tab.
  }
  await refreshGlobalBadge();

  try {
    await chrome.runtime.sendMessage({
      target: MESSAGE_TARGET.POPUP,
      type: MESSAGE_TYPE.ROUTE_STATE_CHANGED,
      state,
    });
  } catch {
    // The popup is normally closed. This is not an error state.
  }
}

/**
 * Routed tabs keep the per-tab "ON"; every other tab shows how many routes are
 * running. Without it a route on a tab you never visit becomes invisible.
 */
async function refreshGlobalBadge() {
  const count = (await listRoutes()).length;

  try {
    await chrome.action.setBadgeText({ text: count ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: count ? "#2c3a35" : "#167c5a" });
    await chrome.action.setTitle({
      title: count
        ? `AudioRoute – ${count} ${count === 1 ? "tab is" : "tabs are"} routed`
        : "Open AudioRoute",
    });
  } catch {
    // Badge updates are cosmetic.
  }
}

async function setBadge(tabId, active) {
  // An empty string is a per-tab override, not a reset — it would permanently
  // mask the global count on every tab that ever hosted a route. null removes it.
  await chrome.action.setBadgeText({ tabId, text: active ? "ON" : null });
  if (active) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#167c5a" });
    await chrome.action.setTitle({ tabId, title: "AudioRoute – output is being routed" });
  } else {
    // setBadgeText documents null as the way to drop a tab override; setTitle
    // takes a string, so the tooltip stays explicit rather than guessing.
    await chrome.action.setTitle({ tabId, title: "Open AudioRoute" });
  }
}

async function clearBadge(tabId) {
  try {
    await setBadge(tabId, false);
  } catch {
    // The tab may already be closed.
  }
}
