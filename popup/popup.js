import {
  MESSAGE_TARGET,
  MESSAGE_TYPE,
  PENDING_OUTPUT_SELECTION_STORAGE_KEY,
  PREFERRED_AUDIO_SETTINGS_STORAGE_KEY,
  PREFERRED_OUTPUT_STORAGE_KEY,
  defaultAudioSettings,
  formatHost,
  formatVolumePercent,
  getMeaningfulAudioOutputs,
  inactiveRouteState,
  isRestrictedUrl,
  normalizeAudioSettings,
  normalizeDevice,
  normalizeError,
} from "../shared/utils.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const AUDIO_SEND_INTERVAL_MS = 60;

const elements = {
  audioState: document.querySelector("#audio-state"),
  addOutput: document.querySelector("#add-output"),
  balanceSlider: document.querySelector("#balance-slider"),
  balanceValue: document.querySelector("#balance-value"),
  boostWarning: document.querySelector("#boost-warning"),
  delaySlider: document.querySelector("#delay-slider"),
  delayValue: document.querySelector("#delay-value"),
  mixBody: document.querySelector("#mix-body"),
  mixDot: document.querySelector("#mix-dot"),
  mixEmpty: document.querySelector("#mix-empty"),
  mixSummary: document.querySelector("#mix-summary"),
  monoToggle: document.querySelector("#mono-toggle"),
  nightToggle: document.querySelector("#night-toggle"),
  nightWarning: document.querySelector("#night-warning"),
  otherRoutesCount: document.querySelector("#other-routes-count"),
  otherRoutesList: document.querySelector("#other-routes-list"),
  panelMix: document.querySelector("#panel-mix"),
  panelRoute: document.querySelector("#panel-route"),
  panelTabs: document.querySelector("#panel-tabs"),
  removeSecondOutput: document.querySelector("#remove-second-output"),
  secondDeviceHint: document.querySelector("#second-device-hint"),
  secondDeviceName: document.querySelector("#second-device-name"),
  secondMix: document.querySelector("#second-mix"),
  secondOutputNode: document.querySelector("#second-output-node"),
  secondVolumeSlider: document.querySelector("#second-volume-slider"),
  secondVolumeValue: document.querySelector("#second-volume-value"),
  tabMix: document.querySelector("#tab-mix"),
  tabRoute: document.querySelector("#tab-route"),
  tabTabs: document.querySelector("#tab-tabs"),
  tabsCount: document.querySelector("#tabs-count"),
  tabsEmpty: document.querySelector("#tabs-empty"),
  voiceToggle: document.querySelector("#voice-toggle"),
  volumeSlider: document.querySelector("#volume-slider"),
  volumeValue: document.querySelector("#volume-value"),
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

/** Route-level processing versus per-output level and timing. */
const AUDIO_CONTROLS = ["balanceSlider", "monoToggle", "nightToggle", "voiceToggle"];
const SINK_CONTROLS = {
  volumeSlider: 0,
  secondVolumeSlider: 1,
  delaySlider: 1,
};

const viewState = {
  tab: null,
  device: null,
  route: inactiveRouteState(null),
  routes: new Map(),
  audioDefaults: defaultAudioSettings(),
  working: false,
  compatible: true,
  dialogResolver: null,
};

const sendQueues = new Map();
let otherRoutesSignature = "";

elements.devicePicker.addEventListener("click", () => {
  const action = viewState.route.active ? "change" : "start";
  void chooseOutput(action);
});
elements.routeButton.addEventListener("click", () => void toggleRoute());
elements.noticeClose.addEventListener("click", hideNotice);
elements.deviceDialog.addEventListener("close", () => void handleDialogClosed());

for (const key of AUDIO_CONTROLS) {
  elements[key].addEventListener("input", handleAudioInput);
  elements[key].addEventListener("change", handleAudioCommit);
}

for (const [key, index] of Object.entries(SINK_CONTROLS)) {
  elements[key].addEventListener("input", () => handleSinkInput(index));
  elements[key].addEventListener("change", () => handleSinkInput(index));
}

/** WAI-ARIA tabs: roving tabindex, arrows to move, Home/End to jump. */
const TABS = [
  { tab: "tabRoute", panel: "panelRoute" },
  { tab: "tabMix", panel: "panelMix" },
  { tab: "tabTabs", panel: "panelTabs" },
];

function selectTab(index, { focus = false } = {}) {
  TABS.forEach((entry, position) => {
    const selected = position === index;
    const tab = elements[entry.tab];
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    elements[entry.panel].hidden = !selected;
    if (selected && focus) tab.focus();
  });
}

TABS.forEach((entry, index) => {
  const tab = elements[entry.tab];
  tab.addEventListener("click", () => selectTab(index));
  tab.addEventListener("keydown", (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step) {
      event.preventDefault();
      selectTab((index + step + TABS.length) % TABS.length, { focus: true });
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      selectTab(event.key === "Home" ? 0 : TABS.length - 1, { focus: true });
    }
  });
});

