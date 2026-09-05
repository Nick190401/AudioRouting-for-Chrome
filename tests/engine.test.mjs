import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as utils from "../shared/utils.js";
import * as chain from "../offscreen/audio-chain.js";
import * as studio from "../shared/studio.js";
import * as focusHelpers from "../shared/focus.js";
import { senderRole } from "../shared/security.js";

const source = (await readFile(new URL("../offscreen/offscreen.js", import.meta.url), "utf8"))
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];/g, "");
const id = "a".repeat(32);
const S = studio.STUDIO_MESSAGE;
function harness() {
  let listener;
  let deviceChange;
  let devices = ["a", "b", "c", "d", "e", "f"];
  const contexts = [];
  const streams = [];
  const events = [];
  let maxContexts = 0;
  let failNext = null;
  const param = (value = 0) => ({ value, setTargetAtTime(value) { this.value = value; }, setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value) { this.value = value; }, cancelAndHoldAtTime() {}, cancelScheduledValues() {} });
  class Node {
    constructor() { for (const name of ["gain", "pan", "frequency", "Q", "delayTime", "threshold", "knee", "ratio", "attack", "release"]) this[name] = param(); }
    connect(node) { return node; }
    disconnect() {}
  }
  class Context {
    constructor() {
      this.state = "running"; this.currentTime = 0; this.destination = new Node(); this.worklets = [];
      this.audioWorklet = { addModule: async () => {} };
      contexts.push(this); maxContexts = Math.max(maxContexts, contexts.filter((context) => context.state !== "closed").length);
    }
    async setSinkId(deviceId) {
      await new Promise((done) => setTimeout(done, 1));
      if (deviceId === failNext) { failNext = null; throw new Error("Simulated device failure"); }
      if (!devices.includes(deviceId)) throw new Error("Device missing");
      this.sinkId = deviceId;
    }
    async close() { this.state = "closed"; }
    async resume() { this.state = "running"; }
    addEventListener() {}
    createMediaStreamSource() { return new Node(); }
    createGain() { return new Node(); }
    createStereoPanner() { return new Node(); }
    createDynamicsCompressor() { return new Node(); }
    createBiquadFilter() { return new Node(); }
    createWaveShaper() { return new Node(); }
    createDelay() { return new Node(); }
  }
  class Worklet extends Node {
    constructor(context) { super(); this.port = { onmessage: null, postMessage() {}, close() {} }; context.worklets.push(this); }
  }
  vm.runInNewContext(source, {
    ...utils, ...chain, ...focusHelpers, S, normalizeHostname: studio.normalizeHostname, validateScene: studio.validateScene, senderRole,
    AudioContext: Context, AudioWorkletNode: Worklet, crypto, performance, DOMException, console,
    navigator: { mediaDevices: {
      addEventListener: (_event, callback) => { deviceChange = callback; },
      enumerateDevices: async () => devices.map((deviceId) => ({ kind: "audiooutput", deviceId, label: deviceId })),
      getUserMedia: async () => {
        const track = { stopped: false, stop() { this.stopped = true; }, addEventListener(_name, fn) { this.ended = fn; } };
        const stream = { getTracks: () => [track] }; streams.push(stream); return stream;
      },
    } },
    chrome: { runtime: { id, getURL: (path) => `chrome-extension://${id}/${path}`,
      onMessage: { addListener: (fn) => { listener = fn; } },
      sendMessage: async (message) => { events.push(message); },
    } },
  });
  async function request(type, payload = {}, sender = { id, url: `chrome-extension://${id}/service-worker.js` }) {
    return new Promise((done) => listener({ target: utils.MESSAGE_TARGET.OFFSCREEN, type, ...payload }, sender, done));
  }
  const state = async () => (await request(S.OFFSCREEN_GET_STATE)).state;
  const start = (tabId, deviceId = "a") => request(utils.MESSAGE_TYPE.OFFSCREEN_START, { tabId, deviceId, streamId: `capture-${tabId}`, siteHost: `site${tabId}.test` });
  return { contexts, streams, events, request, state, start, max: () => maxContexts,
    fail: (deviceId) => { failNext = deviceId; },
    disconnect: (deviceId) => { devices = devices.filter((value) => value !== deviceId); deviceChange(); },
    signal: (context, rms, time) => { context.currentTime = time; context.worklets[0].port.onmessage({ data: { rms } }); },
  };
}

test("parallel captures and sink additions enforce the actual six-context and two-output budgets", async () => {
  const h = harness();
  const started = await Promise.all(Array.from({ length: 7 }, (_, index) => h.start(index + 1)));
  assert.equal(started.filter((result) => result.ok).length, 6);
  assert.equal(h.max(), 6);
  await h.request(utils.MESSAGE_TYPE.OFFSCREEN_STOP, { tabId: 6 });
  assert.equal((await h.request(utils.MESSAGE_TYPE.OFFSCREEN_ADD_SINK, { tabId: 1, deviceId: "b" })).ok, true);
  assert.equal((await h.request(utils.MESSAGE_TYPE.OFFSCREEN_ADD_SINK, { tabId: 1, deviceId: "c" })).ok, false);
  assert.equal((await h.state()).routes[0].sinks.length, 2);
});

