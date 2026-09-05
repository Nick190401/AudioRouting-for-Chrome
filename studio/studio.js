import {
  MESSAGE_TARGET,
  MESSAGE_TYPE,
  PENDING_OUTPUT_SELECTION_STORAGE_KEY,
  getMeaningfulAudioOutputs,
  normalizeError,
} from "../shared/utils.js";
import { STUDIO_MESSAGE } from "../shared/studio.js";

const elements = Object.fromEntries([
  "connection", "save-scene", "scene-select", "apply-scene", "scene-actions", "scene-hint",
  "update-scene", "rename-scene", "duplicate-scene", "delete-scene", "focus-enabled", "focus-status",
  "notice", "notice-text", "dismiss-notice", "channel-count", "empty-state", "channels",
  "scene-dialog", "scene-form", "scene-dialog-title", "scene-name", "scene-labels", "scene-error",
  "scene-submit", "scene-save-hint", "recall-dialog", "recall-title", "recall-form", "recall-channels",
  "recall-error", "recall-submit", "output-dialog", "output-title", "output-hint", "outputs",
  "output-error", "device-setup", "delete-dialog", "delete-form", "delete-copy", "delete-submit",
].map((id) => [id, document.getElementById(id)]));

const channels = new Map();
const retiredEpochs = new Set();
const pendingControls = new Map();
let state = null;
let scenes = [];
let port = null;
let reconnectTimer = null;
let reconnectDelay = 500;
let sceneEdit = null;
let recall = null;
let outputEdit = null;
let sceneListRequest = 0;
let lastLevelAt = 0;
let closing = false;
let recallRouteSignature = "";
let stateVersion = 0;

elements["dismiss-notice"].addEventListener("click", () => { elements.notice.hidden = true; });
elements["focus-enabled"].addEventListener("change", () => {
  void perform(elements["focus-enabled"], async () => {
    await command(STUDIO_MESSAGE.UPDATE_FOCUS, { enabled: elements["focus-enabled"].checked });
  });
});
elements["scene-select"].addEventListener("change", renderSceneControls);
elements["save-scene"].addEventListener("click", () => openSceneEditor("save"));
elements["update-scene"].addEventListener("click", () => openSceneEditor("update"));
elements["rename-scene"].addEventListener("click", () => openSceneEditor("rename"));
elements["duplicate-scene"].addEventListener("click", () => openSceneEditor("duplicate"));
elements["delete-scene"].addEventListener("click", () => {
  const scene = selectedScene();
  if (!scene) return;
  elements["delete-dialog"].dataset.sceneId = scene.id;
  elements["delete-copy"].textContent = `Delete “${scene.name}” from this device? Your current mix keeps playing.`;
  elements["delete-dialog"].showModal();
});
elements["delete-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  void perform(elements["delete-submit"], async () => {
    const response = await request(STUDIO_MESSAGE.DELETE_SCENE, { sceneId: elements["delete-dialog"].dataset.sceneId });
    renderScenes(response.scenes);
    elements["delete-dialog"].close();
    notice("Scene deleted.");
  });
});
elements["scene-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  void saveScene();
});
elements["apply-scene"].addEventListener("click", () => void perform(elements["apply-scene"], openRecall));
elements["recall-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  void applyRecall();
});
elements["device-setup"].addEventListener("click", () => void perform(elements["device-setup"], openDeviceSetup, elements["output-error"]));
for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => elements[button.dataset.close].close());
}
elements["recall-dialog"].addEventListener("close", () => { recall = null; });
elements["output-dialog"].addEventListener("close", () => { outputEdit = null; });
document.addEventListener("visibilitychange", () => {
  sendVisibility();
  if (!document.hidden) void refresh().catch((error) => notice(error.message, true));
  else clearMeters();
});
window.addEventListener("pagehide", () => {
  closing = true;
  clearTimeout(reconnectTimer);
  port?.disconnect();
});
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") void refreshScenes().catch((error) => notice(error.message, true));
});
navigator.mediaDevices?.addEventListener("devicechange", () => {
  if (recall && elements["recall-dialog"].open) void refreshPreview();
  if (outputEdit && elements["output-dialog"].open) void listOutputs();
});

