import {
  MAX_SCENES, SCENE_STORAGE_KEY, STUDIO_MESSAGE, previewScene, sceneFromState,
  sceneIdentifier, sceneName, validateSceneStore,
} from "../shared/studio.js";

const SCENE_MESSAGES = new Set([
  STUDIO_MESSAGE.LIST_SCENES, STUDIO_MESSAGE.SAVE_SCENE, STUDIO_MESSAGE.RENAME_SCENE,
  STUDIO_MESSAGE.DUPLICATE_SCENE, STUDIO_MESSAGE.DELETE_SCENE, STUDIO_MESSAGE.PREVIEW_SCENE,
  STUDIO_MESSAGE.APPLY_SCENE,
]);

export function isSceneMessage(type) {
  return SCENE_MESSAGES.has(type);
}

/** The worker authenticates senders before calling this service. State comes only from the engine. */
export function createSceneService({ getState, applyChannels, getDevices }) {
  let queue = Promise.resolve();

  async function readStore() {
    const result = await chrome.storage.local.get(SCENE_STORAGE_KEY);
    return validateSceneStore(result[SCENE_STORAGE_KEY]);
  }

  async function writeStore(store) {
    await chrome.storage.local.set({ [SCENE_STORAGE_KEY]: validateSceneStore(store) });
  }

  function findScene(store, id) {
    const scene = store.scenes.find((entry) => entry.id === sceneIdentifier(id));
    if (!scene) throw new Error("This scene no longer exists.");
    return scene;
  }

  async function prepare(scene, assignments) {
    const state = await getState();
    const preview = previewScene(scene, state, assignments);
    const available = new Set((await getDevices()).map((device) => device.deviceId));
    let count = state.routes.reduce((total, route) => total + route.sinks.length, 0);
    const delta = (slot) => scene.slots.find((entry) => entry.id === slot.slotId).sinks.length - (state.routes.find((route) => route.tabId === slot.tabId)?.sinks.length || 0);
    for (const slot of [...preview.slots].sort((a, b) => delta(a) - delta(b))) {
      const saved = scene.slots.find((entry) => entry.id === slot.slotId);
      slot.missingDevices = saved.sinks.filter((sink) => !available.has(sink.deviceId)).map((sink) => sink.deviceLabel);
      if (slot.status !== "ready") continue;
      if (slot.missingDevices.length) {
        slot.status = "unavailable-output";
        slot.error = { code: "OutputDeviceNotFound", message: "A saved output is unavailable. Connect it or update the scene." };
      } else if (count + delta(slot) > 6) {
        slot.status = "capacity-exceeded";
        preview.capacityError = "This scene would exceed six outputs. Leave a channel unassigned or stop another output.";
        slot.error = { code: "ContextLimitReached", message: preview.capacityError };
      } else count += delta(slot);
    }
    preview.readyCount = preview.slots.filter((slot) => slot.status === "ready").length;
    return preview;
  }

  async function handleRequest(message) {
    if (!isSceneMessage(message?.type)) throw new Error("Unknown scene request.");
    const store = await readStore();
    if (message.type === STUDIO_MESSAGE.LIST_SCENES) return { scenes: store.scenes };

    if (message.type === STUDIO_MESSAGE.SAVE_SCENE) {
      const existing = message.sceneId === undefined ? null : findScene(store, message.sceneId);
      if (!existing && store.scenes.length >= MAX_SCENES) throw new Error("You can save up to 20 scenes. Delete one before saving another.");
      const now = Date.now();
      const scene = sceneFromState(await getState(), {
        id: existing?.id || crypto.randomUUID(), name: message.name ?? existing?.name,
        labels: message.labels, createdAt: existing?.createdAt ?? now, updatedAt: now, previousScene: existing,
      });
      if (existing) store.scenes[store.scenes.indexOf(existing)] = scene;
      else store.scenes.push(scene);
      await writeStore(store);
      return { scene, scenes: store.scenes };
    }

    const scene = findScene(store, message.sceneId);
    switch (message.type) {
      case STUDIO_MESSAGE.RENAME_SCENE:
        scene.name = sceneName(message.name);
        scene.updatedAt = Date.now();
        await writeStore(store);
        return { scene, scenes: store.scenes };
      case STUDIO_MESSAGE.DUPLICATE_SCENE: {
        if (store.scenes.length >= MAX_SCENES) throw new Error("You can save up to 20 scenes. Delete one before duplicating another.");
        const now = Date.now();
        const copy = { ...structuredClone(scene), id: crypto.randomUUID(), name: sceneName(message.name ?? `${scene.name.slice(0, 73)} (copy)`), createdAt: now, updatedAt: now };
        store.scenes.push(copy);
        await writeStore(store);
        return { scene: copy, scenes: store.scenes };
      }
      case STUDIO_MESSAGE.DELETE_SCENE:
        store.scenes = store.scenes.filter((entry) => entry.id !== scene.id);
        await writeStore(store);
        return { scenes: store.scenes };
      case STUDIO_MESSAGE.PREVIEW_SCENE:
        return { preview: await prepare(scene, message.assignments) };
      case STUDIO_MESSAGE.APPLY_SCENE: {
        // Recompute matches at execution time: the preview may predate navigation or capture loss.
        const preview = await prepare(scene, message.assignments);
        const ready = preview.slots.filter((slot) => slot.status === "ready");
        const priority = ready.find((slot) => slot.slotId === scene.focus.prioritySlotId);
        const skipFocus = scene.focus.prioritySlotId !== null && !priority;
        const payload = {
          channels: ready.map((match) => {
            const slot = scene.slots.find((entry) => entry.id === match.slotId);
            return { slotId: slot.id, tabId: match.tabId, siteHost: slot.siteHost, audio: slot.audio, muted: slot.muted, sinks: slot.sinks };
          }),
          focus: { enabled: scene.focus.enabled, priorityTabId: priority?.tabId ?? null },
          skipFocus,
        };
        const applied = ready.length ? await applyChannels(payload) : { channels: [], focusApplied: false };
        const channels = preview.slots.map((slot) => {
          if (slot.status !== "ready") return { slotId: slot.slotId, tabId: slot.tabId, status: slot.status, error: slot.error || assignmentError(slot.status) };
          return applied.channels?.find((channel) => channel.slotId === slot.slotId) || { slotId: slot.slotId, tabId: slot.tabId, status: "failed", error: { code: "SceneApplyFailed", message: "This channel did not return a result. Check its current output before retrying." } };
        });
        return { result: { sceneId: scene.id, complete: channels.every((channel) => ["applied", "unchanged"].includes(channel.status)) && applied.focusApplied === true, channels, focusApplied: applied.focusApplied === true } };
      }
      default:
        throw new Error("Unknown scene request.");
    }
  }

  return {
    handle(message) {
      // Include reads in the queue so another sidebar sees completed writes in order.
      const task = queue.then(() => handleRequest(message));
      queue = task.catch(() => {});
      return task;
    },
  };
}

function assignmentError(status) {
  const messages = {
    missing: "Connect this website from the AudioRoute toolbar, then assign its channel.",
    ambiguous: "More than one connected tab matches this website. Choose a tab.",
    "invalid-assignment": "The selected tab no longer matches this website. Choose a connected tab again.",
    "duplicate-assignment": "A connected tab can fill only one scene channel. Choose a different tab or leave this slot unassigned.",
  };
  return { code: "SceneAssignmentRequired", message: messages[status] || "Choose a connected tab." };
}
