import {
  MESSAGE_TARGET,
  MESSAGE_TYPE,
  PENDING_OUTPUT_SELECTION_STORAGE_KEY,
  PREFERRED_OUTPUT_STORAGE_KEY,
  getMeaningfulAudioOutputs,
  normalizeDevice,
  normalizeError,
  normalizePendingOutputSelection,
} from "../shared/utils.js";

const elements = {
  cancelButton: document.querySelector("#cancel-button"),
  deviceList: document.querySelector("#device-list"),
  deviceListStep: document.querySelector("#device-list-step"),
  microphoneSettings: document.querySelector("#microphone-settings"),
  notice: document.querySelector("#notice"),
  noticeText: document.querySelector("#notice-text"),
  permissionButton: document.querySelector("#permission-button"),
  permissionCopy: document.querySelector("#permission-copy"),
  permissionKicker: document.querySelector("#permission-kicker"),
  permissionStep: document.querySelector("#permission-step"),
  privacyPoints: document.querySelector("#privacy-points"),
  returnButton: document.querySelector("#return-button"),
  sourceTitle: document.querySelector("#source-title"),
  successCopy: document.querySelector("#success-copy"),
  successKicker: document.querySelector("#success-kicker"),
  successStep: document.querySelector("#success-step"),
  successTitle: document.querySelector("#success-title"),
};

const setupState = {
  pending: null,
  setupWindowId: null,
  working: false,
  returnTimer: null,
};

elements.cancelButton.addEventListener("click", () => void cancelSetup());
elements.microphoneSettings.addEventListener("click", () => void openExtensionSettings());
elements.permissionButton.addEventListener("click", () => void requestDeviceAccess());
elements.returnButton.addEventListener("click", () => void returnToSource());

void initialize();

async function initialize() {
  try {
    const [stored, currentWindow] = await Promise.all([
      chrome.storage.session.get(PENDING_OUTPUT_SELECTION_STORAGE_KEY),
      chrome.windows.getCurrent(),
    ]);
    setupState.setupWindowId = currentWindow.id;
    setupState.pending = normalizePendingOutputSelection(
      stored[PENDING_OUTPUT_SELECTION_STORAGE_KEY],
    );
    if (!setupState.pending) {
      throw new Error("This device setup request has expired. Open AudioRoute from the source tab again.");
    }

    elements.sourceTitle.textContent = setupState.pending.tabTitle;
    if (!navigator.mediaDevices?.enumerateDevices) {
      throw new Error("This Chrome version cannot list audio output devices for AudioRoute.");
    }

    if (navigator.mediaDevices.selectAudioOutput) {
      configureNativeOutputPicker();
      return;
    }

    const permissionState = await getMicrophonePermissionState();
    if (permissionState === "granted") {
      await showAvailableOutputs();
    } else if (permissionState === "denied") {
      showNotice(
        "Device access is blocked for AudioRoute. Open its Chrome permissions, allow microphone access, then try again.",
      );
      elements.microphoneSettings.hidden = false;
    }
  } catch (error) {
    showFatalError(normalizeError(error, "AudioRoute could not prepare device selection.").message);
  }
}

function configureNativeOutputPicker() {
  elements.permissionKicker.textContent = "Chrome device picker";
  elements.permissionCopy.textContent =
    "Chrome will show its own list of audio outputs in front of this window. AudioRoute receives only the device you choose.";
  elements.privacyPoints.replaceChildren();
  elements.permissionButton.textContent = "Choose output device";
}

async function getMicrophonePermissionState() {
  try {
    return (await navigator.permissions.query({ name: "microphone" })).state;
  } catch {
    return "prompt";
  }
}

async function requestDeviceAccess() {
  if (setupState.working || !setupState.pending) return;
  setWorking(true, "Waiting for Chrome …");
  hideNotice();

  let microphone;
  let selectedDevice = null;
  try {
    if (navigator.mediaDevices.selectAudioOutput) {
      selectedDevice = normalizeDevice(await navigator.mediaDevices.selectAudioOutput());
    } else {
      microphone = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      microphone.getTracks().forEach((track) => track.stop());
      microphone = null;
      await showAvailableOutputs();
    }
  } catch (error) {
    const normalized = normalizeError(error, "Chrome could not make the device list available.");
    const noMicrophone = normalized.code === "NotFoundError";
    showNotice(
      noMicrophone
        ? "Chrome cannot find a microphone to unlock the output list. Check that a microphone is enabled in Windows."
        : normalized.code === "NotAllowedError"
          ? "Chrome blocked or cancelled device access. Allow it in AudioRoute permissions and try again."
          : normalized.message,
    );
    const permissionWasBlocked =
      !navigator.mediaDevices.selectAudioOutput && normalized.code === "NotAllowedError";
    elements.microphoneSettings.hidden = !permissionWasBlocked;
  } finally {
    microphone?.getTracks().forEach((track) => track.stop());
    setWorking(false);
  }

  if (selectedDevice) await applySelection(selectedDevice);
}