connect();
setInterval(() => {
  if (performance.now() - lastLevelAt > 500) clearMeters();
}, 250);

async function request(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ target: MESSAGE_TARGET.WORKER, type, ...payload });
  if (!response?.ok) {
    const error = new Error(response?.error?.message || "AudioRoute could not complete this request.");
    error.name = response?.error?.code || "StudioError";
    throw error;
  }
  return response;
}

async function command(type, payload) {
  const response = await request(type, payload);
  if (Array.isArray(response.state?.routes)) receiveState(response.state);
  else await refresh();
  return response;
}

async function refresh() {
  const startedAt = stateVersion;
  const response = await request(STUDIO_MESSAGE.GET_STATE);
  if (startedAt === stateVersion) receiveState(response.state, true);
}

function connect() {
  if (closing) return;
  clearTimeout(reconnectTimer);
  const current = chrome.runtime.connect({ name: "audio-route-studio" });
  port = current;
  current.onMessage.addListener((message) => {
    if (port !== current) return;
    if (message?.type === "studio-state-changed") receiveState(message.state);
    if (message?.type === "studio-levels") receiveLevels(message.levels);
  });
  current.onDisconnect.addListener(() => {
    // Reading lastError consumes Chrome's diagnostic for a terminated worker.
    void chrome.runtime.lastError;
    if (port !== current || closing) return;
    port = null;
    clearMeters();
    elements.connection.textContent = "Reconnecting…";
    elements.connection.dataset.live = "false";
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(8000, reconnectDelay * 2);
  });
  sendVisibility();
  void Promise.all([refresh(), refreshScenes()]).catch((error) => notice(error.message, true));
}

function sendVisibility() {
  try { port?.postMessage({ type: "visibility", visible: !document.hidden }); }
  catch { /* The disconnect handler reconnects with a fresh snapshot. */ }
}

function receiveState(next, authoritative = false) {
  if (!next || !Array.isArray(next.routes) || !Number.isInteger(next.revision) || typeof next.epoch !== "string") return;
  if (retiredEpochs.has(next.epoch) && !(authoritative && next.epoch === "idle")) return;
  if (state?.epoch === next.epoch && state.revision > next.revision) return;
  if (state && state.epoch !== next.epoch) retiredEpochs.add(state.epoch);
  state = next;
  const recovery = next.recoveries?.find((entry) => entry.error?.message);
  if (recovery) notice(recovery.error.message, true);
  stateVersion += 1;
  reconnectDelay = 500;
  elements.connection.textContent = "Connected";
  elements.connection.dataset.live = "true";
  elements["channel-count"].textContent = `${next.routes.length} ${next.routes.length === 1 ? "channel" : "channels"}`;
  elements["empty-state"].hidden = next.routes.length > 0;
  const ids = new Set(next.routes.map((route) => route.tabId));
  for (const [tabId, channel] of channels) {
    if (ids.has(tabId)) continue;
    channel.element.remove();
    channels.delete(tabId);
  }
  next.routes.forEach((route, index) => {
    let channel = channels.get(route.tabId);
    if (!channel) {
      channel = createChannel(route.tabId);
      channels.set(route.tabId, channel);
      elements.channels.append(channel.element);
    }
    updateChannel(channel, route, index);
  });
  syncInput(elements["focus-enabled"], next.focus?.enabled === true);
  elements["focus-enabled"].disabled = !next.routes.length || elements["focus-enabled"].dataset.pending === "true";
  const priority = next.routes.find((route) => route.tabId === next.focus?.priorityTabId);
  elements["focus-status"].textContent = !next.focus?.enabled
    ? "Let one tab take the lead."
    : next.focus.active ? "Priority is playing. Other tabs are lowered."
      : priority ? "Listening for your priority channel." : "Choose a priority channel below.";
  renderSceneControls();
  const routeSignature = JSON.stringify(next.routes.map((route) => [route.tabId, route.siteHost, route.active, route.suspended, route.sinks?.map((sink) => sink.deviceId)]));
  if (recall && !recall.applying && recallRouteSignature !== routeSignature) void refreshPreview();
  recallRouteSignature = routeSignature;
}

