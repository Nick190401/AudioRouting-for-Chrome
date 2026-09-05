import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import * as utils from "../shared/utils.js";
import { STUDIO_MESSAGE } from "../shared/studio.js";

const source = (await readFile(new URL("../studio/studio.js", import.meta.url), "utf8"))
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];/g, "");
const html = await readFile(new URL("../studio/studio.html", import.meta.url), "utf8");

class Element {
  constructor(tagName, document) {
    this.tagName = tagName;
    this.ownerDocument = document;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.textContent = "";
    this.className = "";
  }
  set innerHTML(_value) { throw new Error("Dynamic HTML rendering is forbidden in Studio."); }
  set id(value) { this._id = value; this.ownerDocument?.elements.set(value, this); }
  get id() { return this._id; }
  append(...children) {
    for (const child of children) {
      if (child.parentElement) child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    this.children.forEach((child) => { child.parentElement = null; });
    this.children = [];
    this.append(...children);
    if (this.tagName === "select") this.value = children[0]?.value || "";
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(event, callback) {
    this.listeners.set(event, [...(this.listeners.get(event) || []), callback]);
  }
  fire(event) { for (const callback of this.listeners.get(event) || []) callback({ preventDefault() {}, target: this }); }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.fire("close"); }
  querySelectorAll(selector) {
    const all = this.children.flatMap((child) => [child, ...child.querySelectorAll("*")]);
    return selector === "*" ? all : all.filter((child) => child.tagName === selector || child.className.split(" ").includes(selector.slice(1)));
  }
}

function eventSource() {
  const callbacks = [];
  return { addListener(callback) { callbacks.push(callback); }, emit(value) { callbacks.forEach((callback) => callback(value)); } };
}

const route = (tabId = 11) => ({
  active: true, tabId, siteHost: "meeting.example", tabTitle: "Project planning", muted: false,
  effectiveMuted: false, ducked: false, audio: { balance: 0, mono: false, night: false, voice: false },
  sinks: [{ id: `sink-${tabId}`, deviceId: "headphones", deviceLabel: "USB headphones", volume: 1, delayMs: 0 }],
});
const snapshot = (routes = [route()]) => ({ epoch: "engine-1", revision: 1, routes, focus: { enabled: false, priorityTabId: null, active: false }, soloTabId: null });
const scene = () => ({ id: "work", name: "Work", slots: [{ id: "meeting", label: "Meeting", siteHost: "meeting.example", sinks: [{ deviceId: "headphones", deviceLabel: "USB headphones", volume: 1 }] }] });

async function mount({ initialState = snapshot(), savedScenes = [], handle } = {}) {
  const document = {
    elements: new Map(), activeElement: null, hidden: false,
    createElement(tag) { return new Element(tag, this); },
    createTextNode(text) { const element = new Element("#text", this); element.textContent = text; return element; },
    getElementById(id) { return this.elements.get(id); },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  for (const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"/g)) {
    const element = document.createElement(match[1]);
    element.id = match[2];
  }
  document.getElementById("focus-enabled").type = "checkbox";
  document.getElementById("scene-select").value = savedScenes[0]?.id || "";
  const messages = [];
  const port = { onMessage: eventSource(), onDisconnect: eventSource(), postMessage() {}, disconnect() {} };
  const chrome = {
    runtime: {
      connect: () => port,
      async sendMessage(message) {
        messages.push(message);
        if (message.type === STUDIO_MESSAGE.GET_STATE) return { ok: true, state: initialState };
        if (message.type === STUDIO_MESSAGE.LIST_SCENES) return { ok: true, scenes: savedScenes };
        const result = await handle?.(message);
        return { ok: true, ...result };
      },
    },
    storage: { onChanged: eventSource() },
  };
  const context = vm.createContext({
    ...utils, STUDIO_MESSAGE, document, chrome, console,
    navigator: { mediaDevices: { addEventListener() {} } },
    window: { addEventListener() {} },
    Option: function Option(text, value) { const element = document.createElement("option"); element.textContent = text; element.value = value; return element; },
    performance, setTimeout, clearTimeout, setInterval: () => 0,
  });
  vm.runInContext(source, context);
  await settle();
  return { document, messages, port, get: (id) => document.getElementById(id) };
}

async function settle() { for (let index = 0; index < 8; index += 1) await new Promise(setImmediate); }
function sendState(ui, state) { ui.port.onMessage.emit({ type: STUDIO_MESSAGE.STATE_CHANGED, state }); }

test("Studio renders untrusted titles as text and retains channel controls across state and real meter updates", async () => {
  const initialState = snapshot([{ ...route(), tabTitle: '<img src=x onerror="bad()">' }]);
  const ui = await mount({ initialState });
  const channel = ui.get("channels").children[0];
  assert.equal(channel.querySelectorAll("h3")[0].textContent, initialState.routes[0].tabTitle);
  const meter = channel.querySelectorAll("meter")[0];
  sendState(ui, { ...initialState, revision: 2, routes: [{ ...initialState.routes[0], ducked: true }] });
  assert.equal(ui.get("channels").children[0], channel);
  assert.equal(channel.querySelectorAll(".channel-status")[0].textContent, "Lowered by Smart Focus");
  ui.port.onMessage.emit({ type: STUDIO_MESSAGE.LEVELS, levels: [{ tabId: 11, sinkId: "sink-11", rms: 0.1, peak: 0.3 }] });
  assert.equal(meter.value, 40);
  assert.equal(channel.querySelectorAll("meter")[0], meter);
});

test("revisioned updates reject late engine snapshots and preserve the active slider until blur", async () => {
  const ui = await mount();
  const volume = ui.get("volume-11-sink-11");
  volume.focus();
  volume.value = "125";
  const changed = snapshot([{ ...route(), sinks: [{ ...route().sinks[0], volume: 0.8 }] }]);
  sendState(ui, { ...changed, revision: 3 });
  assert.equal(volume.value, "125");
  ui.document.activeElement = null;
  volume.fire("blur");
  assert.equal(volume.value, "80");
  sendState(ui, { ...snapshot(), revision: 2 });
  assert.equal(volume.value, "80");
  sendState(ui, { ...snapshot(), epoch: "engine-2", revision: 0 });
  assert.equal(volume.value, "100");
  sendState(ui, { ...changed, revision: 99 });
  assert.equal(volume.value, "100", "a retired engine cannot overwrite the new engine");
});

test("mute, solo, priority and Smart Focus are routed through trusted worker commands", async () => {
  const ui = await mount();
  const channel = ui.get("channels").children[0];
  for (const text of ["Mute", "Solo", "Priority"]) {
    channel.querySelectorAll("button").find((button) => button.textContent === text).fire("click");
    await settle();
  }
  ui.get("focus-enabled").checked = true;
  ui.get("focus-enabled").fire("change");
  await settle();
  const changes = ui.messages.filter((message) => [STUDIO_MESSAGE.UPDATE_MIX, STUDIO_MESSAGE.UPDATE_FOCUS].includes(message.type));
  assert.deepEqual(changes.map((message) => JSON.parse(JSON.stringify(message))), [
    { target: utils.MESSAGE_TARGET.WORKER, type: STUDIO_MESSAGE.UPDATE_MIX, tabId: 11, muted: true },
    { target: utils.MESSAGE_TARGET.WORKER, type: STUDIO_MESSAGE.UPDATE_MIX, tabId: 11, solo: true },
    { target: utils.MESSAGE_TARGET.WORKER, type: STUDIO_MESSAGE.UPDATE_FOCUS, priorityTabId: 11 },
    { target: utils.MESSAGE_TARGET.WORKER, type: STUDIO_MESSAGE.UPDATE_FOCUS, enabled: true },
  ]);
});

test("scene save sends user labels without persisting captured titles, URLs or route snapshots", async () => {
  const ui = await mount({ initialState: snapshot([{ ...route(), tabTitle: "Confidential customer discussion" }]), handle: () => ({ scene: scene(), scenes: [scene()] }) });
  ui.get("save-scene").fire("click");
  assert.equal(ui.get("scene-label-11").value, "Channel 1");
  ui.get("scene-name").value = "Work";
  ui.get("scene-label-11").value = "Meeting";
  ui.get("scene-form").fire("submit");
  await settle();
  const saved = ui.messages.find((message) => message.type === STUDIO_MESSAGE.SAVE_SCENE);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), { target: utils.MESSAGE_TARGET.WORKER, type: STUDIO_MESSAGE.SAVE_SCENE, name: "Work", labels: { 11: "Meeting" } });
  assert.equal(ui.get("scene-dialog").open, false);
  assert.equal(ui.get("scene-select").value, "work");
});