test("focus attenuation preserves manual volume, mute and solo dominate, silence and capture loss restore", async () => {
  const h = harness(); await h.start(1); await h.start(2, "b");
  let state = await h.state();
  await h.request(utils.MESSAGE_TYPE.OFFSCREEN_UPDATE_SINK, { tabId: 1, sinkId: state.routes[0].sinks[0].id, volume: 0.65 });
  await h.request(S.OFFSCREEN_UPDATE_FOCUS, { enabled: true, priorityTabId: 2 });
  h.signal(h.contexts[1], 0.02, 1);
  state = await h.state(); assert.equal(state.focus.active, true); assert.equal(state.routes[0].gain, 0.2); assert.equal(state.routes[0].sinks[0].volume, 0.65);
  await h.request(S.OFFSCREEN_UPDATE_MIX, { tabId: 2, muted: true });
  assert.equal((await h.state()).focus.active, false);
  await h.request(S.OFFSCREEN_UPDATE_MIX, { tabId: 2, muted: false });
  h.signal(h.contexts[1], 0.02, 2);
  h.signal(h.contexts[1], 0, 2.5); assert.equal((await h.state()).focus.active, true);
  h.signal(h.contexts[1], 0, 2.7); assert.equal((await h.state()).focus.active, false);
  await h.request(S.OFFSCREEN_UPDATE_MIX, { tabId: 1, solo: true });
  assert.equal((await h.state()).routes[1].effectiveMuted, true);
  await h.request(S.OFFSCREEN_UPDATE_MIX, { tabId: 1, solo: false });
  h.signal(h.contexts[1], 0.02, 3);
  await h.request(utils.MESSAGE_TYPE.OFFSCREEN_STOP, { tabId: 2 });
  state = await h.state(); assert.equal(state.focus.active, false); assert.equal(state.routes[0].gain, 1); assert.equal(state.routes[0].sinks[0].volume, 0.65);
});

test("scene hardware failure rolls back the affected channel and preserves successful channels", async () => {
  const h = harness(); await h.start(1); await h.start(2, "b");
  const state = await h.state();
  const channels = state.routes.map((route, index) => ({ slotId: `slot${index}`, tabId: route.tabId, siteHost: route.siteHost, muted: false, audio: route.audio, sinks: [{ deviceId: index ? "d" : "c", deviceLabel: "Destination", volume: 0.4, delayMs: 0 }] }));
  h.fail("d");
  const response = await h.request(S.OFFSCREEN_APPLY_SCENE, { channels, focus: { enabled: false, priorityTabId: null } });
  assert.equal(response.ok, true); assert.equal(response.result.channels[0].status, "applied"); assert.equal(response.result.channels[1].status, "failed");
  const actual = await h.state(); assert.equal(actual.routes[0].deviceId, "c"); assert.equal(actual.routes[0].sinks[0].volume, 0.4); assert.equal(actual.routes[1].deviceId, "b"); assert.equal(actual.routes[1].sinks[0].volume, 1);
});

test("device removal keeps a surviving output and navigation invalidates scene and focus identity", async () => {
  const h = harness(); await h.start(1); await h.request(utils.MESSAGE_TYPE.OFFSCREEN_ADD_SINK, { tabId: 1, deviceId: "b" });
  await h.request(S.OFFSCREEN_UPDATE_FOCUS, { priorityTabId: 1, enabled: true });
  h.disconnect("a"); const surviving = await h.state(); assert.equal(surviving.routes[0].sinks.length, 1); assert.equal(surviving.routes[0].deviceId, "b");
  h.signal(h.contexts[1], 0.02, 1); assert.equal((await h.state()).focus.active, true);
  await h.request(utils.MESSAGE_TYPE.OFFSCREEN_UPDATE_ROUTE, { tabId: 1, siteHost: null });
  const navigated = await h.state(); assert.equal(navigated.routes[0].siteHost, null); assert.equal(navigated.focus.priorityTabId, null);
  h.disconnect("b"); assert.equal((await h.state()).routes.length, 0); assert.equal(h.streams[0].getTracks()[0].stopped, true);
});

test("engine rejects UI senders and malformed scene data without changing routes", async () => {
  const h = harness(); await h.start(1);
  const forged = await h.request(utils.MESSAGE_TYPE.OFFSCREEN_STOP, { tabId: 1 }, { id, url: `chrome-extension://${id}/studio/studio.html` });
  assert.equal(forged.ok, false); assert.equal((await h.state()).routes.length, 1);
  const result = await h.request(S.OFFSCREEN_APPLY_SCENE, { channels: [{ slotId: "x", tabId: 1, sinks: [] }], focus: { enabled: false, priorityTabId: null } });
  assert.equal(result.ok, false); assert.equal((await h.state()).routes[0].deviceId, "a");
});

test("level detector does not cancel opposite-phase stereo", () => {
  const result = focusHelpers.channelLevels([new Float32Array([0.5, -0.5]), new Float32Array([-0.5, 0.5])]);
  assert.equal(result.rms, 0.5); assert.equal(result.peak, 0.5);
});
