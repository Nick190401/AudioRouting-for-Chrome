import {
  MESSAGE_TARGET,
  MESSAGE_TYPE,
  PENDING_OUTPUT_SELECTION_STORAGE_KEY,
  PREFERRED_OUTPUT_STORAGE_KEY,
  formatHost,
  getMeaningfulAudioOutputs,
  inactiveRouteState,
  isRestrictedUrl,
  normalizeDevice,
  normalizeError,
} from "../shared/utils.js";

const elements = {
  audioState: document.querySelector("#audio-state"),
  deviceDialog: document.querySelector("#device-dialog"),
  deviceHint: document.querySelector("#device-hint"),
  deviceList: document.querySelector("#device-list"),
  deviceListStep: document.querySelector("#device-list-step"),
  deviceName: document.querySelector("#device-name"),
  devicePicker: document.querySelector("#device-picker"),
  dialogError: document.querySelector("#dialog-error"),
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
  dialogResolver: null,
};

elements.devicePicker.addEventListener("click", () => {
  const action = viewState.route.active ? "change" : "start";
  void chooseOutput(action);
});
elements.routeButton.addEventListener("click", () => void toggleRoute());
elements.noticeClose.addEventListener("click", hideNotice);
elements.deviceDialog.addEventListener("close", () => void handleDialogClosed());

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

  try {
    const permissionState = await getOutputPermissionState();
    if (permissionState !== "granted") {
      await openSetupWindow(action);
      return;
    }

    let device;
    if (navigator.mediaDevices?.selectAudioOutput) {
      setWorking(true, "Opening device picker …");
      render();
      device = normalizeDevice(await navigator.mediaDevices.selectAudioOutput());
    } else {
      device = await openDeviceDialog();
    }

    if (!device) return;
    if (!device.deviceId) throw new DOMException("No device selected.", "NotFoundError");

    if (viewState.route.active) {
      const { state } = await sendToWorker(MESSAGE_TYPE.CHANGE_OUTPUT, {
        tabId: viewState.tab.id,
        ...device,
      });
      if (!state.active) throw new Error("The active audio route was stopped.");
      viewState.route = state;
    }

    viewState.device = device;
    await chrome.storage.local.set({ [PREFERRED_OUTPUT_STORAGE_KEY]: device });
    if (!viewState.route.active && action === "start") await startRouting(device);
  } catch (error) {
    const normalized = normalizeError(error, "The output device could not be selected.");
    showNotice(normalized.message);
  } finally {
    setWorking(false);
    render();
  }
}

async function getOutputPermissionState() {
  const permissionName = navigator.mediaDevices?.selectAudioOutput
    ? "speaker-selection"
    : "microphone";
  try {
    return (await navigator.permissions.query({ name: permissionName })).state;
  } catch {
    return "prompt";
  }
}

async function openSetupWindow(action) {
  setWorking(true, "Opening permission window …");
  render();
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
}

async function openDeviceDialog() {
  resetDeviceDialog();
  elements.deviceDialog.showModal();
  const selection = new Promise((resolve) => {
    viewState.dialogResolver = resolve;
  });
  await showAvailableOutputs();
  return selection;
}

async function showAvailableOutputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const outputs = getMeaningfulAudioOutputs(devices);
  elements.deviceList.replaceChildren();
  elements.deviceListStep.hidden = false;

  if (!outputs.length) {
    showDeviceListError("Chrome did not find an audio output device.");
    return;
  }

  outputs.forEach((output, index) => {
    const device = normalizeDevice({
      deviceId: output.deviceId,
      label: output.label || `Audio output ${index + 1}`,
    });
    const button = document.createElement("button");
    button.type = "button";
    button.className = "device-option";
    button.setAttribute("role", "listitem");

    const icon = document.createElement("span");
    icon.className = "device-option__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "◖";

    const copy = document.createElement("span");
    copy.className = "device-option__copy";
    const name = document.createElement("strong");
    name.textContent = device.label;
    const kind = document.createElement("span");
    kind.textContent = "Audio output device";
    copy.append(name, kind);

    const arrow = document.createElement("span");
    arrow.className = "device-option__arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "›";

    button.append(icon, copy, arrow);
    button.addEventListener("click", () => {
      resolveDialog(device);
      elements.deviceDialog.close("selected");
    });
    elements.deviceList.append(button);
  });
}

function resetDeviceDialog() {
  elements.deviceListStep.hidden = true;
  elements.deviceList.replaceChildren();
  showDeviceListError("");
}

function showDeviceListError(message) {
  elements.dialogError.textContent = message;
  elements.dialogError.hidden = !message;
}

function resolveDialog(device) {
  if (!viewState.dialogResolver) return;
  const resolve = viewState.dialogResolver;
  viewState.dialogResolver = null;
  resolve(device);
}

async function handleDialogClosed() {
  const selected = elements.deviceDialog.returnValue === "selected";
  resolveDialog(null);
  if (!selected) await chrome.storage.session.remove(PENDING_OUTPUT_SELECTION_STORAGE_KEY);
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