function createChannel(tabId) {
  const element = node("article", "channel");
  const header = node("div", "channel-header");
  const number = node("span", "channel-number");
  const titleGroup = node("div", "channel-title");
  const title = node("h3");
  const host = node("span", "channel-host");
  titleGroup.append(title, host);
  const stop = button("×", "icon-button", () => void perform(stop, () => command(MESSAGE_TYPE.STOP_ROUTE, { tabId })));
  stop.setAttribute("aria-label", "Disconnect channel");
  stop.title = "Disconnect this tab and restore normal playback";
  header.append(number, titleGroup, stop);
  const actions = node("div", "channel-actions");
  const mute = button("Mute", "toggle-button", () => void perform(mute, () => command(STUDIO_MESSAGE.UPDATE_MIX, { tabId, muted: !routeFor(tabId)?.muted })));
  const solo = button("Solo", "toggle-button", () => void perform(solo, () => command(STUDIO_MESSAGE.UPDATE_MIX, { tabId, solo: state?.soloTabId !== tabId })));
  const priority = button("Priority", "toggle-button", () => void perform(priority, () => command(STUDIO_MESSAGE.UPDATE_FOCUS, { priorityTabId: state?.focus?.priorityTabId === tabId ? null : tabId })));
  priority.dataset.action = "priority";
  actions.append(mute, solo, priority);
  const status = node("p", "channel-status");
  const sinksElement = node("div");
  const add = button("+ Add second output", "text-button add-output", () => void openOutput(tabId, null));
  const processing = node("details", "processing");
  processing.append(node("summary", "", "Sound settings"));
  const body = node("div", "processing-body");
  const balance = slider(`balance-${tabId}`, "Balance", -100, 100, 5, (value) => sendControl(`audio:${tabId}:balance`, MESSAGE_TYPE.UPDATE_ROUTE, { tabId, audio: { balance: value / 100 } }), balanceLabel);
  body.append(balance.element);
  const toggles = {};
  for (const [key, label] of [["mono", "Mono · merge both channels"], ["night", "Night mode · even out loud and quiet"], ["voice", "Voice clarity · bring speech forward"]]) {
    const row = node("label", "check-row");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener("change", () => void perform(input, () => command(MESSAGE_TYPE.UPDATE_ROUTE, { tabId, audio: { [key]: input.checked } })));
    row.append(input, document.createTextNode(label));
    toggles[key] = input;
    body.append(row);
  }
  body.append(node("p", "hint", "Night mode adds 6 ms of latency. Delay the faster output to align two devices."));
  processing.append(body);
  element.append(header, actions, status, sinksElement, add, processing);
  return { element, number, title, host, stop, mute, solo, priority, status, sinksElement, sinks: new Map(), add, balance, toggles };
}