async function showAvailableOutputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const outputs = getMeaningfulAudioOutputs(devices);
  elements.deviceList.replaceChildren();

  if (!outputs.length) {
    showNotice("Chrome did not find an audio output device.");
    return;
  }

  for (const [index, output] of outputs.entries()) {
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
    button.addEventListener("click", () => void applySelection(device));
    elements.deviceList.append(button);
  }

  elements.permissionStep.hidden = true;
  elements.deviceListStep.hidden = false;
  elements.deviceList.querySelector("button")?.focus();
}

async function applySelection(device) {
  if (setupState.working || !setupState.pending) return;
  if (!device?.deviceId) {
    showNotice("No output device was selected.");
    return;
  }

  setWorking(true, "Connecting …");
  hideNotice();
  const { tabId, action } = setupState.pending;

  try {
    await chrome.storage.local.set({ [PREFERRED_OUTPUT_STORAGE_KEY]: device });

    if (action === "start") {
      await chrome.storage.session.remove(PENDING_OUTPUT_SELECTION_STORAGE_KEY);
      showSuccess(
        `${device.label} is saved. Return to the source tab, reopen AudioRoute, and choose Start routing.`,
        false,
      );
      return;
    }

    let routeState = null;
    if (action === "change") {
      const result = await sendToWorker(MESSAGE_TYPE.CHANGE_OUTPUT, { tabId, ...device });
      routeState = result.state;
    }

    await chrome.storage.session.remove(PENDING_OUTPUT_SELECTION_STORAGE_KEY);
    showSuccess(
      routeState?.active
        ? `${setupState.pending.tabTitle} is now playing through ${device.label}.`
        : `${device.label} is saved. Reopen AudioRoute on the source tab to start routing.`,
      Boolean(routeState?.active),
    );

    if (routeState?.active) {
      setupState.returnTimer = setTimeout(() => void returnToSource(), 1100);
    }
  } catch (error) {
    await focusSetupWindow();
    await chrome.storage.session.remove(PENDING_OUTPUT_SELECTION_STORAGE_KEY);
    const normalized = normalizeError(error, "The output was saved, but routing could not be started.");
    showNotice(`${device.label} was saved. ${normalized.message}`);
    elements.deviceListStep.hidden = true;
    elements.permissionStep.hidden = true;
    elements.returnButton.hidden = false;
    elements.returnButton.closest("section").hidden = false;
    elements.successCopy.textContent = "Return to the source tab and start routing again.";
    elements.successKicker.textContent = "Destination saved";
    elements.successTitle.textContent = "Output saved";
  } finally {
    setWorking(false);
  }
}

function showSuccess(message, active) {
  hideNotice();
  elements.permissionStep.hidden = true;
  elements.deviceListStep.hidden = true;
  elements.successStep.hidden = false;
  elements.successCopy.textContent = message;
  elements.successKicker.textContent = active ? "Route ready" : "Destination saved";
  elements.successTitle.textContent = active ? "Connected" : "Output saved";
  elements.cancelButton.hidden = true;
  elements.returnButton.focus();
}

async function cancelSetup() {
  clearTimeout(setupState.returnTimer);
  await chrome.storage.session.remove(PENDING_OUTPUT_SELECTION_STORAGE_KEY);
  await returnToSource();
}

async function returnToSource() {
  clearTimeout(setupState.returnTimer);
  const pending = setupState.pending;
  if (!pending) {
    window.close();
    return;
  }

  try {
    await focusSourceTab();
  } catch {
    showNotice("The original source tab is no longer available. You can close this window.");
    return;
  }

  window.close();
}

async function focusSourceTab() {
  const pending = setupState.pending;
  if (!pending) throw new Error("The source tab is no longer available.");
  await chrome.windows.update(pending.windowId, { focused: true });
  await chrome.tabs.update(pending.tabId, { active: true });
}

async function focusSetupWindow() {
  if (!Number.isInteger(setupState.setupWindowId)) return;
  try {
    await chrome.windows.update(setupState.setupWindowId, { focused: true });
  } catch {
    // The user may have closed the setup window while routing was starting.
  }
}

async function openExtensionSettings() {
  if (!setupState.pending) return;
  const origin = `chrome-extension://${chrome.runtime.id}`;
  await chrome.tabs.create({
    windowId: setupState.pending.windowId,
    url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`,
    active: true,
  });
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
  setupState.working = working;
  elements.permissionButton.disabled = working;
  elements.permissionButton.textContent = working
    ? label
    : navigator.mediaDevices?.selectAudioOutput
      ? "Choose output device"
      : "Allow device access";
  for (const button of elements.deviceList.querySelectorAll("button")) {
    button.disabled = working;
  }
}

function showFatalError(message) {
  showNotice(message);
  elements.permissionButton.disabled = true;
  elements.permissionStep.hidden = false;
}

function showNotice(message) {
  elements.noticeText.textContent = message;
  elements.notice.hidden = false;
}

function hideNotice() {
  elements.notice.hidden = true;
  elements.noticeText.textContent = "";
}
