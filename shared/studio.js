import { MAX_CONTEXTS, MAX_DELAY_MS, normalizeAudioSettings, normalizeSinkOptions } from "./utils.js";

export const STUDIO_MESSAGE = Object.freeze({
  GET_STATE: "get-studio-state",
  GET_DEVICES: "get-output-devices",
  OFFSCREEN_LIST_DEVICES: "offscreen-list-devices",
  UPDATE_MIX: "update-mix",
  UPDATE_FOCUS: "update-focus",
  OFFSCREEN_GET_STATE: "offscreen-get-studio-state",
  OFFSCREEN_UPDATE_MIX: "offscreen-update-mix",
  OFFSCREEN_UPDATE_FOCUS: "offscreen-update-focus",
  OFFSCREEN_METERING: "offscreen-metering",
  OFFSCREEN_APPLY_SCENE: "offscreen-apply-scene",
  STATE_CHANGED: "studio-state-changed",
  LEVELS: "studio-levels",
  LIST_SCENES: "list-scenes",
  SAVE_SCENE: "save-scene",
  RENAME_SCENE: "rename-scene",
  DUPLICATE_SCENE: "duplicate-scene",
  DELETE_SCENE: "delete-scene",
  PREVIEW_SCENE: "preview-scene",
  APPLY_SCENE: "apply-scene",
});

export const SCENE_STORAGE_KEY = "audioRouteStudioScenes";
export const SCENE_VERSION = 1;
export const MAX_SCENES = 20;
export const MAX_SCENE_CHANNELS = MAX_CONTEXTS;
export const MAX_SINKS_PER_ROUTE = 2;
export const MAX_SCENE_NAME_LENGTH = 80;

const IDENTIFIER = /^[a-zA-Z0-9_-]{1,80}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A hostname is an identity, not a URL or a display label. Keep www and trailing dots. */
export function normalizeHostname(value) {
  if (typeof value !== "string" || !value || value.length > 253 || /[\s/@?#\\%]/u.test(value)) return null;
  if (value.includes(":") && !/^\[[0-9a-fA-F:.]+\]$/.test(value)) return null;
  try {
    const host = new URL(`https://${value}/`).hostname;
    if (!host || host !== value.toLowerCase()) return null;
    if (!host.startsWith("[") && !host.split(".").every((part, index, parts) =>
      (index === parts.length - 1 && part === "") || /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/.test(part),
    )) return null;
    return host;
  } catch {
    return null;
  }
}

export function hostnameFromUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? normalizeHostname(url.hostname) : null;
  } catch {
    return null;
  }
}

export function sceneName(value) {
  return boundedText(value, MAX_SCENE_NAME_LENGTH, "Enter a scene name of 1 to 80 characters.");
}

export function sceneLabel(value) {
  return boundedText(value, 80, "Channel labels must contain 1 to 80 characters.");
}

export function sceneIdentifier(value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new Error("Invalid scene or channel identifier.");
  return value;
}

function boundedText(value, maxLength, message) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength || CONTROL_CHARACTERS.test(value)) {
    throw new Error(message);
  }
  return value.trim();
}

function sceneSink(sink) {
  if (!isRecord(sink) || typeof sink.deviceId !== "string" || !sink.deviceId || sink.deviceId.length > 512 || CONTROL_CHARACTERS.test(sink.deviceId)) {
    throw new Error("Invalid scene output device.");
  }
  const options = normalizeSinkOptions(sink);
  return {
    deviceId: sink.deviceId,
    deviceLabel: boundedText(sink.deviceLabel || "Selected audio device", 200, "Invalid output device label."),
    volume: Math.min(1, options.volume),
    delayMs: options.delayMs,
  };
}

/** Build an allowlisted snapshot: titles, URLs, tab IDs, solo and boost never reach storage. */
export function sceneFromState(state, { id, name, labels = {}, createdAt, updatedAt, previousScene = null }) {
  if (!isRecord(labels) || Object.keys(labels).length > MAX_SCENE_CHANNELS) throw new Error("Invalid channel labels.");
  const routes = (state?.routes || []).filter((route) => route.active);
  if (!routes.length) throw new Error("Connect a website tab from the AudioRoute toolbar before saving a scene.");
  if (routes.length > MAX_SCENE_CHANNELS) throw new Error("A scene can contain at most six channels.");
  const previousByHost = new Map();
  for (const slot of previousScene?.slots || []) {
    const slots = previousByHost.get(slot.siteHost) || [];
    slots.push(slot);
    previousByHost.set(slot.siteHost, slots);
  }
  const slots = routes.map((route) => {
    const siteHost = normalizeHostname(route.siteHost);
    if (!siteHost) throw new Error("Every saved channel needs a website hostname. Reconnect tabs that navigated; local files cannot be saved in scenes.");
    if (!Array.isArray(route.sinks) || route.sinks.length < 1 || route.sinks.length > MAX_SINKS_PER_ROUTE) throw new Error("A channel must have one or two outputs.");
    const previous = previousByHost.get(siteHost)?.shift();
    return {
      id: previous?.id || crypto.randomUUID(),
      label: Object.hasOwn(labels, route.tabId) ? sceneLabel(labels[route.tabId]) : previous?.label || siteHost,
      siteHost,
      audio: normalizeAudioSettings(route.audio),
      muted: route.muted === true,
      sinks: route.sinks.map(sceneSink),
    };
  });
  const priorityIndex = routes.findIndex((route) => route.tabId === state?.focus?.priorityTabId);
  return validateScene({
    id: sceneIdentifier(id), version: SCENE_VERSION, name: sceneName(name), createdAt, updatedAt, slots,
    focus: { enabled: state?.focus?.enabled === true && priorityIndex >= 0, prioritySlotId: slots[priorityIndex]?.id || null },
  });
}