function updateChannel(channel, route, index) {
  channel.number.textContent = String(index + 1).padStart(2, "0");
  channel.title.textContent = route.tabTitle || route.siteHost || "Connected tab";
  channel.title.title = channel.title.textContent;
  channel.host.textContent = route.siteHost || route.tabHost || "Local tab";
  channel.stop.setAttribute("aria-label", `Disconnect ${channel.title.textContent}`);
  channel.mute.setAttribute("aria-pressed", String(route.muted === true));
  channel.solo.setAttribute("aria-pressed", String(state.soloTabId === route.tabId));
  channel.priority.setAttribute("aria-pressed", String(state.focus?.priorityTabId === route.tabId));
  channel.status.textContent = route.suspended ? "Paused for fullscreen · your mix will return"
    : route.muted ? "Muted" : route.effectiveMuted ? "Quiet while another channel is solo"
      : route.ducked ? "Lowered by Smart Focus" : route.meterError ? "Audio is routed · live meter unavailable" : "Playing through your selected outputs";
  channel.status.dataset.ducked = String(route.ducked === true && !route.effectiveMuted);
  const sinkIds = new Set((route.sinks || []).map((sink) => sink.id));
  for (const [id, sink] of channel.sinks) {
    if (sinkIds.has(id)) continue;
    sink.element.remove();
    channel.sinks.delete(id);
  }
  for (const sink of route.sinks || []) {
    let view = channel.sinks.get(sink.id);
    if (!view) {
      view = createSink(route.tabId, sink.id);
      channel.sinks.set(sink.id, view);
      channel.sinksElement.append(view.element);
    }
    view.device.textContent = sink.deviceLabel || "Audio output";
    view.change.title = `Change ${view.device.textContent}`;
    view.meter.setAttribute("aria-label", `${view.device.textContent} audio level`);
    view.volume.input.setAttribute("aria-label", `${view.device.textContent} volume`);
    view.delay.input.setAttribute("aria-label", `${view.device.textContent} delay`);
    view.remove.setAttribute("aria-label", `Remove ${view.device.textContent}`);
    view.remove.hidden = route.sinks.length < 2;
    view.boost.hidden = sink.volume <= 1;
    syncSlider(view.volume, Math.round(sink.volume * 100));
    syncSlider(view.delay, sink.delayMs || 0);
    view.change.disabled = route.suspended === true || view.change.dataset.pending === "true";
    view.volume.input.disabled = route.suspended === true;
    view.delay.input.disabled = route.suspended === true;
    view.remove.disabled = route.suspended === true || view.remove.dataset.pending === "true";
  }
  channel.add.hidden = (route.sinks?.length || 0) >= 2;
  channel.add.disabled = route.suspended === true;
  syncSlider(channel.balance, Math.round((route.audio?.balance || 0) * 100));
  channel.balance.input.disabled = route.suspended === true;
  for (const [key, input] of Object.entries(channel.toggles)) {
    syncInput(input, route.audio?.[key] === true);
    input.disabled = route.suspended === true || input.dataset.pending === "true";
  }
}

function createSink(tabId, sinkId) {
  const element = node("div", "sink");
  const heading = node("div", "sink-heading");
  const change = button("", "device-button", () => void openOutput(tabId, sinkId));
  const device = node("span");
  change.append(device);
  const remove = button("×", "icon-button", () => void perform(remove, () => command(MESSAGE_TYPE.REMOVE_SINK, { tabId, sinkId })));
  heading.append(change, remove);
  const meter = document.createElement("meter");
  meter.className = "sink-meter";
  meter.min = 0;
  meter.max = 60;
  meter.low = 48;
  meter.high = 57;
  meter.optimum = 20;
  meter.value = 0;
  const key = `sink:${tabId}:${sinkId}`;
  const volume = slider(`volume-${tabId}-${sinkId}`, "Volume", 0, 200, 5, (value) => sendControl(`${key}:volume`, MESSAGE_TYPE.UPDATE_SINK, { tabId, sinkId, volume: value / 100 }), (value) => `${value}%`);
  const delay = slider(`delay-${tabId}-${sinkId}`, "Delay", 0, 250, 5, (value) => sendControl(`${key}:delay`, MESSAGE_TYPE.UPDATE_SINK, { tabId, sinkId, delayMs: value }), (value) => `${value} ms`);
  const boost = node("p", "hint boost-hint", "Boost active · peaks are softened. Scenes restore up to 100%.");
  boost.hidden = true;
  element.append(heading, meter, volume.element, boost, delay.element);
  return { element, change, device, remove, meter, volume, delay, boost };
}

