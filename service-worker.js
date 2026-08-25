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

  return {
    id: tab.id,
    title: tab.title || "Untitled tab",
    url: tab.url || "",
    audible: Boolean(tab.audible),
    muted: Boolean(tab.mutedInfo?.muted),
  };
}

async function startRoute({ tabId, deviceId, deviceLabel }) {
  if (!Number.isInteger(tabId)) throw new Error("Invalid tab.");
  if (typeof deviceId !== "string" || !deviceId) {
    throw new DOMException("No output device selected.", "NotFoundError");
  }

  if (startLocks.has(tabId)) return startLocks.get(tabId);

  const task = performStartRoute({ tabId, deviceId, deviceLabel }).finally(() => {
    startLocks.delete(tabId);
  });
  startLocks.set(tabId, task);
  return task;
}

async function performStartRoute({ tabId, deviceId, deviceLabel }) {
  await ensureOffscreenDocument();

  const currentState = await getRouteState(tabId);
  if (currentState.active) {
    if (currentState.deviceId === deviceId) return currentState;
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
    });

    if (!response?.ok) throw response?.error || new Error("The audio stream could not be started.");
    await setBadge(tabId, true);
    await enableFullscreenBridge(tabId);
    return response.state;
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

  fullscreenSuspensions.set(tabId, {
    deviceId: state.deviceId,
    deviceLabel: state.deviceLabel,
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

  fullscreenSuspensions.delete(tabId);
  const state = await startRoute({ tabId, ...route });
  return { resumed: state.active };
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

async function changeOutput({ tabId, deviceId, deviceLabel }) {
  if (!(await hasOffscreenDocument())) return inactiveRouteState(tabId);

  const response = await sendToOffscreen({
    type: MESSAGE_TYPE.OFFSCREEN_CHANGE_OUTPUT,
    tabId,
    deviceId,
    deviceLabel,
  });
  if (!response?.ok) throw response?.error || new Error("The output device could not be changed.");
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
  await setBadge(state.tabId, state.active);

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

async function setBadge(tabId, active) {
  await chrome.action.setBadgeText({ tabId, text: active ? "ON" : "" });
  if (active) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#167c5a" });
    await chrome.action.setTitle({ tabId, title: "AudioRoute – output is being routed" });
  } else {
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