test("scene recall requires duplicate-site assignment and reports failed channels accurately", async () => {
  const saved = scene();
  const candidates = [route(11), route(12)].map((entry) => ({ tabId: entry.tabId, tabTitle: `Meeting ${entry.tabId}`, siteHost: entry.siteHost }));
  const ui = await mount({
    initialState: snapshot([route(11), route(12)]), savedScenes: [saved],
    handle: (message) => {
      if (message.type === STUDIO_MESSAGE.PREVIEW_SCENE) {
        const assigned = message.assignments.meeting;
        return { preview: { slots: [{ slotId: "meeting", label: "Meeting", siteHost: "meeting.example", candidates, status: assigned ? "ready" : "ambiguous", tabId: assigned || null, missingDevices: assigned ? [{ deviceId: "headphones", deviceLabel: "USB headphones" }] : [] }], readyCount: assigned ? 1 : 0 } };
      }
      return { result: { complete: false, channels: [{ slotId: "meeting", tabId: 12, status: "failed", error: { message: "USB headphones disconnected" } }], focusApplied: false } };
    },
  });
  ui.get("apply-scene").fire("click");
  await settle();
  assert.equal(ui.get("recall-submit").disabled, true);
  const select = ui.get("recall-channels").querySelectorAll("select")[0];
  assert.equal(select.value, "choose");
  select.value = "12";
  select.fire("change");
  await settle();
  assert.match(ui.get("recall-channels").querySelectorAll(".recall-warning")[0].textContent, /Unavailable outputs: USB headphones/);
  ui.get("recall-form").fire("submit");
  await settle();
  const applied = ui.messages.find((message) => message.type === STUDIO_MESSAGE.APPLY_SCENE);
  assert.equal(applied.assignments.meeting, 12);
  assert.match(ui.get("notice-text").textContent, /0 of 1 channels applied/);
  assert.match(ui.get("notice-text").textContent, /Meeting: USB headphones disconnected/);
  assert.equal(ui.get("notice").dataset.error, "true");
});