function slider(id, labelText, min, max, step, onInput, format) {
  const element = node("div", "slider-row");
  const label = node("label", "", labelText);
  label.htmlFor = id;
  const input = document.createElement("input");
  Object.assign(input, { type: "range", id, min, max, step });
  const output = document.createElement("output");
  output.htmlFor = id;
  input.addEventListener("input", () => {
    const value = Number(input.value);
    output.textContent = format(value);
    input.setAttribute("aria-valuetext", format(value));
    onInput(value);
  });
  input.addEventListener("blur", () => {
    if (state) receiveState(state);
  });
  element.append(label, input, output);
  return { element, input, output, format };
}

function syncInput(input, value) {
  if (input.type === "checkbox") input.checked = value;
  else input.value = String(value);
}

function syncSlider(control, value) {
  if (control.input === document.activeElement) return;
  control.input.value = String(value);
  control.output.textContent = control.format(value);
  control.input.setAttribute("aria-valuetext", control.format(value));
}

function sendControl(key, type, payload) {
  const previous = pendingControls.get(key);
  if (previous) { previous.payload = payload; return; }
  const entry = { payload };
  pendingControls.set(key, entry);
  void (async () => {
    try {
      while (entry.payload) {
        const latest = entry.payload;
        entry.payload = null;
        await command(type, latest);
        await new Promise((resolve) => setTimeout(resolve, 70));
      }
    } catch (error) {
      notice(normalizeError(error).message, true);
      await refresh().catch(() => {});
    } finally { pendingControls.delete(key); }
  })();
}

function receiveLevels(levels) {
  if (!Array.isArray(levels) || document.hidden) return;
  lastLevelAt = performance.now();
  for (const level of levels) {
    const meter = channels.get(level.tabId)?.sinks.get(level.sinkId)?.meter;
    if (!meter || !Number.isFinite(level.rms)) continue;
    meter.value = level.rms > 0 ? Math.max(0, Math.min(60, 60 + 20 * Math.log10(level.rms))) : 0;
  }
}

function clearMeters() {
  for (const channel of channels.values()) {
    for (const sink of channel.sinks.values()) sink.meter.value = 0;
  }
}

async function refreshScenes() {
  const revision = ++sceneListRequest;
  const response = await request(STUDIO_MESSAGE.LIST_SCENES);
  if (revision === sceneListRequest) renderScenes(response.scenes);
}

function renderScenes(next = [], selectedId = elements["scene-select"].value) {
  sceneListRequest += 1;
  scenes = next;
  const options = scenes.map((scene) => new Option(scene.name, scene.id));
  if (!options.length) options.push(new Option("No saved scenes", ""));
  elements["scene-select"].replaceChildren(...options);
  if (scenes.some((scene) => scene.id === selectedId)) elements["scene-select"].value = selectedId;
  renderSceneControls();
}

function renderSceneControls() {
  const scene = selectedScene();
  elements["scene-select"].disabled = !scenes.length;
  elements["scene-actions"].hidden = !scene;
  elements["apply-scene"].disabled = !scene || elements["apply-scene"].dataset.pending === "true";
  elements["save-scene"].disabled = !state?.routes?.length || scenes.length >= 20 || elements["save-scene"].dataset.pending === "true";
  elements["update-scene"].disabled = !state?.routes?.length || elements["update-scene"].dataset.pending === "true";
  elements["duplicate-scene"].disabled = scenes.length >= 20 || elements["duplicate-scene"].dataset.pending === "true";
  elements["scene-hint"].textContent = scene
    ? `${scene.slots.length} saved ${scene.slots.length === 1 ? "channel" : "channels"} · Recall when your tabs are connected.`
    : "Save your outputs and sound settings for next time.";
}

function selectedScene() { return scenes.find((scene) => scene.id === elements["scene-select"].value); }
function routeFor(tabId) { return state?.routes?.find((route) => route.tabId === tabId); }

