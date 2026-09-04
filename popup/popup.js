import {
  MESSAGE_TARGET,
  MESSAGE_TYPE,
  PENDING_OUTPUT_SELECTION_STORAGE_KEY,
  PREFERRED_OUTPUT_STORAGE_KEY,
  formatHost,
  inactiveRouteState,
  isRestrictedUrl,
  normalizeDevice,
  normalizeError,
} from "../shared/utils.js";

const elements = {
  audioState: document.querySelector("#audio-state"),
  deviceHint: document.querySelector("#device-hint"),
  deviceName: document.querySelector("#device-name"),
  devicePicker: document.querySelector("#device-picker"),
  notice: document.querySelector("#notice"),
  noticeClose: document.querySelector("#notice-close"),
  noticeText: document.querySelector("#notice-text"),
  outputNode: document.querySelector("#output-node"),
  persistenceNote: document.querySelector("#persistence-note"),
  routeBadge: document.querySelector("#route-badge"),
  routeBadgeLabel: document.querySelector("#route-badge-label"),
  routeButton: document.querySelector("#route-button"),
  routeButtonLabel: document.querySelector("#route-button-label"),
  signalPath: document.querySelector("#signal-path"),
  tabHost: document.querySelector("#tab-host"),
  tabTitle: document.querySelector("#tab-title"),
};

const viewState = {
  tab: null,
  device: null,
  route: inactiveRouteState(null),
  working: false,
  compatible: true,
};

elements.devicePicker.addEventListener("click", () => {
  const action = viewState.route.active ? "change" : "start";
  void chooseOutput(action);
});
elements.routeButton.addEventListener("click", () => void toggleRoute());
elements.noticeClose.addEventListener("click", hideNotice);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.target !== MESSAGE_TARGET.POPUP) return;
  if (message.type !== MESSAGE_TYPE.ROUTE_STATE_CHANGED) return;
  if (message.state?.tabId !== viewState.tab?.id) return;

  viewState.route = message.state;
  render();

  if (message.state.reason === "device-disconnected") {
    showNotice("The output device was disconnected. Routing was stopped safely.");
  }
});

void initialize();

async function initialize() {
  setWorking(true, "Reading active tab …");

  try {
    viewState.compatible = supportsAudioRouting();
    if (!viewState.compatible) {
      throw new Error("AudioRoute requires a current desktop version of Google Chrome.");
    }

    const [{ tab }, stored] = await Promise.all([
      sendToWorker(MESSAGE_TYPE.GET_ACTIVE_TAB),
      chrome.storage.local.get(PREFERRED_OUTPUT_STORAGE_KEY),
    ]);

    viewState.tab = tab;
    viewState.device = normalizeDevice(stored[PREFERRED_OUTPUT_STORAGE_KEY]);
    const { state } = await sendToWorker(MESSAGE_TYPE.GET_ROUTE_STATE, { tabId: tab.id });
    viewState.route = state;

    if (state.active) {
      viewState.device = {
        deviceId: state.deviceId,
        label: state.deviceLabel,
      };
    }
  } catch (error) {
    const normalized = normalizeError(error, "AudioRoute could not initialize.");
    viewState.compatible = false;
    showNotice(normalized.message);
  } finally {
    setWorking(false);
    render();
  }

}

function supportsAudioRouting() {
  return Boolean(chrome.offscreen && chrome.tabCapture?.getMediaStreamId);
}

async function chooseOutput(action = "start") {
  if (viewState.working || !viewState.compatible || !viewState.tab) return;
  hideNotice();
  setWorking(true, "Opening device selection …");
  render();

  try {
    await chrome.storage.session.set({
      [PENDING_OUTPUT_SELECTION_STORAGE_KEY]: {
        tabId: viewState.tab.id,
        windowId: viewState.tab.windowId,
        tabTitle: viewState.tab.title,
        action,
      },
    });
    await chrome.windows.create({
      url: chrome.runtime.getURL("setup/setup.html"),
      type: "popup",
      width: 480,
      height: 680,
      focused: true,
    });
    window.close();
  } catch (error) {
    const normalized = normalizeError(error, "The output device could not be selected.");
    showNotice(normalized.message);
  } finally {
    setWorking(false);
    render();
  }
}

