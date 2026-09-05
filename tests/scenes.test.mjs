import test from "node:test";
import assert from "node:assert/strict";
import { sceneFromState, previewScene, validateSceneStore, hostnameFromUrl, STUDIO_MESSAGE as S, SCENE_STORAGE_KEY } from "../shared/studio.js";
import { createSceneService } from "../worker/scenes.js";

const route = (tabId, siteHost = "example.com") => ({ active: true, tabId, siteHost, tabTitle: "Private document title", tabHost: siteHost, url: `https://${siteHost}/secret?q=private`, muted: false,
  audio: { mono: false, night: false, voice: true, balance: 0 }, sinks: [{ id: `sink-${tabId}`, deviceId: "headphones", deviceLabel: "Headphones", volume: 1.8, delayMs: 50 }] });
const state = (routes) => ({ epoch: "test", revision: 1, routes, focus: { enabled: true, priorityTabId: routes[0]?.tabId ?? null, active: false }, soloTabId: routes[0]?.tabId });
const scene = (routes) => sceneFromState(state(routes), { id: "work", name: "Work", createdAt: 1, updatedAt: 1 });

test("saved scenes persist only bounded website settings, user labels, and safe volumes", () => {
  const saved = scene([route(1)]);
  const json = JSON.stringify(saved);
  assert.equal(saved.slots[0].sinks[0].volume, 1);
  for (const forbidden of ["Private document", "secret", "tabId", "tabTitle", "soloTabId", "sink-1"]) assert.equal(json.includes(forbidden), false);
  assert.equal(hostnameFromUrl("https://www.example.com/private?q=1"), "www.example.com");
  assert.equal(hostnameFromUrl("file:///private.pdf"), null);
  assert.throws(() => scene([route(1, null)]), /hostname/);
});

test("same-site ambiguity and duplicate assignments require distinct explicit connections", () => {
  const saved = scene([route(1), route(2)]);
  const current = state([route(3), route(4)]);
  assert.equal(previewScene(saved, current).slots.every((slot) => slot.status === "ambiguous"), true);
  const [first, second] = saved.slots;
  assert.equal(previewScene(saved, current, { [first.id]: 3, [second.id]: 3 }).slots.every((slot) => slot.status === "duplicate-assignment"), true);
  assert.equal(previewScene(saved, current, { [first.id]: 3, [second.id]: 4 }).readyCount, 2);
  assert.equal(previewScene(saved, state([route(3, "evil.test")]), { [first.id]: 3 }).slots[0].status, "invalid-assignment");
  assert.throws(() => previewScene(saved, current, { unknown: 3 }), /Invalid/);
});

test("version and numeric corruption are rejected rather than silently overwriting storage", async () => {
  const saved = scene([route(1)]);
  const corrupt = structuredClone(saved); corrupt.slots[0].sinks[0].volume = 200;
  assert.throws(() => validateSceneStore({ version: 1, scenes: [corrupt] }), /Invalid/);
  let written = false;
  globalThis.chrome = { storage: { local: { get: async () => ({ [SCENE_STORAGE_KEY]: { version: 99, scenes: [] } }), set: async () => { written = true; } } } };
  const service = createSceneService({ getState: async () => state([route(1)]), getDevices: async () => [], applyChannels: async () => ({}) });
  await assert.rejects(service.handle({ type: S.SAVE_SCENE, name: "Work" }), /damaged storage/);
  assert.equal(written, false);
});

test("scene writes serialize, enforce twenty scenes, and support rename duplicate update delete", async () => {
  let storage;
  globalThis.chrome = { storage: { local: { get: async () => ({ [SCENE_STORAGE_KEY]: structuredClone(storage) }), set: async (value) => { storage = structuredClone(value[SCENE_STORAGE_KEY]); } } } };
  const service = createSceneService({ getState: async () => state([route(1)]), getDevices: async () => [{ deviceId: "headphones" }], applyChannels: async () => ({}) });
  const saved = await service.handle({ type: S.SAVE_SCENE, name: "Work", labels: { 1: "Music" } });
  const id = saved.scene.id;
  await service.handle({ type: S.RENAME_SCENE, sceneId: id, name: "Focus" });
  const copy = await service.handle({ type: S.DUPLICATE_SCENE, sceneId: id });
  await service.handle({ type: S.SAVE_SCENE, sceneId: id, name: "Updated" });
  assert.equal(storage.scenes[0].slots[0].label, "Music");
  await service.handle({ type: S.DELETE_SCENE, sceneId: copy.scene.id });
  const results = await Promise.allSettled(Array.from({ length: 22 }, (_, index) => service.handle({ type: S.SAVE_SCENE, name: `Scene ${index}` })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 19);
  assert.equal(storage.scenes.length, 20);
});

test("preview reports missing hardware and recall leaves unresolved priority unchanged", async () => {
  const saved = scene([route(1), route(2, "music.test")]);
  saved.slots[0].sinks[0].deviceId = "missing";
  let calls = [];
  globalThis.chrome = { storage: { local: { get: async () => ({ [SCENE_STORAGE_KEY]: { version: 1, scenes: [saved] } }) } } };
  const service = createSceneService({ getState: async () => state([route(10), route(20, "music.test")]), getDevices: async () => [{ deviceId: "headphones" }],
    applyChannels: async (payload) => { calls.push(payload); return { channels: payload.channels.map((channel) => ({ slotId: channel.slotId, tabId: channel.tabId, status: "applied" })), focusApplied: false }; } });
  const preview = (await service.handle({ type: S.PREVIEW_SCENE, sceneId: saved.id })).preview;
  assert.equal(preview.readyCount, 1); assert.equal(preview.slots[0].status, "unavailable-output");
  const result = (await service.handle({ type: S.APPLY_SCENE, sceneId: saved.id })).result;
  assert.equal(result.complete, false); assert.equal(calls[0].skipFocus, true); assert.equal(calls[0].channels.length, 1);
});
