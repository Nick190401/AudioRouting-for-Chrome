import {
  MESSAGE_TARGET,
  MESSAGE_TYPE,
  inactiveRouteState,
  normalizeError,
} from "./shared/utils.js";

const OFFSCREEN_PATH = "offscreen/offscreen.html";
const startLocks = new Map();
const fullscreenSuspensions = new Map();
let creatingOffscreenDocument = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== MESSAGE_TARGET.WORKER) return false;

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
  fullscreenSuspensions.delete(tabId);
  void stopRoute(tabId, "tab-closed");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
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
  switch (message.type) {
    case MESSAGE_TYPE.GET_ACTIVE_TAB:
      return { tab: await getActiveTab() };
    case MESSAGE_TYPE.GET_ROUTE_STATE:
      return { state: await getRouteState(message.tabId) };
    case MESSAGE_TYPE.START_ROUTE:
      return { state: await startRoute(message) };
    case MESSAGE_TYPE.STOP_ROUTE:
      return { state: await stopRoute(message.tabId, "user") };
    case MESSAGE_TYPE.CHANGE_OUTPUT:
      return { state: await changeOutput(message) };
    case MESSAGE_TYPE.LIST_ROUTES:
      return { routes: await listRoutes() };
    case MESSAGE_TYPE.UPDATE_ROUTE:
      return { state: await updateRoute(message) };
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

async function startRoute({ tabId, deviceId, deviceLabel, label, tabTitle, tabHost, audio, sink, sinks }) {
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
    audio,
    sink,
    sinks,
  }).finally(() => {
    startLocks.delete(tabId);
  });
  startLocks.set(tabId, task);
  return task;
}

async function performStartRoute({ tabId, deviceId, deviceLabel, tabTitle, tabHost, audio, sink, sinks }) {
  await ensureOffscreenDocument();

  const currentState = await getRouteState(tabId);
  if (currentState.active) {
    // Apply first: the early return below would otherwise discard the settings.
    if (audio !== undefined || tabTitle !== undefined || tabHost !== undefined) {
      await updateRoute({ tabId, audio, tabTitle, tabHost });
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
      audio,
      sink,
    });

    if (!response?.ok) throw response?.error || new Error("The audio stream could not be started.");
    await restoreExtraSinks(tabId, sinks);
    await setBadge(tabId, true);
    await enableFullscreenBridge(tabId);
    return await getRouteState(tabId);
  } catch (error) {
    await setBadge(tabId, false);
    throw error;
  }
}

async function stopRoute(tabId, reason) {
  if (!Number.isInteger(tabId)) return inactiveRouteState(tabId);

  if (reason !== "fullscreen-transition") {
    fullscreenSuspensions.delete(tabId);
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
    audio: state.audio,
    sink: state.sinks?.[0],
    sinks: state.sinks,
  });

  try {
    await stopRoute(tabId, "fullscreen-transition");
    return { suspended: true };
  } catch (error) {
    fullscreenSuspensions.delete(tabId);
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
    return { resumed: state.active };
  } catch (error) {
    fullscreenSuspensions.set(tabId, route);
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

async function changeOutput({ tabId, deviceId, deviceLabel, label }) {
  if (!(await hasOffscreenDocument())) return inactiveRouteState(tabId);

  const response = await sendToOffscreen({
    type: MESSAGE_TYPE.OFFSCREEN_CHANGE_OUTPUT,
    tabId,
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

async function updateRoute({ tabId, audio, tabTitle, tabHost }) {
  if (!Number.isInteger(tabId)) throw new Error("Invalid tab.");
  if (!(await hasOffscreenDocument())) return inactiveRouteState(tabId);

  const response = await sendToOffscreen({
    type: MESSAGE_TYPE.OFFSCREEN_UPDATE_ROUTE,
    tabId,
    audio,
    tabTitle,
    tabHost,
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