async function toggleRoute() {
  if (viewState.working || !viewState.tab || !viewState.compatible) return;
  hideNotice();

  if (viewState.route.active) {
    await stopRouting();
    return;
  }

  let device = viewState.device;
  if (!device) {
    await chooseOutput("start");
    return;
  }

  await startRouting(device);
}

async function startRouting(device) {
  setWorking(true, "Starting routing …");
  try {
    const { state } = await sendToWorker(MESSAGE_TYPE.START_ROUTE, {
      tabId: viewState.tab.id,
      ...device,
    });
    viewState.route = state;
  } catch (error) {
    const normalized = normalizeError(error, "Routing could not be started.");
    showNotice(normalized.message);

    if (normalized.code === "OutputDeviceNotFound") {
      viewState.device = null;
      await chrome.storage.local.remove(PREFERRED_OUTPUT_STORAGE_KEY);
    }
  } finally {
    setWorking(false);
    render();
  }
}

async function stopRouting() {
  setWorking(true, "Stopping routing …");
  try {
    const { state } = await sendToWorker(MESSAGE_TYPE.STOP_ROUTE, {
      tabId: viewState.tab.id,
    });
    viewState.route = state;
  } catch (error) {
    showNotice(normalizeError(error, "Routing could not be stopped.").message);
  } finally {
    setWorking(false);
    render();
  }
}

async function sendToWorker(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({
    target: MESSAGE_TARGET.WORKER,
    type,
    ...payload,
  });

  if (!response?.ok) {
    const error = new Error(response?.error?.message || "AudioRoute request failed.");
    error.name = response?.error?.code || "RoutingError";
    throw error;
  }

  return response;
}

function setWorking(working, label) {
  viewState.working = working;
  elements.routeButton.dataset.working = String(working);
  if (working && label) elements.routeBadgeLabel.textContent = label;
}

function render() {
  const { tab, device, route, working, compatible } = viewState;
  const restricted = tab ? isRestrictedUrl(tab.url) : false;
  const active = Boolean(route.active);

  elements.tabTitle.textContent = tab?.title || "No active tab";
  elements.tabHost.textContent = tab ? formatHost(tab.url) : "Chrome tab unavailable";
  elements.audioState.dataset.audible = String(Boolean(tab?.audible || active));
  elements.audioState.title = tab?.audible || active ? "Tab is playing audio" : "Tab is currently quiet";
  elements.audioState.setAttribute("aria-label", elements.audioState.title);

  elements.deviceName.textContent = device?.label || "Choose an output device";
  elements.deviceHint.textContent = device
    ? active
      ? "Click to switch the live destination"
      : "Saved · click to change"
    : "Choose one to start routing";
  elements.outputNode.dataset.selected = String(Boolean(device));

  elements.signalPath.dataset.active = String(active);
  elements.routeBadge.dataset.state = working ? "working" : active ? "active" : "idle";
  if (!working) elements.routeBadgeLabel.textContent = active ? "Active" : "Ready";

  elements.routeButton.dataset.mode = active ? "stop" : "start";
  elements.routeButtonLabel.textContent = active ? "Stop routing" : "Start routing";
  elements.persistenceNote.textContent = active
    ? `Audio is now playing through ${route.deviceLabel || device?.label || "the selected device"}.`
    : "Keeps running when you close this popup.";

  const blocked = !compatible || !tab || restricted;
  elements.routeButton.disabled = working || blocked;
  elements.devicePicker.disabled = working || blocked;

  if (restricted && !elements.notice.hidden) return;
  if (restricted) {
    showNotice("Chrome system pages cannot be routed. Switch to a regular web tab.");
  }
}

function showNotice(message) {
  elements.noticeText.textContent = message;
  elements.notice.hidden = false;
}

function hideNotice() {
  elements.notice.hidden = true;
  elements.noticeText.textContent = "";
}