function openSceneEditor(mode) {
  const scene = selectedScene();
  if (mode !== "save" && !scene) return;
  sceneEdit = { mode, sceneId: mode === "save" ? undefined : scene.id };
  elements["scene-dialog-title"].textContent = { save: "Save sound scene", update: "Update saved mix", rename: "Rename scene", duplicate: "Duplicate scene" }[mode];
  elements["scene-submit"].textContent = { save: "Save scene", update: "Update scene", rename: "Rename", duplicate: "Create copy" }[mode];
  elements["scene-name"].value = mode === "save" ? "" : mode === "duplicate" ? `${scene.name} copy`.slice(0, 80) : scene.name;
  elements["scene-error"].hidden = true;
  elements["scene-labels"].replaceChildren();
  if (mode === "save" || mode === "update") {
    const savedLabels = new Map();
    if (mode === "update") {
      for (const slot of scene.slots) savedLabels.set(slot.siteHost, [...(savedLabels.get(slot.siteHost) || []), slot.label]);
    }
    (state?.routes || []).filter((route) => route.active).forEach((route, index) => {
      const label = node("label", "field-label", `Label for ${route.siteHost || "local tab"}`);
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 80;
      input.required = true;
      input.id = `scene-label-${route.tabId}`;
      input.dataset.tabId = String(route.tabId);
      input.value = savedLabels.get(route.siteHost)?.shift() || `Channel ${index + 1}`;
      label.htmlFor = input.id;
      elements["scene-labels"].append(label, input);
    });
  }
  elements["scene-save-hint"].hidden = mode === "rename";
  elements["scene-dialog"].showModal();
  elements["scene-name"].focus();
}

async function saveScene() {
  if (!sceneEdit) return;
  await perform(elements["scene-submit"], async () => {
    const edit = sceneEdit;
    const name = elements["scene-name"].value.trim();
    if (!name) throw new Error("Enter a scene name.");
    const type = edit.mode === "rename" ? STUDIO_MESSAGE.RENAME_SCENE : edit.mode === "duplicate" ? STUDIO_MESSAGE.DUPLICATE_SCENE : STUDIO_MESSAGE.SAVE_SCENE;
    const labels = Object.fromEntries([...elements["scene-labels"].querySelectorAll("input")].map((input) => [input.dataset.tabId, input.value.trim()]));
    const response = await request(type, { name, ...(edit.sceneId ? { sceneId: edit.sceneId } : {}), ...(type === STUDIO_MESSAGE.SAVE_SCENE ? { labels } : {}) });
    renderScenes(response.scenes, response.scene?.id || edit.sceneId);
    elements["scene-dialog"].close();
    notice(edit.mode === "update" ? "Scene updated with your current mix." : edit.mode === "rename" ? "Scene renamed." : "Scene saved on this device.");
  }, elements["scene-error"]);
}

async function openRecall() {
  const scene = selectedScene();
  if (!scene) return;
  recall = { sceneId: scene.id, assignments: {}, sequence: 0, views: new Map() };
  elements["recall-title"].textContent = `Recall ${scene.name}`;
  elements["recall-error"].hidden = true;
  elements["recall-channels"].replaceChildren();
  elements["recall-submit"].disabled = true;
  elements["recall-dialog"].showModal();
  await refreshPreview();
}

async function refreshPreview() {
  if (!recall) return;
  const current = recall;
  const sequence = ++current.sequence;
  elements["recall-submit"].disabled = true;
  try {
    const { preview } = await request(STUDIO_MESSAGE.PREVIEW_SCENE, { sceneId: current.sceneId, assignments: current.assignments });
    if (current !== recall || sequence !== current.sequence) return;
    elements["recall-error"].hidden = true;
    renderPreview(preview, current);
  } catch (error) {
    if (current !== recall || sequence !== current.sequence) return;
    fieldError(elements["recall-error"], error);
  }
}

