import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [port = "9345", extensionId = "lmgiohbjplmjoejbfpfkmjhjlmpamnec"] = process.argv.slice(2);
const origin = `chrome-extension://${extensionId}`;
const output = resolve("artifacts/studio");
await mkdir(output, { recursive: true });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const sockets = [];
async function connect(url) {
  const socket = new WebSocket(url);
  sockets.push(socket);
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    const task = pending.get(message.id);
    if (!task) return;
    clearTimeout(task.timer);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
  });
  await new Promise((done, reject) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  return { errors, command(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 12000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
  } };
}
const targets = async () => (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
async function waitTarget(predicate) {
  for (let attempt = 0; attempt < 40; attempt++) { const found = (await targets()).find(predicate); if (found) return found; await sleep(100); }
  throw new Error("Chrome target did not open.");
}
async function evaluate(page, expression) {
  const result = await page.command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function request(page, type, payload = {}) {
  const response = await evaluate(page, `chrome.runtime.sendMessage(${JSON.stringify({ target: "audio-route-worker", type, ...payload })})`);
  assert.equal(response?.ok, true, `${type}: ${JSON.stringify(response)}`);
  return response;
}
async function eventually(fn, predicate, description) {
  let value;
  for (let attempt = 0; attempt < 40; attempt++) { value = await fn(); if (predicate(value)) return value; await sleep(100); }
  throw new Error(`${description}: ${JSON.stringify(value)}`);
}
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end('<!doctype html><title>AudioRoute Studio test</title><h1>Local audio verification</h1><p>Quiet synthetic audio; no microphone input.</p>');
});
await new Promise((done) => server.listen(0, done));
const sourcePort = server.address().port;
const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const report = { browser: version.Browser, checks: [] };
const sourcePages = [];
let studio;
try {
  await browser.command("Browser.grantPermissions", { origin, permissions: ["audioCapture"] });
  const studioTarget = await browser.command("Target.createTarget", { url: `${origin}/studio/studio.html` });
  studio = await connect((await waitTarget((target) => target.id === studioTarget.targetId)).webSocketDebuggerUrl);
  await studio.command("Runtime.enable");
  await studio.command("Page.enable");
  await eventually(() => evaluate(studio, "document.querySelector('#connection')?.textContent"), (value) => value === "Connected", "Studio connection");
  const devices = await evaluate(studio, "navigator.mediaDevices.enumerateDevices().then(ds => ds.filter(d=>d.kind==='audiooutput').map(d=>({deviceId:d.deviceId,label:d.label})))");
  const physical = devices.filter((device) => !["default", "communications", ""].includes(device.deviceId) && !/voicemeeter|vb-audio|cable|virtual/i.test(device.label))
    .sort((a, b) => Number(/USB|Bose/i.test(b.label)) - Number(/USB|Bose/i.test(a.label)));
  assert.ok(physical.length >= 1, "At least one actual output device is required.");
  report.physicalOutputs = physical.map((device) => device.label);
  report.twoPhysicalOutputs = physical.length >= 2;
  // This runner requires a dedicated profile; it never clears extension storage.
  for (const route of (await request(studio, "get-studio-state")).state.routes) await request(studio, "stop-route", { tabId: route.tabId });
  for (let index = 0; index < 2; index++) {
    const url = `http://${index ? "127.0.0.1" : "localhost"}:${sourcePort}/?source=${index}`;
    const tab = await browser.command("Target.createTarget", { url, forTab: true });
    const target = await waitTarget((entry) => entry.type === "page" && entry.url === url);
    const page = await connect(target.webSocketDebuggerUrl);
    sourcePages.push(page);
    await eventually(() => evaluate(page, "document.readyState"), (value) => value === "complete", "Source page load");
    await evaluate(page, `(() => { const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); gain.gain.value = ${index ? 0 : 0.02}; oscillator.frequency.value = ${index ? 660 : 440}; oscillator.connect(gain).connect(context.destination); oscillator.start(); globalThis.audioTest = {context,oscillator,gain}; return context.resume(); })()`);
    await browser.command("Target.activateTarget", { targetId: tab.targetId });
    await browser.command("Extensions.triggerAction", { id: extensionId, targetId: tab.targetId });
    const popupTarget = await waitTarget((entry) => entry.url === `${origin}/popup/popup.html`);
    const popup = await connect(popupTarget.webSocketDebuggerUrl);
    const { tab: active } = await request(popup, "get-active-tab");
    const device = physical[index % physical.length];
    const { state: route } = await request(popup, "start-route", { tabId: active.id, deviceId: device.deviceId, label: device.label });
    assert.equal(route.active, true);
    assert.equal(route.siteHost, index ? "127.0.0.1" : "localhost");
    assert.equal(route.meterError, null, route.meterError);
    if (index === 1) {
      await evaluate(popup, "document.querySelector('#open-studio').click()");
      await eventually(targets, (entries) => entries.filter((entry) => entry.url === `${origin}/studio/studio.html`).length >= 2, "Native side panel target");
      report.checks.push("Toolbar opens the actual Chrome side panel");
    }
  }
  await browser.command("Target.activateTarget", { targetId: studioTarget.targetId });
  await sleep(300);
  let state = (await request(studio, "get-studio-state")).state;
  const music = state.routes.find((route) => route.siteHost === "localhost");
  const call = state.routes.find((route) => route.siteHost === "127.0.0.1");
  await evaluate(studio, `(() => { const p=chrome.runtime.connect({name:'audio-route-studio'}); p.onMessage.addListener(m=>{if(m.type==='studio-levels')globalThis.measuredLevels=m.levels;}); p.postMessage({type:'visibility',visible:true}); globalThis.testMeterPort=p; })()`);
  await request(studio, "update-sink", { tabId: music.tabId, sinkId: music.sinks[0].id, volume: 0.6 });
  await request(studio, "update-focus", { priorityTabId: call.tabId, enabled: true });
  await evaluate(sourcePages[1], "audioTest.gain.gain.value=0.02");
  await eventually(() => request(studio, "get-studio-state"), ({ state }) => state.focus.active && state.routes.find((r) => r.tabId === music.tabId).ducked, "Priority ducks music");
  await eventually(() => evaluate(studio, "[...document.querySelectorAll('meter')].map(m=>m.value)"), (values) => values.some((value) => value > 0), "Real output meters");
  report.checks.push("Two real captures, independent outputs, measured levels, Smart Focus activation");
  const saved = await request(studio, "save-scene", { name: `Studio verification ${Date.now()}`, labels: { [music.tabId]: "Music", [call.tabId]: "Call" } });
  const scene = saved.scene;
  assert.ok(!JSON.stringify(scene).includes("tabTitle"));
  await request(studio, "update-mix", { tabId: call.tabId, muted: true });
  assert.equal((await request(studio, "get-studio-state")).state.focus.active, false);
  await request(studio, "update-mix", { tabId: call.tabId, muted: false });
  await eventually(() => request(studio, "get-studio-state"), ({ state }) => state.focus.active, "Priority resumes");
  await evaluate(sourcePages[1], "audioTest.gain.gain.value=0");
  state = (await eventually(() => request(studio, "get-studio-state"), ({ state }) => !state.focus.active, "Silence restores music")).state;
  assert.equal(state.routes.find((route) => route.tabId === music.tabId).sinks[0].volume, 0.6);
  report.checks.push("Mute releases focus; silence restores exact manual volume");
  await sleep(600);
  const baselineRms = await evaluate(studio, `measuredLevels.find(level=>level.tabId===${music.tabId}).rms`);
  assert.ok(baselineRms > 0, "Measured real baseline output");
  await request(studio, "update-sink", { tabId: music.tabId, sinkId: music.sinks[0].id, volume: 0.3 });
  const applied = await request(studio, "apply-scene", { sceneId: scene.id });
  assert.equal(applied.result.complete, true, JSON.stringify(applied.result));
  assert.equal((await request(studio, "get-studio-state")).state.routes.find((r) => r.tabId === music.tabId).sinks[0].volume, 0.6);
  report.checks.push("Scene save and recall restore actual engine configuration");
  const rejected = await evaluate(studio, `chrome.runtime.sendMessage({target:'audio-route-offscreen',type:'offscreen-stop',tabId:${music.tabId}})`);
  assert.equal(rejected.ok, false);
  report.checks.push("Direct UI-to-engine command rejected");
  for (const width of [340, 600]) {
    await studio.command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await sleep(150);
    const overflow = await evaluate(studio, "document.documentElement.scrollWidth>innerWidth");
    assert.equal(overflow, false, `No horizontal overflow at ${width}px`);
    const screenshot = await studio.command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(resolve(output, `studio-${width}.png`), Buffer.from(screenshot.data, "base64"));
  }
  await evaluate(studio, "document.querySelector('#focus-enabled').focus()");
  assert.equal(await evaluate(studio, "document.activeElement.id"), "focus-enabled");
  report.checks.push("Narrow/wide Studio render, no overflow, keyboard focus");
  await evaluate(sourcePages[1], "audioTest.gain.gain.value=0.02");
  await sleep(1000);
  const duckedRms = await evaluate(studio, `measuredLevels.find(level=>level.tabId===${music.tabId}).rms`);
  assert.ok(Math.abs(duckedRms / baselineRms - 0.2) < 0.025, `Measured duck ratio: ${duckedRms / baselineRms}`);
  report.measuredDuckRatio = duckedRms / baselineRms;
  await evaluate(sourcePages[1], "audioTest.gain.gain.value=0");
  await sleep(1200);
  const observerTarget = await browser.command("Target.createTarget", { url: `${origin}/popup/popup.html` });
  const observer = await connect((await waitTarget((target) => target.id === observerTarget.targetId)).webSocketDebuggerUrl);
  // Close every Studio document, then observe audio entirely from the engine.
  for (const target of await targets()) {
    if (target.url === `${origin}/studio/studio.html`) await browser.command("Target.closeTarget", { targetId: target.id }).catch(() => {});
  }
  await evaluate(sourcePages[1], "audioTest.gain.gain.value=0.02");
  await eventually(() => request(observer, "get-studio-state"), ({state}) => state.focus.active, "Focus runs with Studio closed");
  await sleep(200);
  assert.equal((await request(observer, "get-studio-state")).state.routes.find((route)=>route.tabId===music.tabId).gain, 0.2);
  await evaluate(sourcePages[1], "audioTest.gain.gain.value=0");
  await eventually(() => request(observer, "get-studio-state"), ({state}) => !state.focus.active, "Closed Studio silence recovery");
  report.checks.push("Smart Focus and exact gain work with all Studio views closed");
  // A real renderer event reaches the bundled content bridge in its isolated world.
  await evaluate(sourcePages[1], "(()=>{const button=document.createElement('button');button.className='ytp-fullscreen-button';document.body.append(button);button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));})()");
  await eventually(() => request(observer, "get-studio-state"), ({state}) => !state.routes.some((route)=>route.tabId===call.tabId), "Fullscreen capture suspension");
  const resumed = (await eventually(() => request(observer, "get-studio-state"), ({state}) => state.routes.some((route)=>route.tabId===call.tabId), "Fullscreen capture recovery")).state;
  assert.equal(resumed.focus.priorityTabId, call.tabId);
  assert.equal(resumed.routes.find((route)=>route.tabId===call.tabId).deviceId, call.deviceId);
  report.checks.push("Content bridge fullscreen suspension and complete route recovery");
  const workerTarget = await waitTarget((entry) => entry.type === "service_worker" && entry.url === `${origin}/service-worker.js`);
  await browser.command("Target.closeTarget", { targetId: workerTarget.id });
  await sleep(300);
  const recovered = (await request(observer, "get-studio-state")).state;
  assert.equal(recovered.routes.length, 2); assert.equal(recovered.focus.priorityTabId, call.tabId);
  assert.ok((await request(observer, "list-scenes")).scenes.some((entry)=>entry.id===scene.id));
  report.checks.push("Worker restart preserves active routes, priority and stored scenes");
  assert.equal(studio.errors.length, 0, JSON.stringify(studio.errors));
  report.checks.push("No Studio runtime exceptions");
  report.success = true;
} catch (error) {
  report.success = false;
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  for (const page of sourcePages) await evaluate(page, "audioTest.gain.gain.value=0").catch(() => {});
  await writeFile(resolve(output, "verification.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  for (const socket of sockets) socket.close();
  server.close();
}