elements.addOutput.addEventListener("click", () => void addSecondOutput());
elements.removeSecondOutput.addEventListener("click", () => void removeSecondOutput());

chrome.runtime.onMessage.addListener((message) => {
  if (message?.target !== MESSAGE_TARGET.POPUP) return;
  if (message.type !== MESSAGE_TYPE.ROUTE_STATE_CHANGED) return;

  const state = message.state;
  if (!state || !Number.isInteger(state.tabId)) return;

  if (state.tabId !== viewState.tab?.id) {
    if (state.active) viewState.routes.set(state.tabId, state);
    else viewState.routes.delete(state.tabId);
    renderOtherRoutes();
    return;
  }

  viewState.route = state;
  render();

  if (state.reason === "device-disconnected") {
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
      chrome.storage.local.get([
        PREFERRED_OUTPUT_STORAGE_KEY,
        PREFERRED_AUDIO_SETTINGS_STORAGE_KEY,
      ]),
    ]);

    viewState.tab = tab;
    viewState.device = normalizeDevice(stored[PREFERRED_OUTPUT_STORAGE_KEY]);

    // Processing choices are remembered; volume is per output and always
    // starts at 1 so a boost cannot carry over to the next tab.
    viewState.audioDefaults = normalizeAudioSettings(stored[PREFERRED_AUDIO_SETTINGS_STORAGE_KEY]);

    const [{ state }, { routes }] = await Promise.all([
      sendToWorker(MESSAGE_TYPE.GET_ROUTE_STATE, { tabId: tab.id }),
      sendToWorker(MESSAGE_TYPE.LIST_ROUTES),
    ]);
    viewState.route = state;

    viewState.routes.clear();
    for (const route of routes) {
      if (route.tabId !== tab.id) viewState.routes.set(route.tabId, route);
    }

    if (state.active) {
      viewState.device = {
        deviceId: state.deviceId,
        label: state.deviceLabel,
      };

      // The popup opening on a routed tab is the one moment a fresh title is
      // available — the tabs permission would be needed to read it otherwise.
      if (tab.title && tab.title !== state.tabTitle) {
        const updated = await sendToWorker(MESSAGE_TYPE.UPDATE_ROUTE, {
          tabId: tab.id,
          tabTitle: tab.title,
          tabHost: formatHost(tab.url),
        });
        if (updated.state?.active) viewState.route = updated.state;
      }
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
    const permissionState = await getMicrophonePermissionState();
    if (permissionState !== "granted") {
      await openSetupWindow(action);
      return;
    }

    const device = await openDeviceDialog();

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

async function getMicrophonePermissionState() {
  try {
    return (await navigator.permissions.query({ name: "microphone" })).state;
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
      tabTitle: viewState.tab.title,
      tabHost: formatHost(viewState.tab.url),
      audio: viewState.audioDefaults,
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

  const sinks = route.sinks ?? [];
  const second = sinks[1];

  elements.mixEmpty.hidden = active;
  elements.mixBody.hidden = !active;
  // No route, no mix to summarise.
  elements.mixSummary.hidden = !active;
  elements.secondMix.hidden = !second;
  elements.secondOutputNode.hidden = !second;
  elements.addOutput.hidden = !active || Boolean(second) || blocked;

  if (second) {
    elements.secondDeviceName.textContent = second.deviceLabel || "Second device";
    elements.secondDeviceHint.textContent = second.delayMs
      ? "Playing in parallel \u00b7 delayed " + second.delayMs + " ms"
      : "Playing in parallel";
  }

  if (active) applyMixControls(route);

  // A dot on the Mix tab so a non-default mix is visible without opening it.
  const audio = normalizeAudioSettings(route.audio);
  const primaryVolume = sinks[0]?.volume ?? 1;
  elements.mixDot.hidden = !(
    active &&
    (audio.mono || audio.night || audio.voice || audio.balance !== 0 || primaryVolume !== 1)
  );

  renderOtherRoutes();

  if (restricted && !elements.notice.hidden) return;
  if (restricted) {
    showNotice("Chrome system pages cannot be routed. Switch to a regular web tab.");
  }
}

function handleAudioInput() {
  const audio = readAudioControls();
  updateMixLabels();
  if (!viewState.route.active) return;

  viewState.route = { ...viewState.route, audio };
  queueSend("audio", sendAudioUpdate);
}

function handleAudioCommit() {
  handleAudioInput();
  void persistAudioPreferences(readAudioControls());
}

function handleSinkInput(index) {
  updateMixLabels();
  if (!viewState.route.sinks?.[index]) return;
  queueSend("sink-" + index, () => sendSinkUpdate(index));
}

function readAudioControls() {
  return normalizeAudioSettings({
    balance: Number(elements.balanceSlider.value) / 100,
    mono: elements.monoToggle.checked,
    night: elements.nightToggle.checked,
    voice: elements.voiceToggle.checked,
  });
}

function readSinkControls(index) {
  return index === 0
    ? { volume: Number(elements.volumeSlider.value) / 100 }
    : {
        volume: Number(elements.secondVolumeSlider.value) / 100,
        delayMs: Number(elements.delaySlider.value),
      };
}

function applyMixControls(route) {
  // Never fight the control the user is holding.
  if (isMixControlFocused()) return;

  const audio = normalizeAudioSettings(route.audio);
  elements.balanceSlider.value = String(Math.round(audio.balance * 100));
  elements.monoToggle.checked = audio.mono;
  elements.nightToggle.checked = audio.night;
  elements.voiceToggle.checked = audio.voice;

  const [primary, second] = route.sinks ?? [];
  if (primary) elements.volumeSlider.value = String(Math.round(primary.volume * 100));
  if (second) {
    elements.secondVolumeSlider.value = String(Math.round(second.volume * 100));
    elements.delaySlider.value = String(second.delayMs);
  }

  updateMixLabels();
}

function isMixControlFocused() {
  const active = document.activeElement;
  return [...AUDIO_CONTROLS, ...Object.keys(SINK_CONTROLS)].some((key) => elements[key] === active);
}

function updateMixLabels() {
  const audio = readAudioControls();
  const primaryVolume = Number(elements.volumeSlider.value) / 100;
  const percent = formatVolumePercent(primaryVolume);
  const balance = formatBalance(audio.balance);

  elements.volumeValue.textContent = percent;
  elements.volumeSlider.setAttribute("aria-valuetext", Math.round(primaryVolume * 100) + " percent");
  elements.boostWarning.hidden = primaryVolume <= 1;

  elements.balanceValue.textContent = balance;
  elements.balanceSlider.setAttribute("aria-valuetext", balance);

  // The one impact worth naming: the compressor's lookahead is unavoidable.
  elements.nightWarning.hidden = !audio.night;

  const secondVolume = Number(elements.secondVolumeSlider.value) / 100;
  const delayMs = Number(elements.delaySlider.value);
  elements.secondVolumeValue.textContent = formatVolumePercent(secondVolume);
  elements.secondVolumeSlider.setAttribute(
    "aria-valuetext",
    Math.round(secondVolume * 100) + " percent",
  );
  elements.delayValue.textContent = delayMs + " ms";
  elements.delaySlider.setAttribute("aria-valuetext", delayMs + " milliseconds");

  const flags = [audio.mono ? "Mono" : "Stereo"];
  if (audio.night) flags.push("Night");
  if (audio.voice) flags.push("Voice");
  elements.mixSummary.textContent = percent + " \u00b7 " + flags.join(" \u00b7 ");
}

function formatBalance(balance) {
  const amount = Math.round(Math.abs(balance) * 100);
  if (!amount) return "Center";
  return amount + "% " + (balance < 0 ? "left" : "right");
}

/** Rate-limited so a slider drag cannot flood two IPC hops. */
function queueSend(key, send) {
  const entry = sendQueues.get(key) ?? { timer: null, pending: false };
  sendQueues.set(key, entry);

  if (entry.timer) {
    entry.pending = true;
    return;
  }

  void send();
  entry.timer = setTimeout(() => {
    entry.timer = null;
    if (!entry.pending) return;
    entry.pending = false;
    queueSend(key, send);
  }, AUDIO_SEND_INTERVAL_MS);
}

async function sendAudioUpdate() {
  if (!viewState.route.active || !viewState.tab) return;

  try {
    await sendToWorker(MESSAGE_TYPE.UPDATE_ROUTE, {
      tabId: viewState.tab.id,
      audio: readAudioControls(),
    });
  } catch {
    // A route that ended mid-drag is reported through the state broadcast.
  }
}

async function sendSinkUpdate(index) {
  const sink = viewState.route.sinks?.[index];
  if (!sink || !viewState.tab) return;

  try {
    await sendToWorker(MESSAGE_TYPE.UPDATE_SINK, {
      tabId: viewState.tab.id,
      sinkId: sink.id,
      ...readSinkControls(index),
    });
  } catch {
    // Same as above.
  }
}

async function persistAudioPreferences(audio) {
  try {
    await chrome.storage.local.set({ [PREFERRED_AUDIO_SETTINGS_STORAGE_KEY]: audio });
  } catch {
    // Storage failures must not interrupt playback.
  }
}

async function addSecondOutput() {
  if (viewState.working || !viewState.tab || !viewState.route.active) return;
  hideNotice();

  try {
    const device = await openDeviceDialog();
    if (!device?.deviceId) return;

    setWorking(true, "Adding output \u2026");
    const { state } = await sendToWorker(MESSAGE_TYPE.ADD_SINK, {
      tabId: viewState.tab.id,
      deviceId: device.deviceId,
      deviceLabel: device.label,
    });
    viewState.route = state;
  } catch (error) {
    showNotice(normalizeError(error, "The second output could not be added.").message);
  } finally {
    setWorking(false);
    render();
  }
}

async function removeSecondOutput() {
  const sink = viewState.route.sinks?.[1];
  if (!sink || !viewState.tab) return;
  hideNotice();

  try {
    setWorking(true, "Removing output \u2026");
    const { state } = await sendToWorker(MESSAGE_TYPE.REMOVE_SINK, {
      tabId: viewState.tab.id,
      sinkId: sink.id,
    });
    viewState.route = state;
  } catch (error) {
    showNotice(normalizeError(error, "The second output could not be removed.").message);
  } finally {
    setWorking(false);
    render();
  }
}

function renderOtherRoutes() {
  const routes = [...viewState.routes.values()]
    .filter((route) => route.active && route.tabId !== viewState.tab?.id)
    .sort((left, right) => (left.startedAt ?? 0) - (right.startedAt ?? 0));

  const count = routes.length ? String(routes.length) : "";
  elements.otherRoutesCount.textContent = count;
  elements.tabsCount.textContent = count;
  elements.tabsCount.hidden = routes.length === 0;
  elements.tabsEmpty.hidden = routes.length > 0;

  // Rebuilding on every render would drop focus out of a row mid-interaction.
  const signature = routes
    .map((route) => `${route.tabId}:${route.deviceId}:${route.tabHost}:${route.tabTitle}`)
    .join("|");
  if (signature === otherRoutesSignature) return;
  otherRoutesSignature = signature;

  elements.otherRoutesList.replaceChildren(...routes.map(createRouteRow));
}

function createRouteRow(route) {
  const row = document.createElement("div");
  row.className = "route-row";
  row.setAttribute("role", "listitem");

  const open = document.createElement("button");
  open.type = "button";
  open.className = "route-row__open";

  const host = document.createElement("strong");
  host.textContent = route.tabHost || "Routed tab";
  const meta = document.createElement("span");
  meta.textContent = [route.tabTitle, route.deviceLabel].filter(Boolean).join(" · ");
  open.append(host, meta);
  open.title = `Switch to ${host.textContent}`;
  open.addEventListener("click", () => void focusRoutedTab(route.tabId));

  const stop = document.createElement("button");
  stop.type = "button";
  stop.className = "route-row__stop";
  stop.title = `Stop routing ${host.textContent}`;
  stop.setAttribute("aria-label", stop.title);

  const icon = document.createElementNS(SVG_NS, "svg");
  icon.setAttribute("viewBox", "0 0 20 20");
  const square = document.createElementNS(SVG_NS, "rect");
  square.setAttribute("x", "5");
  square.setAttribute("y", "5");
  square.setAttribute("width", "10");
  square.setAttribute("height", "10");
  square.setAttribute("rx", "2");
  icon.append(square);
  stop.append(icon);
  stop.addEventListener("click", () => void stopOtherRoute(route.tabId));

  row.append(open, stop);
  return row;
}

async function stopOtherRoute(tabId) {
  try {
    await sendToWorker(MESSAGE_TYPE.STOP_ROUTE, { tabId });
  } catch (error) {
    showNotice(normalizeError(error, "Routing could not be stopped.").message);
  }

  viewState.routes.delete(tabId);
  renderOtherRoutes();

  const next = elements.otherRoutesList.querySelector(".route-row__open");
  if (next) next.focus();
  else elements.tabTabs.focus();
}

async function focusRoutedTab(tabId) {
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (Number.isInteger(tab?.windowId)) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    window.close();
  } catch {
    showNotice("That tab is no longer available.");
    viewState.routes.delete(tabId);
    renderOtherRoutes();
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