/** Reject corrupt data before recall and reconstruct it so unrelated fields cannot be persisted. */
export function validateScene(value) {
  if (!isRecord(value) || value.version !== SCENE_VERSION || !Array.isArray(value.slots) || value.slots.length < 1 || value.slots.length > MAX_SCENE_CHANNELS) {
    throw new Error("Invalid saved scene format.");
  }
  for (const timestamp of [value.createdAt, value.updatedAt]) {
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error("Invalid scene timestamp.");
  }
  const slotIds = new Set();
  let outputCount = 0;
  const slots = value.slots.map((slot) => {
    if (!isRecord(slot) || !normalizeHostname(slot.siteHost) || !Array.isArray(slot.sinks) || slot.sinks.length < 1 || slot.sinks.length > MAX_SINKS_PER_ROUTE) throw new Error("Invalid saved channel.");
    const id = sceneIdentifier(slot.id);
    if (slotIds.has(id)) throw new Error("Saved channels must have unique identifiers.");
    slotIds.add(id);
    if (!isRecord(slot.audio) || !["mono", "night", "voice"].every((key) => typeof slot.audio[key] === "boolean") || !Number.isFinite(slot.audio.balance) || Math.abs(slot.audio.balance) > 1 || typeof slot.muted !== "boolean") throw new Error("Invalid saved sound settings.");
    const deviceIds = new Set();
    const sinks = slot.sinks.map((sink) => {
      if (!isRecord(sink) || !Number.isFinite(sink.volume) || sink.volume < 0 || sink.volume > 1 || !Number.isInteger(sink.delayMs) || sink.delayMs < 0 || sink.delayMs > MAX_DELAY_MS) throw new Error("Invalid saved output settings.");
      const normalized = sceneSink(sink);
      if (deviceIds.has(normalized.deviceId)) throw new Error("A channel cannot contain the same output twice.");
      deviceIds.add(normalized.deviceId);
      return normalized;
    });
    outputCount += sinks.length;
    return { id, label: sceneLabel(slot.label), siteHost: normalizeHostname(slot.siteHost), audio: normalizeAudioSettings(slot.audio), muted: slot.muted, sinks };
  });
  if (outputCount > MAX_CONTEXTS) throw new Error("A scene can use at most six outputs.");
  if (!isRecord(value.focus) || typeof value.focus.enabled !== "boolean" || (value.focus.prioritySlotId !== null && !slotIds.has(value.focus.prioritySlotId)) || (value.focus.enabled && value.focus.prioritySlotId === null)) throw new Error("Invalid saved Smart Focus configuration.");
  return {
    id: sceneIdentifier(value.id), version: SCENE_VERSION, name: sceneName(value.name), createdAt: value.createdAt, updatedAt: value.updatedAt, slots,
    focus: { enabled: value.focus.enabled, prioritySlotId: value.focus.prioritySlotId },
  };
}

export function validateSceneStore(value) {
  if (value === undefined) return { version: SCENE_VERSION, scenes: [] };
  if (!isRecord(value) || value.version !== SCENE_VERSION || !Array.isArray(value.scenes) || value.scenes.length > MAX_SCENES) throw new Error("Saved scenes could not be read: unsupported or damaged storage.");
  const scenes = value.scenes.map(validateScene);
  if (new Set(scenes.map((scene) => scene.id)).size !== scenes.length) throw new Error("Saved scenes contain duplicate identifiers.");
  return { version: SCENE_VERSION, scenes };
}

export function previewScene(scene, state, assignments = {}) {
  if (!isRecord(assignments) || Object.keys(assignments).length > MAX_SCENE_CHANNELS) throw new Error("Invalid scene assignments.");
  const slotIds = new Set(scene.slots.map((slot) => slot.id));
  for (const [slotId, tabId] of Object.entries(assignments)) {
    if (!slotIds.has(slotId) || (tabId !== null && (!Number.isInteger(tabId) || tabId < 0))) throw new Error("Invalid scene assignment.");
  }
  const routes = (state?.routes || []).filter((route) => route.active && Number.isInteger(route.tabId) && route.tabId >= 0 && normalizeHostname(route.siteHost));
  const slots = scene.slots.map((slot) => {
    const candidates = routes.filter((route) => normalizeHostname(route.siteHost) === slot.siteHost).map((route) => ({ tabId: route.tabId, tabTitle: route.tabTitle || slot.siteHost, siteHost: slot.siteHost }));
    let status;
    let tabId = null;
    if (Object.hasOwn(assignments, slot.id)) {
      tabId = assignments[slot.id];
      status = tabId === null ? "missing" : candidates.some((candidate) => candidate.tabId === tabId) ? "ready" : "invalid-assignment";
      if (status !== "ready") tabId = null;
    } else {
      status = candidates.length === 1 ? "ready" : candidates.length ? "ambiguous" : "missing";
      if (status === "ready") tabId = candidates[0].tabId;
    }
    return { slotId: slot.id, label: slot.label, siteHost: slot.siteHost, status, tabId, candidates };
  });
  const bindingCounts = new Map();
  for (const slot of slots) {
    if (slot.status === "ready") bindingCounts.set(slot.tabId, (bindingCounts.get(slot.tabId) || 0) + 1);
  }
  for (const slot of slots) {
    if (slot.status === "ready" && bindingCounts.get(slot.tabId) > 1) {
      slot.status = "duplicate-assignment";
      slot.tabId = null;
    }
  }
  return { sceneId: scene.id, name: scene.name, revision: state?.revision ?? 0, slots, readyCount: slots.filter((slot) => slot.status === "ready").length };
}