function renderPreview(preview, current) {
  const scene = scenes.find((candidate) => candidate.id === current.sceneId);
  for (const slot of preview.slots) {
    let view = current.views.get(slot.slotId);
    if (!view) {
      const element = node("div", "recall-channel");
      const label = node("strong", "", slot.label);
      const host = node("span", "hint", slot.siteHost);
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Connected tab for ${slot.label}`);
      select.addEventListener("change", () => {
        current.assignments[slot.slotId] = select.value ? Number(select.value) : null;
        void refreshPreview();
      });
      const destinations = node("p", "hint");
      const warning = node("p", "recall-warning");
      element.append(label, host, select, destinations, warning);
      elements["recall-channels"].append(element);
      view = { element, select, destinations, warning };
      current.views.set(slot.slotId, view);
    }
    const options = [new Option("Leave unassigned", "")];
    if (slot.status === "ambiguous") {
      const placeholder = new Option("Choose a matching tab…", "choose");
      placeholder.disabled = true;
      options.unshift(placeholder);
    }
    for (const candidate of slot.candidates) options.push(new Option(`${candidate.tabTitle || candidate.siteHost} · tab ${candidate.tabId}`, String(candidate.tabId)));
    view.select.replaceChildren(...options);
    view.select.value = Number.isInteger(slot.tabId) ? String(slot.tabId) : slot.status === "ambiguous" ? "choose" : "";
    const saved = scene?.slots.find((entry) => entry.id === slot.slotId);
    view.destinations.textContent = (slot.sinks || saved?.sinks || []).map((sink) => `${sink.deviceLabel || "Audio output"} · ${Math.round(sink.volume * 100)}%`).join(" / ");
    const missing = slot.missingDevices?.map((device) => typeof device === "string" ? device : device.deviceLabel || device.label || "Audio device") || [];
    const statusText = {
      missing: "No tab assigned. Connect this website from the toolbar or leave this channel out.",
      ambiguous: "More than one connected tab matches. Choose the one to use.",
      "invalid-assignment": "This tab changed or is no longer connected. Choose again.",
      "duplicate-assignment": "This tab is assigned twice. Choose another tab or leave one channel unassigned.",
      "unavailable-output": "A saved output is unavailable.",
      "capacity-exceeded": "The six-output limit would be exceeded.",
      ready: "Ready to apply",
    }[slot.status] || slot.message || slot.status;
    view.warning.textContent = [statusText, ...(missing.length ? [`Unavailable outputs: ${missing.join(", ")}. This channel cannot be applied.`] : []), slot.error?.message, ...(slot.issues || [])].filter(Boolean).join(" ");
  }
  if (preview.capacityError || preview.capacity?.exceeded) {
    elements["recall-error"].textContent = typeof preview.capacityError === "string" ? preview.capacityError : "This scene exceeds the six-output limit. Leave a channel unassigned or disconnect another output.";
    elements["recall-error"].hidden = false;
  }
  elements["recall-submit"].disabled = preview.readyCount === 0;
  elements["recall-submit"].textContent = preview.readyCount === preview.slots.length ? "Apply scene" : `Apply ${preview.readyCount} ${preview.readyCount === 1 ? "channel" : "channels"}`;
}

async function applyRecall() {
  if (!recall) return;
  await perform(elements["recall-submit"], async () => {
    const current = recall;
    current.applying = true;
    let result;
    try {
      ({ result } = await request(STUDIO_MESSAGE.APPLY_SCENE, { sceneId: current.sceneId, assignments: current.assignments }));
    } finally { current.applying = false; }
    const applied = result.channels.filter((channel) => ["applied", "unchanged"].includes(channel.status)).length;
    const failures = result.channels.filter((channel) => !["applied", "unchanged"].includes(channel.status));
    const scene = scenes.find((candidate) => candidate.id === current.sceneId);
    const details = failures.map((channel) => {
      const name = scene?.slots.find((slot) => slot.id === channel.slotId)?.label || "Channel";
      return `${name}: ${channel.error?.message || channel.status.replaceAll("-", " ")}.`;
    });
    if (!result.focusApplied) details.push("Smart Focus settings were not applied.");
    notice(result.complete ? `“${scene?.name || "Scene"}” applied.` : `${applied} of ${result.channels.length} channels applied.\n${details.join("\n")}`, !result.complete);
    if (current === recall) elements["recall-dialog"].close();
    await refresh();
  }, elements["recall-error"]);
}

async function openOutput(tabId, sinkId) {
  if (!routeFor(tabId)) return;
  outputEdit = { tabId, sinkId };
  elements["output-title"].textContent = sinkId ? "Change output" : "Add second output";
  elements["output-error"].hidden = true;
  elements["output-hint"].textContent = "Available audio devices";
  elements["outputs"].replaceChildren();
  elements["device-setup"].hidden = true;
  elements["output-dialog"].showModal();
  await listOutputs();
}

async function listOutputs() {
  const current = outputEdit;
  if (!current) return;
  try {
    const permission = await navigator.permissions.query({ name: "microphone" }).catch(() => ({ state: "prompt" }));
    if (current !== outputEdit) return;
    if (permission.state !== "granted") {
      elements["output-hint"].textContent = "Device access is needed. Setup lets you grant access and select this tab’s main output. Return here afterward to add or change another output.";
      elements["device-setup"].hidden = false;
      return;
    }
    const devices = getMeaningfulAudioOutputs(await navigator.mediaDevices.enumerateDevices());
    if (current !== outputEdit) return;
    const route = routeFor(current.tabId);
    const used = new Set((route?.sinks || []).filter((sink) => sink.id !== current.sinkId).map((sink) => sink.deviceId));
    elements["outputs"].replaceChildren();
    for (const [index, device] of devices.entries()) {
      const label = device.label || `Audio output ${index + 1}`;
      const option = button(used.has(device.deviceId) ? `${label} · already connected` : label, "output-option", () => {
        void perform(option, async () => {
          if (current !== outputEdit) return;
          await command(current.sinkId ? MESSAGE_TYPE.CHANGE_OUTPUT : MESSAGE_TYPE.ADD_SINK, {
            tabId: current.tabId,
            ...(current.sinkId ? { sinkId: current.sinkId } : {}),
            deviceId: device.deviceId,
            deviceLabel: label,
          });
          if (current === outputEdit) elements["output-dialog"].close();
        }, elements["output-error"]);
      });
      option.disabled = used.has(device.deviceId);
      elements["outputs"].append(option);
    }
    if (!devices.length) throw new Error("No audio outputs found. Connect a device and try again.");
  } catch (error) {
    if (current === outputEdit) fieldError(elements["output-error"], error);
  }
}

async function openDeviceSetup() {
  const current = outputEdit;
  if (!current) return;
  const tab = await chrome.tabs.get(current.tabId);
  if (!routeFor(current.tabId)) throw new Error("This tab is no longer connected. Open AudioRoute on that tab to reconnect it.");
  await chrome.storage.session.set({ [PENDING_OUTPUT_SELECTION_STORAGE_KEY]: { tabId: tab.id, windowId: tab.windowId, tabTitle: routeFor(tab.id)?.tabTitle || "Connected tab", action: "change" } });
  await chrome.windows.create({ url: chrome.runtime.getURL("setup/setup.html"), type: "popup", width: 480, height: 680, focused: true });
  elements["output-dialog"].close();
  notice("Finish device setup, then return to Studio to adjust your outputs.");
}

async function perform(control, action, errorElement) {
  if (control.dataset.pending === "true") return;
  control.dataset.pending = "true";
  control.disabled = true;
  if (errorElement) errorElement.hidden = true;
  try { await action(); }
  catch (error) {
    if (errorElement) fieldError(errorElement, error);
    else notice(normalizeError(error).message, true);
    await refresh().catch(() => {});
  } finally {
    delete control.dataset.pending;
    control.disabled = false;
    renderSceneControls();
  }
}

function fieldError(element, error) {
  element.textContent = normalizeError(error).message;
  element.hidden = false;
}

function notice(message, error = false) {
  elements["notice-text"].textContent = message;
  elements.notice.dataset.error = String(error);
  elements.notice.hidden = false;
}

function balanceLabel(value) { return value === 0 ? "Center" : `${Math.abs(value)}${value < 0 ? "L" : "R"}`; }
function node(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
function button(text, className, click) {
  const element = node("button", className, text);
  element.type = "button";
  element.addEventListener("click", click);
  return element;
}
